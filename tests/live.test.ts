/**
 * Live, read-only checks against nyk_mti through the real routes. Skipped
 * unless LIVE_DB=1 (the CI/host may not reach Cloud SQL); then it reads through
 * scripts/wsproxy.ts to the PG* database (see scripts/local-db.ts). Every assertion is
 * about shape and grain, not about a number that will change tomorrow.
 */
import { describe, expect, test } from "bun:test";
import { serve } from "../src/server/app";
import { withDatabase } from "../src/server/db";
import { useLocalDatabase } from "../scripts/local-db";

const live = process.env.LIVE_DB === "1";
if (live) useLocalDatabase(); // needs scripts/wsproxy.ts running and PG* pointing at the proxy
const get = (p: string) => withDatabase(async () => { const r = await serve(new Request("http://127.0.0.1" + p)); return { status: r.status, body: await r.json() }; });

describe.skipIf(!live)("live nyk_mti", () => {
  test("fleet: 5 vessels, each with analysed checks keyed by check_file_id", async () => {
    const { status, body } = await get("/api/fleet");
    expect(status).toBe(200);
    expect(body.vessels.length).toBe(5);
    for (const v of body.vessels) {
      expect(v.imo).toMatch(/^\d{7}$/);
      expect(Array.isArray(v.checks)).toBe(true);
      for (const c of v.checks) { expect(c.cf).toMatch(/^\d{12}$/); expect(c.period).toMatch(/^\d{4}-\d{2}-\d{2}$/); }
    }
    const atlas = body.vessels.find((v: { slug: string }) => v.slug === "atlas-leader");
    expect(atlas.checks.length).toBeGreaterThanOrEqual(29);   // grain = check_file_id, not the 7 year-dossiers
  }, 60_000);
  test("vessel: every day has one check, analysed ones are among them", async () => {
    const { body } = await get("/api/vessel/atlas-leader");
    expect(body.version.version_id).toBe("9531739_202604111901");
    expect(body.dates.length).toBeGreaterThan(1000);
    const days = new Set(body.dates.map((d: { d: string }) => d.d));
    expect(days.size).toBe(body.dates.length);
    for (const c of body.checks) expect(days.has(c.period)).toBe(true);
    expect(body.systems.length).toBeGreaterThanOrEqual(23);   // 23 classified + "Unclassified" when a tag has no system
  }, 60_000);
  test("checklist: 07-Jul-2026 has 1,267 readings in walkaround order with in_range as stored", async () => {
    const { body } = await get("/api/vessel/atlas-leader/checklist/202607071859");
    expect(body.rows.length).toBe(1267);
    expect(body.check.start).toContain("08:43");
    expect(body.rows.filter((r: { oor: boolean }) => r.oor).length).toBeGreaterThan(0);
    expect(body.rows[0].t).toBe("9531739_575");
  }, 60_000);
  test("checklist?tags=: only the asked tags, with thresholds and the noon status on the check date", async () => {
    const { body } = await get("/api/vessel/atlas-leader/checklist/202607071859?tags=9531739_999,9531739_1160,9531739_nope");
    expect(body.rows.map((r: { t: string }) => r.t).sort()).toEqual(["9531739_1160", "9531739_999"]);
    expect(body.check.tags).toBe(3);   // the number of ids asked for (one of them unknown), not the rows found
    expect(body.check.noon_status).toBe("AT SEA");
    expect(body.check.noon_foc).toBeGreaterThan(0);   // the fuel burn the ROB rules measure against
    expect(body.rows.find((r: { t: string }) => r.t === "9531739_999").th.review).toBe(true);
  }, 60_000);
  test("tag: #3CYL feed rate has numeric history and 8 siblings", async () => {
    const { body } = await get("/api/vessel/atlas-leader/tag/9531739_236");
    expect(body.meta.system).toBe("Main Engine");
    expect(body.series.length).toBeGreaterThan(100);
    expect(body.siblings.length).toBe(8);
    // citations come from note.attrs.evidence[] only — this tag has none there (the case files on disk mention it in text)
    expect(Array.isArray(body.citations)).toBe(true);
  }, 60_000);
  test("tag: the Fire Alarm lamp is a state tag with citations", async () => {
    const { body } = await get("/api/vessel/atlas-leader/tag/9531739_999");
    expect(body.series.length).toBe(0);
    expect(body.states.length).toBeGreaterThan(100);
    expect(body.citations.length).toBeGreaterThan(0);
    expect(body.meta.th).toBeTruthy(); expect(body.meta.th.review).toBe(true);   // the threshold row reaches the detail
  }, 60_000);
  test("check 202607071859: evidence borrowed from the retracted version is labelled", async () => {
    const { body } = await get("/api/vessel/atlas-leader/check/202607071859");
    const withEv = body.analyses.filter((a: { evidence: unknown[] }) => a.evidence.length);
    expect(withEv.length).toBeGreaterThan(0);
    expect(withEv.every((a: { evidence_source: string | null }) => a.evidence_source === null || /retracted/.test(a.evidence_source))).toBe(true);
  }, 60_000);
  test("check: findings are postits, analyses are report notes, story is the year narrative", async () => {
    const { body } = await get("/api/vessel/atlas-leader/check/202607071859");
    expect(body.period).toBe("2026-07-07");
    expect(body.analyses.length).toBeGreaterThan(5);
    expect(body.findings.length).toBeGreaterThan(0);
    expect(body.findings.every((f: { severity: string }) => ["high", "medium", "low"].includes(f.severity))).toBe(true);
    expect(body.story.ref).toBe("ATLAS-LEADER-EUMS-CHECK-2026");
  }, 60_000);
  test("every vessel opens: detail + last check + checklist of its last day", async () => {
    const { body: f } = await get("/api/fleet");
    for (const v of f.vessels) {
      const { status, body } = await get(`/api/vessel/${v.slug}`);
      expect(status).toBe(200);
      expect(body.dates.length).toBeGreaterThan(0);
      const last = body.dates[body.dates.length - 1];
      const cl = await get(`/api/vessel/${v.slug}/checklist/${last.cf}`);
      expect(cl.status).toBe(200);
      if (body.checks.length) {
        const ck = await get(`/api/vessel/${v.slug}/check/${body.checks[body.checks.length - 1].cf}`);
        expect(ck.status).toBe(200);
      }
    }
  }, 180_000);
});
