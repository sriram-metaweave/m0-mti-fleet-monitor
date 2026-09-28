/**
 * Process-wide settings, read once from the environment.
 */
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// The lifeos-app contract: the host always supplies PORT. Honour it when
// present, but do not hard-fail without it — Vercel's Bun runtime never sets
// PORT (it calls the exported handler directly, no Bun.serve involved).
export const DEFAULT_PORT = 6006;
const envPort = Number(process.env.PORT);
export const port = Number.isInteger(envPort) && envPort > 0 ? envPort : DEFAULT_PORT;

// On Vercel the function bundle is unpacked at the task root and cwd is that
// root. Everywhere else it is the repo root, two levels up from this file.
export const ON_VERCEL = !!process.env.VERCEL;
export const APP_DIR = ON_VERCEL
  ? process.cwd()
  : resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const PUBLIC = join(APP_DIR, "public");

/** The app's name, on /api/health. */
export const APP_TAG = "m0-checklist-monitoring-system";
export const APP_TITLE = "M0 Checklist Monitoring System";

/** Pin the business. Empty = every vessel entity regardless of domain. */
export const DOMAIN_SLUG = (process.env.DOMAIN_SLUG ?? "").trim();

/**
 * Which origins may frame this app. 'self' always; FRAME_ANCESTORS adds the
 * LifeOS preview origin, space separated.
 */
export const FRAME_ANCESTORS =
  ("'self' " + (process.env.FRAME_ANCESTORS ?? "")).trim().replace(/\s+/g, " ");
