/**
 * The database connection, in one module. Single tenant: DB_NAME from the
 * environment, one pool for the process.
 *
 * Credentials come only from process.env (this app's own .env.app, or
 * whatever the platform injects) — never read from another app's or the
 * workspace's own .env file. The actual connection and auth are entirely
 * the Cloud SQL Connector's job (mTLS + IAM token exchange over ADC); this
 * module only tells it which instance, which IAM principal, which database.
 *
 * Three ways in, auto-detected in this order:
 *   1. IAM DB auth (DB_IAM_USER set, no password anywhere) — Cloud SQL
 *      Connector does mTLS + an IAM token in place of a password. Same
 *      instance/user as .claude/skills/mti-t1-data-pipeline/scripts/db.py's
 *      proven Python path, ADC resolved independently in this process.
 *   2. Password-based Cloud SQL Connector (CLOUD_SQL_INSTANCE_CONNECTION_NAME
 *      + DB_USER + DB_PASSWORD, no DB_IAM_USER) — kept for any environment
 *      still on the older credential shape (see lifeos-apps/anomaly-detect).
 *   3. A plain DSN (SS_LIBRARY_DSN / DATABASE_URL) — local dev, pointing at
 *      `cloud-sql-proxy --port 5433`.
 */
import postgres from "postgres";
import { GoogleAuth } from "google-auth-library";
import { readFileSync } from "node:fs";

// Mirrors db.py's _read_env_raw: the workspace .env is the single source of
// truth for DB config (CLAUDE.md, 28-Aug-2026). A missing file is a
// supported state, not an error.
function readEnvRaw(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (const raw of readFileSync(path, "utf-8").split(/\r?\n/)) {
      const t = raw.trimStart();
      if (!t || t.startsWith("#")) continue;
      const eq = raw.indexOf("=");
      if (eq <= 0) continue;
      const key = raw.slice(0, eq).trim();
      let val = raw.slice(eq + 1);
      if (val.length >= 2 && val[0] === val[val.length - 1] && (val[0] === "'" || val[0] === '"')) val = val.slice(1, -1);
      out[key] = val;
    }
  } catch { /* no file — fall through to code defaults */ }
  return out;
}
const PROJECT_ENV = readEnvRaw(process.env.PROJECT_ENV_PATH || "/Users/Mti1/LIFEOSAI/.env");
const env = (name: string) => process.env[name] || PROJECT_ENV[name] || "";

// Same four defaults as db.py's _DB_DEFAULTS — configuration, not credentials,
// so an unset .env still resolves to the one real instance this workspace uses.
const DEFAULTS = {
  CLOUD_SQL_INSTANCE_CONNECTION_NAME: "lifeosai-481608:asia-south1:lifeosai-db",
  POSTGRES_DB: "nyk_mti",
  DB_IAM_USER: "sa-user-mti1@lifeosai-481608.iam",
  DB_IP_TYPE: "PRIVATE",
};

export const INSTANCE = env("CLOUD_SQL_INSTANCE_CONNECTION_NAME") || DEFAULTS.CLOUD_SQL_INSTANCE_CONNECTION_NAME;
export const DB_NAME = env("DB_NAME") || env("POSTGRES_DB") || DEFAULTS.POSTGRES_DB;
const HAS_PASSWORD_CREDS = !!(env("DB_USER") && env("DB_PASSWORD"));
const IAM_USER = env("DB_IAM_USER") || (HAS_PASSWORD_CREDS ? "" : DEFAULTS.DB_IAM_USER);
const DIRECT_DSN = env("SS_LIBRARY_DSN") || env("DATABASE_URL");

export const AUTH_MODE: "iam" | "password" | "dsn" = DIRECT_DSN
  ? "dsn"
  : HAS_PASSWORD_CREDS
    ? "password"
    : "iam";
export const USE_CONNECTOR = AUTH_MODE !== "dsn";

// Every query here is schema-qualified (living_office.*, m0_check_reports.*, noon_report.*).
const SEARCH_PATH = "public";

export function dsn(): string {
  if (DIRECT_DSN) return DIRECT_DSN;
  const host = env("DB_HOST") || "127.0.0.1";
  const dbPort = env("DB_PORT") || "5433";
  return `postgres://${encodeURIComponent(env("DB_USER"))}:${encodeURIComponent(env("DB_PASSWORD"))}@${host}:${dbPort}/${DB_NAME}`;
}

type DriverOpts = { stream: () => import("node:net").Socket };
let driverOpts: Promise<DriverOpts> | null = null;

// google-auth-library's own metadata-probe retry/backoff has no bound this
// module controls, and a hung probe would hang every request sharing the
// cached promise below with it. A request should fail predictably fast
// ("database unreachable") rather than wait on someone else's retry policy.
const CONNECT_TIMEOUT_MS = 10_000;
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

/** IAM auth: Application Default Credentials from this container's own identity
 *  — no key file, no password. Matches db.py's `google.auth.default()`. */
function cloudSqlOptionsIam(): Promise<DriverOpts> {
  if (!driverOpts) {
    const p: Promise<DriverOpts> = withTimeout((async () => {
      const { Connector, IpAddressTypes, AuthTypes } = await import("@google-cloud/cloud-sql-connector");
      const ipType = (env("DB_IP_TYPE") || DEFAULTS.DB_IP_TYPE).toUpperCase() === "PRIVATE"
        ? IpAddressTypes.PRIVATE : IpAddressTypes.PUBLIC;
      return new Connector().getOptions({
        instanceConnectionName: INSTANCE,
        ipType,
        authType: AuthTypes.IAM,
      });
    })(), CONNECT_TIMEOUT_MS, "Cloud SQL Connector (IAM)");
    p.catch(() => { if (driverOpts === p) driverOpts = null; });
    driverOpts = p;
  }
  return driverOpts;
}

/** Password auth via the connector — the anomaly-detect shape, kept for compatibility. */
function cloudSqlOptionsPassword(): Promise<DriverOpts> {
  if (!driverOpts) {
    const p: Promise<DriverOpts> = withTimeout((async () => {
      const raw = env("GOOGLE_SERVICE_ACCOUNT_BASE64");
      const { Connector, IpAddressTypes, AuthTypes } = await import("@google-cloud/cloud-sql-connector");
      const auth = raw
        ? new GoogleAuth({
            credentials: JSON.parse(Buffer.from(raw, "base64").toString("utf-8")),
            scopes: ["https://www.googleapis.com/auth/sqlservice.admin"],
          })
        : undefined;
      const connectorAuth = auth as unknown as NonNullable<
        ConstructorParameters<typeof Connector>[0]
      >["auth"];
      return new Connector(auth ? { auth: connectorAuth } : undefined).getOptions({
        instanceConnectionName: INSTANCE,
        ipType: IpAddressTypes.PUBLIC,
        authType: AuthTypes.PASSWORD,
      });
    })(), CONNECT_TIMEOUT_MS, "Cloud SQL Connector (password)");
    p.catch(() => { if (driverOpts === p) driverOpts = null; });
    driverOpts = p;
  }
  return driverOpts;
}

function makeSql() {
  if (AUTH_MODE === "dsn") {
    return postgres(dsn(), { max: 4, idle_timeout: 30, connection: { search_path: SEARCH_PATH } });
  }
  if (AUTH_MODE === "password") {
    return postgres({
      user: env("DB_USER"),
      password: env("DB_PASSWORD"),
      database: DB_NAME,
      ssl: false, // the connector already did mTLS; negotiating TLS again inside the tunnel would fail
      max: 3,
      idle_timeout: 60,
      connect_timeout: 12,
      connection: { search_path: SEARCH_PATH },
      socket: async () => (await cloudSqlOptionsPassword()).stream(),
    } as unknown as string);
  }
  // IAM: no password field at all — the connector's mTLS stream carries the token.
  return postgres({
    user: IAM_USER,
    database: DB_NAME,
    ssl: false,
    max: 3,
    idle_timeout: 60,
    connect_timeout: 12,
    connection: { search_path: SEARCH_PATH },
    socket: async () => (await cloudSqlOptionsIam()).stream(),
  } as unknown as string);
}

// Built on first use, not at import, so a health check can answer before any
// query is attempted, and a query failure never crashes the process.
let pool: ReturnType<typeof postgres> | null = null;
function poolNow() { if (!pool) pool = makeSql(); return pool; }

const sql: ReturnType<typeof postgres> = new Proxy(function () {} as never, {
  apply: (_t, _this, args: unknown[]) =>
    (poolNow() as unknown as (...a: unknown[]) => unknown)(...args),
  get: (_t, prop) =>
    (poolNow() as unknown as Record<string | symbol, unknown>)[prop],
}) as unknown as ReturnType<typeof postgres>;

export { sql, IAM_USER };
