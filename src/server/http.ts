/**
 * Request and response helpers shared by every route.
 */
export function j(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // Every body is scoped to the signed-in caller; nothing may cache it.
      "cache-control": "no-store",
    },
  });
}

/** 429, with the wait in the header for machines and in the body for the form. */
export function tooMany(message: string, retryAfterS: number): Response {
  return new Response(JSON.stringify({ error: message, retry_after: retryAfterS }), {
    status: 429,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "retry-after": String(retryAfterS),
    },
  });
}

export function cookieOf(req: Request, name: string): string | null {
  const raw = req.headers.get("cookie") || "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

/**
 * The caller's address, for rate limiting and the audit log: the RIGHTMOST
 * x-forwarded-for entry (a client can prepend, not stop the nearest proxy
 * appending); "local" with no proxy.
 */
export const ipOf = (req: Request) => {
  const chain = (req.headers.get("x-forwarded-for") || "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  return chain.length ? chain[chain.length - 1] : "local";
};

/** Parameters from a JSON body OR the query string. The LifeOS preview layer
 *  proxies GET but not POST, so both are accepted. */
export async function params(req: Request): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [k, v] of new URL(req.url).searchParams) out[k] = v;
  if (req.method === "POST") {
    const b = await req.json().catch(() => ({}));
    for (const k of Object.keys(b ?? {})) out[k] = String((b as Record<string, unknown>)[k]);
  }
  return out;
}

/** Every mutation is POST-only: the cookie is SameSite=Lax, which blocks a
 *  cross-site POST but rides along on a top-level GET. */
export function requirePost(req: Request): Response | null {
  return req.method === "POST" ? null : j({ error: "this endpoint requires POST" }, 405);
}
