/**
 * The router. One `serve(req)` with no side effects at import — no pool
 * opened, no port bound — so a test can import it and drive requests through.
 *
 * There is no authentication. Every route answers anyone who reaches it —
 * the LifeOS preview/host in front of it is the boundary. Every query is
 * read-only (SELECT) against nyk_mti.
 */
import { join } from "node:path";
import { APP_TAG, APP_TITLE, PUBLIC, port } from "./config";
import { j } from "./http";
import * as Q from "./queries";
import { serveStaticFile, serveIndex } from "./static";
import { withSecurityHeaders } from "./security";
import { noteOidcToken, withDatabase } from "./db";

export const handler = {
  port,
  idleTimeout: 60,
  maxRequestBodySize: 1 * 1024 * 1024,
  async fetch(req: Request): Promise<Response> {
    try {
      noteOidcToken(req); // Vercel's per-request identity, for the keyless database path
      // one pool per request, opened only if a query actually runs (see db.ts)
      return withSecurityHeaders(await withDatabase(() => serve(req)));
    } catch (e) {
      console.error("[fetch]", (e as Error).message);
      return j({ error: "database unreachable", detail: (e as Error).message }, 503);
    }
  },
};

/** Split and decode the path once, per segment; refuse an encoded separator. */
export function pathParts(pathname: string): string[] | null {
  const rawParts = pathname.replace(/^\/+/, "").replace(/\/+$/, "").split("/");
  const parts: string[] = [];
  for (const seg of rawParts) {
    let dec: string;
    try { dec = decodeURIComponent(seg); } catch { return null; }
    if (dec.includes("/") || dec.includes("\\")) return null;
    parts.push(dec);
  }
  return parts;
}

const STATIC = new Set(["app.js", "components.js", "components.css", "coast.js", "comments.js", "weather.js", "icon.svg", "cover.png"]);
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[A-Za-z0-9_.-]{1,64}$/;

export async function serve(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const parts = pathParts(url.pathname);
  if (!parts) return j({ error: "bad request" }, 400);
  const last = parts[parts.length - 1] ?? "";
  if (req.method !== "GET" && req.method !== "HEAD") return j({ error: "method not allowed" }, 405);

  try {
    if (parts.join("/") === "" || last === "index.html") return serveIndex();
    if (STATIC.has(last)) return serveStaticFile(join(PUBLIC, last.endsWith(".svg") || last.endsWith(".png") ? join("..", "assets", last) : last));

    // /api/... — tolerate a prefix like /artifact-preview/<token>/api/...
    const apiIdx = parts.indexOf("api");
    if (apiIdx < 0) return j({ error: "not found" }, 404);
    const rest = parts.slice(apiIdx + 1);
    const route = rest[0] ?? "";
    const q = url.searchParams;

    if (route === "health") return j({ ok: 1, app: APP_TAG, title: APP_TITLE, now: new Date().toISOString() });
    if (route === "fleet") return j(await Q.fleet());

    if (route === "vessel") {
      const slug = rest[1] ?? "";
      if (!ID.test(slug)) return j({ error: "bad vessel" }, 400);
      const v = await Q.vesselBySlug(slug);
      if (!v) return j({ error: "no such vessel" }, 404);
      const sub = rest[2] ?? "";
      const arg = rest[3] ?? "";
      if (!sub) return j(await Q.vesselDetail(v));
      if (sub === "tags") return j(await Q.tags(v));
      if (sub === "findings") return j(await Q.findingsAll(v));
      if (sub === "track") return j(await Q.track(v));
      if (sub === "noon") {
        const since = q.get("since") ?? "2024-01-01";
        if (!ISO.test(since)) return j({ error: "bad since" }, 400);
        return j(await Q.noon(v, since));
      }
      if (sub === "series") {
        const system = q.get("system") ?? "", from = q.get("from") ?? "", to = q.get("to") ?? "";
        const tags = (q.get("tags") ?? "").split(",").map((t) => t.trim()).filter((t) => ID.test(t)).slice(0, 200);
        if ((!system && !tags.length) || !ISO.test(from) || !ISO.test(to)) return j({ error: "system or tags, plus from and to, required" }, 400);
        return j(await Q.systemSeries(v, system, from, to, tags.length ? tags : null));
      }
      if (!ID.test(arg)) return j({ error: "bad id" }, 400);
      if (sub === "check") { const d = await Q.checkDetail(v, arg); return d ? j(d) : j({ error: "not analysed" }, 404); }
      if (sub === "checklist") {
        const tags = (q.get("tags") ?? "").split(",").map((t) => t.trim()).filter((t) => ID.test(t)).slice(0, 200);
        return j(await Q.checklist(v, arg, tags.length ? tags : null));
      }
      if (sub === "tag") return j(await Q.tagDetail(v, arg));
    }
    return j({ error: "not found" }, 404);
  } catch (e) {
    console.error("[serve]", url.pathname, (e as Error).message);
    return j({ error: "database unreachable", detail: (e as Error).message }, 503);
  }
}
