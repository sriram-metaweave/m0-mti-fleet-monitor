/**
 * Keyless Postgres access from Vercel to LIFEOSAI's private Cloud SQL instance —
 * after vercel-cloudsql-reference/src/db.ts, structure and settings kept:
 *
 * Path: Vercel function -> pg-relay (Cloud Run, WebSocket) -> Cloud SQL Auth Proxy -> Cloud SQL.
 *
 * Every hop authenticates with a short-lived token and nothing is stored:
 *   1. Vercel issues this deployment an OIDC token (team, project and environment bound).
 *   2. GCP Workload Identity Federation exchanges it for this app's service account.
 *   3. An ID token for the relay URL passes Cloud Run IAM (roles/run.invoker).
 *   4. An access token is the Postgres password (Cloud SQL IAM authentication).
 *   5. Postgres grants decide which database and tables the account may touch.
 *
 * Two things are this app's own, on top of the reference:
 *   - `sql` — a tagged template over the invocation's pool, so the queries under
 *     src/server keep their text (fragments, arrays, casts compile to $1…$n).
 *   - `withDatabase()` is entered once per request by the router; the queries
 *     that request runs find its pool through an AsyncLocalStorage scope.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { getVercelOidcToken } from "@vercel/oidc";
import { ExternalAccountClient, type BaseExternalAccountClient } from "google-auth-library";
import WebSocket from "ws";

interface Settings {
  projectNumber: string;
  serviceAccountEmail: string;
  poolId: string;
  providerId: string;
  relayUrl: string;
  database: string;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

function settings(): Settings {
  return {
    projectNumber: required("GCP_PROJECT_NUMBER"),
    serviceAccountEmail: required("GCP_SERVICE_ACCOUNT_EMAIL"),
    poolId: required("GCP_WORKLOAD_IDENTITY_POOL_ID"),
    providerId: required("GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID"),
    relayUrl: required("PG_RELAY_URL").replace(/\/+$/, ""),
    // DB_NAME is the name the GCP access handover uses; PGDATABASE is the reference's
    database: process.env.PGDATABASE || required("DB_NAME"),
  };
}

/** The settings the startup banner prints; empty when the environment names no relay. */
export function describe(): string {
  if (!process.env.PG_RELAY_URL) return "";
  const s = settings();
  return `db: pg-relay ${s.relayUrl} → ${s.database} as ${s.serviceAccountEmail} (keyless)`;
}

/**
 * Vercel hands a function its OIDC token in the x-vercel-oidc-token request
 * header as well as through @vercel/oidc. This app runs on Vercel's Bun
 * runtime, so the router notes the header of the request being served and the
 * federation falls back to it if the library cannot find the token.
 */
let requestOidcToken: string | undefined;
export function noteOidcToken(req: Request): void {
  const t = req.headers.get("x-vercel-oidc-token");
  if (t) requestOidcToken = t;
}
async function subjectToken(): Promise<string> {
  try { return await getVercelOidcToken(); } catch (e) { if (requestOidcToken) return requestOidcToken; throw e; }
}

let cachedAuth: BaseExternalAccountClient | undefined;

function authClient(s: Settings): BaseExternalAccountClient {
  if (cachedAuth) {
    return cachedAuth;
  }
  const client = ExternalAccountClient.fromJSON({
    type: "external_account",
    audience: `//iam.googleapis.com/projects/${s.projectNumber}/locations/global/workloadIdentityPools/${s.poolId}/providers/${s.providerId}`,
    subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
    token_url: "https://sts.googleapis.com/v1/token",
    service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${s.serviceAccountEmail}:generateAccessToken`,
    // Called with no arguments on purpose: the token must keep Vercel's default
    // audience (https://vercel.com/<team>), which is what the WIF provider allows.
    subject_token_supplier: { getSubjectToken: () => subjectToken() },
  });
  if (!client) {
    throw new Error("could not build the Workload Identity Federation client");
  }
  cachedAuth = client;
  return client;
}

async function relayIdToken(s: Settings): Promise<string> {
  const response = await authClient(s).request<{ token: string }>({
    url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${s.serviceAccountEmail}:generateIdToken`,
    method: "POST",
    data: { audience: s.relayUrl, includeEmail: true },
  });
  return response.data.token;
}

async function accessToken(s: Settings): Promise<string> {
  const { token } = await authClient(s).getAccessToken();
  if (!token) {
    throw new Error("could not obtain a GCP access token for the service account");
  }
  return token;
}

/**
 * A connection pool to this app's database, sized for a single function invocation.
 * Call `end()` when the handler finishes.
 */
export async function createPool(): Promise<Pool> {
  const s = settings();
  const [idToken, password] = await Promise.all([relayIdToken(s), accessToken(s)]);

  class AuthenticatedWebSocket extends WebSocket {
    constructor(url: string | URL, protocols?: string | string[]) {
      super(url, protocols, { headers: { Authorization: `Bearer ${idToken}` } });
    }
  }

  neonConfig.webSocketConstructor = AuthenticatedWebSocket;
  neonConfig.useSecureWebSocket = true;
  neonConfig.forceDisablePgSSL = true; // TLS terminates at Cloud Run; the hop to the proxy is loopback
  neonConfig.pipelineConnect = false; // IAM login needs the plain authentication handshake
  neonConfig.wsProxy = (host, port) =>
    `${s.relayUrl.replace(/^https:\/\//, "")}/v1?address=${host}:${port}`;

  return new Pool({
    host: "127.0.0.1", // the Auth Proxy beside the relay
    port: 5432,
    user: s.serviceAccountEmail.replace(/\.gserviceaccount\.com$/, ""),
    password,
    database: s.database,
    max: 4, // a screen's handlers run a few reads in parallel
  });
}

/** The pool of the request being served — created on the first query, not before. */
type Lazy = { pool?: Promise<Pool> };
const scope = new AsyncLocalStorage<Lazy>();

/**
 * The one seam: a process may supply its own pool factory instead of the relay.
 * Vercel never does — it is for tests and for running against a local copy of
 * the database (scripts/local.ts), where no Vercel OIDC token exists.
 */
let poolFactory: (() => Promise<Pool>) | null = null;
export function usePoolFactory(f: () => Promise<Pool>): void { poolFactory = f; }

function poolNow(): Promise<Pool> {
  const lazy = scope.getStore();
  if (!lazy) throw new Error("a query ran outside withDatabase()");
  return (lazy.pool ??= (poolFactory ?? createPool)());
}

/**
 * Run one unit of work against the database and always release the pool — the
 * reference's one pool per invocation, except that a request which runs no
 * query (a static file, /api/health) never opens one and mints no token.
 */
export async function withDatabase<T>(work: () => Promise<T>): Promise<T> {
  const lazy: Lazy = {};
  try {
    return await scope.run(lazy, work);
  } finally {
    if (lazy.pool) await (await lazy.pool).end();
  }
}

/* ── the tagged template the queries are written in ──────────────── */

/** A piece of SQL with its values; embeds in another `sql` template, or runs when awaited. */
export class Sql implements PromiseLike<Row[]> {
  constructor(readonly strings: ReadonlyArray<string>, readonly values: unknown[]) {}
  /** The query text with $1…$n, and the parameters, fragments folded in. */
  compile(params: unknown[] = []): { text: string; params: unknown[] } {
    let text = "";
    this.strings.forEach((str, i) => {
      text += str;
      if (i >= this.values.length) return;
      const v = this.values[i];
      if (v instanceof Sql) text += v.compile(params).text;
      else { params.push(v); text += "$" + params.length; }
    });
    return { text, params };
  }
  then<A = Row[], B = never>(onOk?: ((rows: Row[]) => A | PromiseLike<A>) | null, onErr?: ((e: unknown) => B | PromiseLike<B>) | null): Promise<A | B> {
    return this.run().then(onOk, onErr);
  }
  private async run(): Promise<Row[]> {
    const pool = await poolNow();
    const { text, params } = this.compile();
    const { rows } = await pool.query(text, params);
    return rows as Row[];
  }
}
export type Row = Record<string, unknown>;

/** `sql\`select … where id = ${id}\`` — the same shape the queries have always had. */
export function sql(strings: TemplateStringsArray, ...values: unknown[]): Sql {
  return new Sql(strings, values);
}
