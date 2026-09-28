/**
 * The app's own files out of public/ (and assets/ for the manifest images).
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { PUBLIC } from "./config";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json; charset=utf-8",
};

export function serveStaticFile(path: string): Response {
  if (!existsSync(path)) return new Response("Not found", { status: 404 });
  const ext = path.slice(path.lastIndexOf("."));
  return new Response(Bun.file(path), {
    headers: { "content-type": MIME[ext] ?? "application/octet-stream", "cache-control": "no-cache" },
  });
}

/**
 * index.html with every script and stylesheet inlined. The LifeOS artifact
 * preview's CSP blocks external requests and inline MODULE scripts, so the
 * page is one document and every script is a classic one. Data is fetched
 * from ./api/... with app-relative URLs.
 */
export async function serveIndex(): Promise<Response> {
  const read = (f: string) => Bun.file(join(PUBLIC, f)).text();
  const [html, css, ccss, cjs, coast, comments, weather, ums, umsc, about, story, procjs, skilljs, exjs, nowjs, app] = await Promise.all([
    read("index.html"), read("style.css"), read("components.css"), read("components.js"), read("coast.js"), read("comments.js"), read("weather.js"), read("ums.js"), read("ums-criteria.js"), read("about.js"), read("story.js"), read("process.js"), read("skills.js"), read("example.js"), read("now.js"), read("app.js"),
  ]);
  const inlined = html
    .replace(/<link[^>]+href="components\.css"[^>]*>/, () => `<style>${ccss}</style>`)
    .replace(/<link[^>]+href="style\.css"[^>]*>/, () => `<style>${css}</style>`)
    .replace(/<script[^>]+src="components\.js"[^>]*><\/script>/, () => `<script>${cjs}</script>`)
    .replace(/<script[^>]+src="coast\.js"[^>]*><\/script>/, () => `<script>${coast}</script>`)
    .replace(/<script[^>]+src="comments\.js"[^>]*><\/script>/, () => `<script>${comments}</script>`)
    .replace(/<script[^>]+src="weather\.js"[^>]*><\/script>/, () => `<script>${weather}</script>`)
    .replace(/<script[^>]+src="ums\.js"[^>]*><\/script>/, () => `<script>${ums}</script>`)
    .replace(/<script[^>]+src="ums-criteria\.js"[^>]*><\/script>/, () => `<script>${umsc}</script>`)
    .replace(/<script[^>]+src="about\.js"[^>]*><\/script>/, () => `<script>${about}</script>`)
    .replace(/<script[^>]+src="story\.js"[^>]*><\/script>/, () => `<script>${story}</script>`)
    .replace(/<script[^>]+src="process\.js"[^>]*><\/script>/, () => `<script>${procjs}</script>`)
    .replace(/<script[^>]+src="skills\.js"[^>]*><\/script>/, () => `<script>${skilljs}</script>`)
    .replace(/<script[^>]+src="example\.js"[^>]*><\/script>/, () => `<script>${exjs}</script>`)
    .replace(/<script[^>]+src="now\.js"[^>]*><\/script>/, () => `<script>${nowjs}</script>`)
    .replace(/<script[^>]+src="app\.js"[^>]*><\/script>/, () => `<script>${app}</script>`);
  return new Response(inlined, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" },
  });
}
