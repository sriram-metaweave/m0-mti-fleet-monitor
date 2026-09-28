/**
 * The headers every response carries.
 *
 * Framing, form targets and plugins are ENFORCED. script-src and friends are
 * REPORT-ONLY: the client drives itself with inline `onclick=` handlers, which
 * a strict script-src would silently disable.
 */
import { FRAME_ANCESTORS } from "./config";

export function securityHeaders(isHtml: boolean): Record<string, string> {
  const h: Record<string, string> = {
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "geolocation=(), camera=(), microphone=(), payment=()",
    "strict-transport-security": "max-age=63072000; includeSubDomains",
  };
  if (!isHtml) return h;
  h["content-security-policy"] = [
    "object-src 'none'",
    "form-action 'self'",
    `frame-ancestors ${FRAME_ANCESTORS}`,
  ].join("; ");
  h["content-security-policy-report-only"] = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "form-action 'self'",
    `frame-ancestors ${FRAME_ANCESTORS}`,
  ].join("; ");
  return h;
}

/** Add headers a response does not already carry. */
export function applyHeaders(res: Response, add: Record<string, string>): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(add)) if (!headers.has(k)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export function withSecurityHeaders(res: Response): Response {
  const isHtml = /^text\/html/i.test(res.headers.get("content-type") ?? "");
  return applyHeaders(res, securityHeaders(isHtml));
}
