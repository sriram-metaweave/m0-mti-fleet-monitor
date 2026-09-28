/**
 * Router tests — no database needed: static files, the health route, and the
 * input guards. Run with `bun test` (PORT is set in bunfig preload).
 */
import { describe, expect, test } from "bun:test";
import { serve, pathParts } from "../src/server/app";

const req = (p: string) => new Request("http://127.0.0.1" + p);

describe("router", () => {
  test("health answers without a database", async () => {
    const r = await serve(req("/api/health"));
    expect(r.status).toBe(200);
    const b = await r.json();
    expect(b.ok).toBe(1);
    expect(b.title).toBe("M0 Checklist Monitoring System");
  });
  test("index inlines the component library and the app script", async () => {
    const r = await serve(req("/"));
    expect(r.status).toBe(200);
    const html = await r.text();
    expect(html).toContain("M0 Checklist Monitoring System");
    expect(html).toContain("UI.mountGlobe");   // components.js inlined
    expect(html).toContain("loadFleet();");    // app.js inlined
    expect(html).toContain("UI.aboutPage");    // the "How it works" page + its data (about.js) inlined
    expect(html).toContain("const ABOUT");
    expect(html).toContain("const STORY");   // the two project pages
    expect(html).toContain("const SKILLS");  // the skills page
    expect(html).not.toMatch(/<script[^>]+src="app\.js"/);
  });
  test("static files are served by name, nothing else", async () => {
    expect((await serve(req("/components.css"))).status).toBe(200);
    expect((await serve(req("/coast.js"))).status).toBe(200);
    expect((await serve(req("/server.ts"))).status).toBe(404);
    expect((await serve(req("/.env.app"))).status).toBe(404);
  });
  test("api prefix is tolerated (preview proxy) and bad ids are refused", async () => {
    expect((await serve(req("/artifact-preview/tok/api/health"))).status).toBe(200);
    expect((await serve(req("/api/vessel/../x"))).status).toBe(404); // the URL parser folds ".." before the router sees it
    expect((await serve(req("/api/vessel/bad slug"))).status).toBe(400);
    expect((await serve(req("/api/vessel/atlas-leader/noon?since=nope"))).status).toBe(400);
    expect((await serve(req("/api/nothing"))).status).toBe(404);
  });
  test("only GET", async () => {
    expect((await serve(new Request("http://127.0.0.1/api/fleet", { method: "POST" }))).status).toBe(405);
  });
  test("pathParts refuses encoded separators", () => {
    expect(pathParts("/a/%2F/b")).toBeNull();
    expect(pathParts("/a/b/")).toEqual(["a", "b"]);
  });
});
