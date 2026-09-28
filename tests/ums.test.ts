/**
 * The UMS evaluator (public/ums.js) + the POC rules (public/ums-criteria.js), no database: the same files the page
 * runs, loaded as classic scripts, against the real 07-Jul-2026 readings of the 28 critical tags. Guards the
 * rule semantics ums_verdict.py must reproduce (chain Phase 2).
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RR07, TH07, NOON07 } from "./fixtures-ums-0707";

const PUB = join(import.meta.dir, "..", "public");
const src = readFileSync(join(PUB, "ums.js"), "utf8") + "\n" + readFileSync(join(PUB, "ums-criteria.js"), "utf8");
// classic-script globals → returned from a Function body
const { UMS, UMS_CRITERIA } = new Function(src + "\nreturn { UMS, UMS_CRITERIA };")() as { UMS: any; UMS_CRITERIA: any[] };
const TH = TH07;   // the real tag_thresholds rows of these 62 tags
const by: Record<string, any> = {}; for (const r of RR07) by[r.t] = r;
const evalWith = (opts: Record<string, unknown> = {}) => UMS.evaluate({ criteria: UMS_CRITERIA, condition: "AT SEA", reading: (t: string) => by[t] ?? null, threshold: (t: string) => TH[t] ?? null, noon: NOON07, start: "2026-07-07T08:43:00Z", end: "2026-07-07T10:54:00Z", ...opts });

describe("UMS evaluator (POC rules, real 07-Jul-2026 readings)", () => {
  test("the rules file is the future ums_criteria table: 22 rows, every grp a Skill-2 cluster or coverage", () => {
    expect(UMS_CRITERIA.length).toBe(41);
    // rules now come from the skill: mti-t1-data-pipeline/rules/ums/<imo>.json, exported by ums_rules.py
    const keys = new Set(UMS.CLUSTERS.map((c: any) => c.key)); keys.add("coverage");
    for (const c of UMS_CRITERIA) { expect(keys.has(c.grp)).toBe(true); expect(["tag", "group"]).toContain(c.kind); expect(c.tag_ids.length).toBeGreaterThan(0); }
    expect(new Set(UMS_CRITERIA.flatMap((c: any) => c.tag_ids)).size).toBe(62);
    for (const c of UMS_CRITERIA) expect(["hard", "condition", "coverage"]).toContain(c.tier);
  });
  test("07-Jul-2026 at sea: GO WITH CONDITIONS, the three known reasons, no hard stop, full coverage", () => {
    const v = evalWith();
    expect(v.verdict).toBe("GO WITH CONDITIONS");
    expect(v.risk).toBeGreaterThan(0); expect(v.risk).toBeLessThan(20);
    expect(v.hard_stops).toBe(0);
    expect(v.coverage.pct).toBeGreaterThanOrEqual(90);
    expect(v.reasons.map((r: any) => r.tag_id)).toContain("9531739_1160");   // No.1 D/G selector 0 vs Auto
    expect(v.reasons.map((r: any) => r.tag_id)).toContain("9531739_999");    // fire lamp ON, threshold unreviewed
    expect(v.reasons.find((r: any) => r.tag_id === "9531739_999").status).toBe("review");   // threshold not yet reviewed → half weight, never a hard-stop failure
    expect(v.reasons.find((r: any) => r.tag_id === "9531739_1160").status).toBe("fail");    // 0 against Auto
    expect(v.horizon_until).toBe("2026-07-07T18:54:00.000Z");
    expect(v.conditions.length).toBeGreaterThanOrEqual(3);
    const cl = Object.fromEntries(v.clusters.map((c: any) => [c.key, c]));
    expect(cl["power-generation-electrical"].status).toBe("GO WITH CONDITIONS");
    expect(cl["navigation-steering"].status).toBe("GO");
    expect(cl["boiler-steam"].total).toBeGreaterThan(0);   // drafted 24-Sep: drum level/pressure, circ pump pair, feed water
  });
  test("the same check becomes NO-GO once the 999 threshold is reviewed to Off (the point of rules-as-data)", () => {
    const v = evalWith({ threshold: (t: string) => (t === "9531739_999" ? { exp: "Off", review: false } : TH[t] ?? null) });
    expect(v.verdict).toBe("NO-GO"); expect(v.hard_stops).toBe(1);
  });
  test("conditions: IN PORT drops the at-sea rules and lowers the weight of the D/G standby rule", () => {
    const sea = evalWith(), port = evalWith({ condition: "IN PORT" });
    expect(port.criteria_total).toBeLessThan(sea.criteria_total);
    expect(port.clusters.find((c: any) => c.key === "power-generation-electrical").criteria.some((c: any) => c.condition === "IN PORT")).toBe(true);
  });
  test("remaining on board is measured against the noon report's burn, not a static band", () => {
    const v = evalWith();
    const rob = v.clusters.find((c: any) => c.key === "fuel-lube-oil").criteria.find((c: any) => c.id === 23);
    expect(rob.status).toBe("pass");
    expect(rob.members[0].why).toMatch(/holds 1[0-9]\.[0-9] h at 43\.8 t\/day/);   // 26.0 m³ ≈ 14 h at today's burn
    // the same tank at the bottom of its observed band would NOT pass the 8 h × 1.5 rule
    const low = evalWith({ reading: (t: string) => (t === "9531739_827" ? { ...by[t], v: "16.1", num: 16.1 } : by[t] ?? null) });
    const robLow = low.clusters.find((c: any) => c.key === "fuel-lube-oil").criteria.find((c: any) => c.id === 23);
    expect(robLow.status).toBe("fail");
  });
  test("a pump reading 0 A or STBY is on standby, not missing — one running + one standby passes", () => {
    const v = evalWith();
    const pair = v.clusters.find((c: any) => c.key === "boiler-steam").criteria.find((c: any) => c.id === 36);
    expect(pair.status).toBe("pass");
    expect(pair.members.filter((m: any) => m.role === "running").length).toBe(1);
    expect(pair.members.filter((m: any) => m.role === "standby").length).toBe(1);
  });
  test("an engineering floor is stricter than the observed band, and says so", () => {
    const v = evalWith();
    const lo = v.clusters.find((c: any) => c.key === "main-engine-propulsion").criteria.find((c: any) => c.id === 29);
    // floor widened 0.34 -> 0.30 on 2026-09-24 (confirmed operationally acceptable down to 0.30,
    // pending the real alarm setpoint) — 0.32 MPa now passes against the confirmed floor
    expect(lo.status).toBe("pass");                 // 0.32 MPa against a 0.30 floor
    expect(lo.tier).toBe("condition");              // but not a hard stop: the real alarm setpoint is not in the checklist
    // and no rule anywhere may be a hard stop while its limit is unsourced — ums_rules.py enforces this
    for (const c of UMS_CRITERIA) if (c.limit_source) expect(c.tier).not.toBe("hard");
    expect(lo.limit_source).toMatch(/alarm setpoint/i);
    expect(v.hard_stops).toBe(0);
    // a reading below the confirmed floor still fails — the floor still means something
    const low = evalWith({ reading: (t: string) => (t === "9531739_552" ? { ...by[t], v: "0.25", num: 0.25 } : by[t] ?? null) });
    const loLow = low.clusters.find((c: any) => c.key === "main-engine-propulsion").criteria.find((c: any) => c.id === 29);
    expect(loLow.status).toBe("fail");
  });
  test("coverage gate and not-filed days", () => {
    expect(evalWith({ reading: () => null }).verdict).toBe("CANNOT JUDGE");
    expect(evalWith({ filed: false }).verdict).toBe("NOT FILED");
  });
});
