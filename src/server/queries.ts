/**
 * The read-only query layer — one function per API route, every one written
 * from DATA-MAPPING.md (02-MTI/presentation-2026-09-24/app-understanding/mockup-v4).
 *
 * Grain decisions taken here (the "to be checked" markers of the mockup):
 *   - a CHECK is the set of report notes sharing attrs->>'check_file_id'
 *     (a dossier is one vessel-YEAR since 22-Sep-2026, so it is not the grain)
 *   - FINDINGS are postit notes; their date is attrs->>'applies_to', falling
 *     back to the report note they are about (about_note_id), else undated
 *   - EVIDENCE for a finding: the report note it is about (about_note_id),
 *     else the report note of the same check + perspective
 *   - the expected BAND is check_readable.min_val/max_val — what the reading
 *     was judged against when it was filed; OUT OF RANGE is in_range = false
 *   - the STORY is dossier.narrative of that vessel-year
 *
 * Tables: living_office.entity / dossier / note · m0_check_reports.master_versions /
 * master_tags / tag_classification / check_raw / check_readable · noon_report.readable
 */
import { sql } from "./db";
import { DOMAIN_SLUG } from "./config";

/* ── vessels ────────────────────────────────────────────────────────── */

export type Vessel = { id: number; slug: string; name: string; imo: string; type: string | null };

export async function vessels(): Promise<Vessel[]> {
  const rows = await sql`
    SELECT id::int, slug, name, attrs->>'imo' AS imo, attrs->>'vessel_type' AS type
    FROM living_office.entity
    WHERE type = 'vessel' AND active IS DISTINCT FROM false
      ${DOMAIN_SLUG ? sql`AND domain_slug = ${DOMAIN_SLUG}` : sql``}
    ORDER BY name`;
  return rows as unknown as Vessel[];
}

export async function vesselBySlug(slug: string): Promise<Vessel | null> {
  const all = await vessels();
  return all.find((v) => v.slug === slug) ?? null;
}

/* ── analysed checks: report notes grouped by check_file_id ─────────── */

export type Check = {
  cf: string; period: string; health: number | null; status: string;
  clusters: number; scored: number; poor: number; flagged: number;
  high: number; medium: number; low: number; items: number; actions: number;
};

const STATUS = (h: number | null) => h == null ? "NOT SCORED" : h >= 83 ? "GOOD" : h >= 73 ? "SATISFACTORY" : "POOR";

/** Every analysed check of one vessel (or all vessels when entityId is null), oldest first. */
export async function checks(entityId: number | null): Promise<(Check & { entity_id: number })[]> {
  const rep = await sql`
    SELECT d.entity_id::int, n.attrs->>'check_file_id' AS cf,
           min(n.attrs->>'period') FILTER (WHERE (n.attrs->>'period') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}') AS period,
           round(avg((n.attrs->>'score')::numeric) FILTER (WHERE (n.attrs->>'score') ~ '^[0-9]+([.][0-9]+)?$'), 1)::float AS health,
           count(DISTINCT coalesce(n.perspective, ''))::int AS clusters,
           count(*) FILTER (WHERE (n.attrs->>'score') ~ '^[0-9]+([.][0-9]+)?$')::int AS scored,
           count(*) FILTER (WHERE n.attrs->>'status' = 'POOR')::int AS poor,
           count(*) FILTER (WHERE coalesce(n.attrs->>'overall_flag', 'none') <> 'none')::int AS flagged
    FROM living_office.note n
    JOIN living_office.dossier d ON d.id = n.dossier_id
    WHERE n.type = 'report' AND n.retracted_at IS NULL AND n.attrs->>'check_file_id' IS NOT NULL
      ${entityId != null ? sql`AND d.entity_id = ${entityId}` : sql``}
    GROUP BY 1, 2
    HAVING min(n.attrs->>'period') IS NOT NULL
    ORDER BY period, cf`;
  const post = await sql`
    SELECT d.entity_id::int, coalesce(n.attrs->>'applies_to', r.attrs->>'period') AS period,
           coalesce(n.importance, 'low') AS importance, count(*)::int AS n,
           count(*) FILTER (WHERE nullif(trim(n.attrs->>'action_required'), '') IS NOT NULL)::int AS actions
    FROM living_office.note n
    JOIN living_office.dossier d ON d.id = n.dossier_id
    LEFT JOIN living_office.note r ON r.id = n.about_note_id
    WHERE n.type = 'postit' AND n.retracted_at IS NULL AND coalesce(n.perspective, '') <> 'daily-overview'
      ${entityId != null ? sql`AND d.entity_id = ${entityId}` : sql``}
    GROUP BY 1, 2, 3`;
  const counts = new Map<string, { high: number; medium: number; low: number; items: number; actions: number }>();
  for (const p of post as unknown as { entity_id: number; period: string | null; importance: string; n: number; actions: number }[]) {
    if (!p.period) continue;
    const k = `${p.entity_id}|${p.period}`;
    const c = counts.get(k) ?? { high: 0, medium: 0, low: 0, items: 0, actions: 0 };
    const imp = (p.importance === "high" || p.importance === "medium") ? p.importance : "low";
    c[imp] += p.n; c.items += p.n; c.actions += p.actions;
    counts.set(k, c);
  }
  return (rep as unknown as { entity_id: number; cf: string; period: string; health: number | null; clusters: number; scored: number; poor: number; flagged: number }[])
    .map((r) => {
      const c = counts.get(`${r.entity_id}|${r.period}`) ?? { high: 0, medium: 0, low: 0, items: 0, actions: 0 };
      return { ...r, status: STATUS(r.health), ...c };
    });
}

/* ── the fleet ──────────────────────────────────────────────────────── */

export async function fleet() {
  const vs = await vessels();
  const all = await checks(null);
  const noon = await sql`
    SELECT DISTINCT ON (imo) imo, to_char(report_date AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS d, status, port_name AS port, lat::float, long::float AS lon
    FROM noon_report.readable ORDER BY imo, report_date DESC, rec_seq DESC NULLS LAST`;
  const noonBy = new Map((noon as unknown as { imo: string }[]).map((n) => [n.imo, n]));
  const spanRows = await sql`SELECT min(check_date)::date AS a, max(check_date)::date AS b FROM m0_check_reports.check_raw`;
  const span = spanRows[0] as unknown as { a: Date | null; b: Date | null };
  return {
    vessels: vs.map((v) => ({
      ...v,
      checks: all.filter((c) => c.entity_id === v.id).map(({ entity_id: _e, ...c }) => c),
      noon: noonBy.get(v.imo) ?? null,
    })),
    span: [iso(span.a), iso(span.b)],
  };
}

const iso = (d: Date | string | null) => d == null ? null : (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));

/* ── one vessel: checks, every check date, systems, master version ──── */

export async function vesselDetail(v: Vessel) {
  const [ch, version, dates, systems, span] = await Promise.all([
    checks(v.id),
    sql`SELECT version_id, valid_from::date AS valid_from, tag_count::int FROM m0_check_reports.master_versions
        WHERE imo = ${v.imo} ORDER BY (valid_to IS NULL) DESC, valid_from DESC LIMIT 1`,
    // one entry per calendar day: the check with the most readings that day (some checks were filed empty)
    sql`WITH cnt AS (
          SELECT check_file_id, count(*)::int AS n FROM m0_check_reports.check_readable WHERE imo = ${v.imo} GROUP BY 1),
        per AS (
          SELECT r.check_file_id AS cf, to_char(r.check_date AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS d,
                 r.walkaround_start_ts AS start_ts, r.walkaround_end_ts AS end_ts, r.master_version_id AS version, coalesce(c.n, 0) AS n
          FROM m0_check_reports.check_raw r LEFT JOIN cnt c ON c.check_file_id = r.check_file_id WHERE r.imo = ${v.imo})
        SELECT DISTINCT ON (d) d, cf, start_ts, end_ts, version, n FROM per ORDER BY d, n DESC, cf DESC`,
    sql`SELECT coalesce(nullif(trim(c.system), ''), 'Unclassified') AS system, count(*)::int AS tags
        FROM m0_check_reports.tag_classification c
        JOIN m0_check_reports.master_versions v ON v.imo = c.imo AND v.version_id = c.version_id
        WHERE c.imo = ${v.imo} AND v.valid_to IS NULL
        GROUP BY 1 ORDER BY 2 DESC`,
    sql`SELECT min(check_date)::date AS a, max(check_date)::date AS b FROM m0_check_reports.check_raw`,
  ]);
  const sp = span[0] as unknown as { a: Date | null; b: Date | null };
  return {
    vessel: v,
    version: (version[0] as unknown as { version_id: string; valid_from: Date; tag_count: number } | undefined) ?? null,
    checks: ch.map(({ entity_id: _e, ...c }) => c),
    dates: (dates as unknown as { d: string; cf: string; start_ts: Date | null; end_ts: Date | null; version: string; n: number }[])
      .map((r) => ({ d: r.d, cf: r.cf, start: r.start_ts ? r.start_ts.toISOString() : null, end: r.end_ts ? r.end_ts.toISOString() : null, version: r.version, n: r.n })),
    systems: systems as unknown as { system: string; tags: number }[],
    span: [iso(sp.a), iso(sp.b)],
  };
}

/* ── the tags of the current master version ─────────────────────────── */

export async function tags(v: Vessel) {
  const rows = await sql`
    SELECT t.tag_id AS id, t.tag_name AS name, t.unit_or_state AS unit, t.min_val::float AS lo, t.max_val::float AS hi,
           coalesce(nullif(trim(c.system), ''), 'Unclassified') AS system, coalesce(nullif(trim(c.equipment), ''), 'Other') AS equipment
    FROM m0_check_reports.master_tags t
    JOIN m0_check_reports.master_versions v ON v.imo = t.imo AND v.version_id = t.version_id AND v.valid_to IS NULL
    LEFT JOIN m0_check_reports.tag_classification c ON c.imo = t.imo AND c.version_id = t.version_id AND c.tag_id = t.tag_id
    WHERE t.imo = ${v.imo}
    ORDER BY t.id`;
  // how many report notes cite each tag in their evidence[]
  const cites = await sql`
    SELECT e->>'tag_id' AS id, count(DISTINCT n.id)::int AS n
    FROM living_office.note n, jsonb_array_elements(n.attrs->'evidence') e
    WHERE n.type = 'report' AND n.retracted_at IS NULL AND n.attrs->>'imo' = ${v.imo}
      AND jsonb_typeof(n.attrs->'evidence') = 'array'
    GROUP BY 1`;
  const cmap = new Map((cites as unknown as { id: string; n: number }[]).map((c) => [c.id, c.n]));
  const out: Record<string, { name: string; unit: string; lo: number | null; hi: number | null; system: string; equipment: string; cited: number }> = {};
  for (const r of rows as unknown as { id: string; name: string; unit: string | null; lo: number | null; hi: number | null; system: string; equipment: string }[]) {
    out[r.id] = { name: r.name ?? r.id, unit: r.unit ?? "", lo: r.lo, hi: r.hi, system: r.system, equipment: r.equipment, cited: cmap.get(r.id) ?? 0 };
  }
  return out;
}

/* ── one walkaround: every reading, in reading order ─────────────────── */

/** tag_thresholds.valid_states grammar: `State:normal|TBD|abnormal(seen=N,P%[,NOT IN DECLARED SET])|…` — the same
 *  string MTI's cleanup viewer parses; parsed once here so the app never re-implements it. */
export function parseStates(vs: string | null): { s: string; review: string; seen: number | null; pct: number | null; undeclared: boolean }[] {
  if (!vs) return [];
  return vs.split("|").map((part) => {
    const i = part.indexOf(":"); if (i < 0) return null;
    const st = part.slice(0, i).trim(), rest = part.slice(i + 1);
    const review = rest.split("(")[0]!.trim();
    const seen = /seen=(\d+)/.exec(rest), pct = /,(\d+)%/.exec(rest);
    return { s: st, review, seen: seen ? +seen[1]! : null, pct: pct ? +pct[1]! : null, undeclared: rest.includes("NOT IN DECLARED SET") };
  }).filter((x): x is NonNullable<typeof x> => !!x);
}

const thCache = new Map<string, { at: number; rows: Map<string, ThRow> }>();
type ThRow = { emin: number | null; emax: number | null; amin: number | null; amax: number | null; exp: string | null; states: ReturnType<typeof parseStates>; standby: string | null; ctx: string | null; bands: unknown; source: string | null; conf: string | null; review: boolean };
/** tag_thresholds for one (imo, version) — the table MTI is cleaning; cached 10 min, parsed once. */
export async function thresholds(imo: string, version: string): Promise<Map<string, ThRow>> {
  const k = imo + "|" + version; const c = thCache.get(k);
  if (c && Date.now() - c.at < 10 * 60_000) return c.rows;
  const rows = await sql`
    SELECT tag_id, expected_min::float AS emin, expected_max::float AS emax, acceptable_min::float AS amin, acceptable_max::float AS amax,
           nullif(btrim(expected_normal_state), '') AS exp, valid_states AS vs, standby_marker AS standby, context_tag_id AS ctx,
           state_bands AS bands, source, confidence AS conf, needs_review AS review
    FROM m0_check_reports.tag_thresholds WHERE imo = ${imo} AND version_id = ${version}`;
  const m = new Map<string, ThRow>();
  for (const r of rows as unknown as { tag_id: string; emin: number | null; emax: number | null; amin: number | null; amax: number | null; exp: string | null; vs: string | null; standby: string | null; ctx: string | null; bands: unknown; source: string | null; conf: string | null; review: boolean | null }[])
    m.set(r.tag_id, { emin: r.emin, emax: r.emax, amin: r.amin, amax: r.amax, exp: r.exp, states: parseStates(r.vs), standby: r.standby, ctx: r.ctx, bands: r.bands, source: r.source, conf: r.conf, review: !!r.review });
  thCache.set(k, { at: Date.now(), rows: m });
  return m;
}

export async function checklist(v: Vessel, cf: string, tags: string[] | null = null) {
  const raw = await sql`SELECT check_file_id AS cf, to_char(check_date AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS d, check_date, walkaround_start_ts AS start_ts, walkaround_end_ts AS end_ts, master_version_id AS version
      FROM m0_check_reports.check_raw WHERE imo = ${v.imo} AND check_file_id = ${cf} LIMIT 1`;
  const h = raw[0] as unknown as { cf: string; d: string; check_date: Date; start_ts: Date | null; end_ts: Date | null; version: string } | undefined;
  if (!h) return { check: null, rows: [] };
  const readRows = (cfid: string) => sql`
    SELECT r.tag_id AS t, coalesce(r.tag_name, r.tag_id) AS n, r.value AS v, r.value_numeric::float AS num, r.unit_or_state AS u,
           r.min_val::float AS mn, r.max_val::float AS mx, r.in_range AS ok, to_char(r.reading_ts AT TIME ZONE 'UTC', 'HH24:MI') AS ts,
           coalesce(nullif(trim(c.system), ''), 'Unclassified') AS s, coalesce(nullif(trim(c.equipment), ''), 'Other') AS e
    FROM m0_check_reports.check_readable r
    LEFT JOIN m0_check_reports.tag_classification c ON c.imo = r.imo AND c.version_id = ${h.version} AND c.tag_id = r.tag_id
    WHERE r.imo = ${v.imo} AND r.check_file_id = ${cfid}${tags ? sql` AND r.tag_id = ANY(${tags})` : sql``}
    ORDER BY r.reading_ts NULLS LAST, r.id`;
  // PREVIOUS = the same tag on the previous filed walkaround that has readings (some were filed empty). The
  // `check_readable_with_prev` view of SCHEMA-AND-UI-PLAN.md B.3 replaces this once the DDL is run.
  const prevCands = await sql`SELECT check_file_id AS cf, to_char(check_date AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS d FROM m0_check_reports.check_raw
      WHERE imo = ${v.imo} AND check_date < ${h.check_date} ORDER BY check_date DESC LIMIT 3`;
  // the voyage condition the UMS rules key on: noon_report.readable.status on (or last before) the check date
  const noonQ = sql`SELECT status AS st, to_char(report_date AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS d, total_foc_day::float AS foc FROM noon_report.readable
      WHERE imo = ${v.imo} AND report_date <= ${h.check_date} AND status IS NOT NULL ORDER BY report_date DESC, rec_seq DESC NULLS LAST LIMIT 1`;
  const [rows, th, noonRow] = await Promise.all([readRows(cf), thresholds(v.imo, h.version), noonQ]);
  const noon = (noonRow as unknown as { st: string; d: string; foc: number | null }[])[0] ?? null;
  let prev: { cf: string; d: string; rows: unknown[] } | null = null;
  for (const pc of prevCands as unknown as { cf: string; d: string }[]) { const pr = await readRows(pc.cf); if (pr.length) { prev = { cf: pc.cf, d: pc.d, rows: pr }; break; } }
  const prevBy = new Map((prev ? prev.rows : [] as unknown[]).map((r) => [(r as { t: string }).t, r as { v: string | null }]));
  type R = { t: string; n: string; v: string | null; num: number | null; u: string | null; mn: number | null; mx: number | null; ok: boolean | null; ts: string | null; s: string; e: string };
  return {
    check: { cf: h.cf, d: h.d, start: h.start_ts?.toISOString() ?? null, end: h.end_ts?.toISOString() ?? null, version: h.version, prev_cf: prev?.cf ?? null, prev_d: prev?.d ?? null,
      noon_status: noon?.st ?? null, noon_d: noon?.d ?? null, noon_foc: noon?.foc ?? null, tags: tags ? tags.length : null },
    rows: (rows as unknown as R[]).map((r) => {
      const p = prevBy.get(r.t); const t = th.get(r.t) ?? null;
      return { t: r.t, n: r.n, v: r.v ?? "", num: r.num, u: r.u ?? "", mn: r.mn, mx: r.mx, oor: r.ok === false, judged: r.ok !== null, ts: r.ts ?? "", s: r.s, e: r.e,
        prev: p ? { v: p.v ?? "", cf: prev!.cf, d: prev!.d } : null, th: t };
    }),
  };
}

/* ── one tag: full history, citations, siblings ─────────────────────── */

const SIB_IDX = /\bno\.?\s*(\d+)\b|#\s*(\d+)(?=\D|$)|\b(\d+)(?:st|nd|rd|th)\b|\bcyl(?:inder)?\.?\s*(\d+)\b/gi;
/** Same rule as the mockup: tags of one system whose names are equal after removing exactly one index token. */
export function siblingKey(system: string, name: string): { key: string; idx: number } | null {
  const ms = [...(name ?? "").matchAll(SIB_IDX)];
  if (ms.length !== 1) return null;
  const m = ms[0]!; const idx = +(m[1] ?? m[2] ?? m[3] ?? m[4]);
  let key = name.slice(0, m.index) + "§" + name.slice(m.index! + m[0].length);
  key = key.replace(/\b\d{2,3}\s*(?=§)/, "").replace(/\s+/g, " ").trim();
  return { key: system + "|" + key, idx };
}

export async function tagDetail(v: Vessel, tagId: string) {
  const [meta, series, cites] = await Promise.all([
    sql`SELECT t.tag_id AS id, t.tag_name AS name, t.unit_or_state AS unit, t.min_val::float AS lo, t.max_val::float AS hi, t.version_id AS version,
               coalesce(nullif(trim(c.system), ''), 'Unclassified') AS system, coalesce(nullif(trim(c.equipment), ''), 'Other') AS equipment
        FROM m0_check_reports.master_tags t
        JOIN m0_check_reports.master_versions v ON v.imo = t.imo AND v.version_id = t.version_id AND v.valid_to IS NULL
        LEFT JOIN m0_check_reports.tag_classification c ON c.imo = t.imo AND c.version_id = t.version_id AND c.tag_id = t.tag_id
        WHERE t.imo = ${v.imo} AND t.tag_id = ${tagId} LIMIT 1`,
    sql`SELECT to_char(check_date AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS d, check_file_id AS cf, value AS v, value_numeric::float AS n, in_range AS ok
        FROM m0_check_reports.check_readable WHERE imo = ${v.imo} AND tag_id = ${tagId} ORDER BY check_date, id`,
    sql`SELECT n.attrs->>'period' AS period, coalesce(n.perspective, '') AS perspective, n.attrs->>'check_file_id' AS cf,
               left(regexp_replace(n.body, '\\s+', ' ', 'g'), 320) AS excerpt, e->>'value' AS value
        FROM living_office.note n, jsonb_array_elements(n.attrs->'evidence') e
        WHERE n.type = 'report' AND n.retracted_at IS NULL AND n.attrs->>'imo' = ${v.imo}
          AND jsonb_typeof(n.attrs->'evidence') = 'array' AND e->>'tag_id' = ${tagId}
        ORDER BY n.attrs->>'period' DESC, n.id`,
  ]);
  const m = meta[0] as unknown as { id: string; name: string; unit: string | null; lo: number | null; hi: number | null; version: string; system: string; equipment: string } | undefined;
  // the tag_thresholds row (what MTI cleans by hand) — shown in the detail header, the last step of every drill-down
  const th = m ? ((await thresholds(v.imo, m.version)).get(tagId) ?? null) : null;
  // siblings: same system, same name after removing one index token
  let siblings: { id: string; idx: number; name: string }[] = [];
  if (m) {
    const sk = siblingKey(m.system, m.name ?? "");
    if (sk) {
      const same = await sql`
        SELECT t.tag_id AS id, t.tag_name AS name
        FROM m0_check_reports.master_tags t
        JOIN m0_check_reports.master_versions v ON v.imo = t.imo AND v.version_id = t.version_id AND v.valid_to IS NULL
        LEFT JOIN m0_check_reports.tag_classification c ON c.imo = t.imo AND c.version_id = t.version_id AND c.tag_id = t.tag_id
        WHERE t.imo = ${v.imo} AND coalesce(nullif(trim(c.system), ''), 'Unclassified') = ${m.system}`;
      for (const r of same as unknown as { id: string; name: string }[]) {
        const k = siblingKey(m.system, r.name ?? "");
        if (k && k.key === sk.key) siblings.push({ id: r.id, idx: k.idx, name: r.name });
      }
      siblings.sort((a, b) => a.idx - b.idx);
      if (siblings.length < 2) siblings = [];
    }
  }
  const pts: [string, number][] = [], states: [string, string][] = [];
  for (const r of series as unknown as { d: string; cf: string; v: string | null; n: number | null; ok: boolean | null }[]) {
    if (r.n != null) pts.push([r.d, r.n]);
    else if (r.v != null && r.v !== "" && r.v !== "-") states.push([r.d, r.v]);
  }
  return {
    meta: m ? { id: m.id, name: m.name ?? m.id, unit: m.unit ?? "", lo: m.lo, hi: m.hi, system: m.system, equipment: m.equipment, th } : null,
    series: pts, states,
    citations: cites as unknown as { period: string; perspective: string; cf: string; excerpt: string; value: string | null }[],
    siblings,
    family: m ? (siblingKey(m.system, m.name ?? "")?.key.split("|")[1]?.replace("§", "…") ?? "") : "",
  };
}

/** 90-day (or any window) numeric/state series for every tag of one system, or for a list of tag ids — the row sparklines. */
export async function systemSeries(v: Vessel, system: string, from: string, to: string, tagIds: string[] | null = null) {
  const rows = tagIds ? await sql`
    SELECT r.tag_id AS id, to_char(r.check_date AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS d, r.value_numeric::float AS n, r.value AS v
    FROM m0_check_reports.check_readable r
    WHERE r.imo = ${v.imo} AND r.tag_id = ANY(${tagIds})
      AND r.check_date >= ${from}::date AND r.check_date < (${to}::date + 1)
    ORDER BY r.tag_id, r.check_date, r.id` : await sql`
    SELECT r.tag_id AS id, to_char(r.check_date AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS d, r.value_numeric::float AS n, r.value AS v
    FROM m0_check_reports.check_readable r
    JOIN m0_check_reports.master_versions mv ON mv.imo = r.imo AND mv.valid_to IS NULL
    JOIN m0_check_reports.tag_classification c ON c.imo = r.imo AND c.version_id = mv.version_id AND c.tag_id = r.tag_id
    WHERE r.imo = ${v.imo} AND coalesce(nullif(trim(c.system), ''), 'Unclassified') = ${system}
      AND r.check_date >= ${from}::date AND r.check_date < (${to}::date + 1)
    ORDER BY r.tag_id, r.check_date, r.id`;
  const out: Record<string, { p: [string, number][]; s: [string, string][] }> = {};
  for (const r of rows as unknown as { id: string; d: string; n: number | null; v: string | null }[]) {
    const o = out[r.id] ?? (out[r.id] = { p: [], s: [] });
    if (r.n != null) o.p.push([r.d, r.n]); else if (r.v && r.v !== "-") o.s.push([r.d, r.v]);
  }
  return out;
}

/* ── one analysed check: findings, analyses, story ──────────────────── */

const SYNTH = "daily-overview";
const headline = (body: string) => {
  const t = (body ?? "").replace(/\s+/g, " ").trim();
  const m = t.match(/^(.{20,180}?[.!?])(\s|$)/);
  return (m ? m[1] : t.slice(0, 160)) as string;
};
const sev = (imp: string | null) => (imp === "high" || imp === "medium") ? imp : "low";

export async function checkDetail(v: Vessel, cf: string) {
  const reports = await sql`
    SELECT n.id::int, coalesce(n.perspective, '') AS perspective, n.title, n.body,
           (n.attrs->>'score')::float AS score, n.attrs->>'status' AS status, n.attrs->>'confidence' AS confidence,
           n.attrs->>'overall_flag' AS overall_flag, n.attrs->>'period' AS period, n.attrs->'findings' AS findings, n.attrs->'evidence' AS evidence,
           n.dossier_id::int
    FROM living_office.note n JOIN living_office.dossier d ON d.id = n.dossier_id
    WHERE n.type = 'report' AND n.retracted_at IS NULL AND d.entity_id = ${v.id} AND n.attrs->>'check_file_id' = ${cf}
    ORDER BY n.perspective`;
  const reps = reports as unknown as { id: number; perspective: string; title: string; body: string; score: number | null; status: string | null; confidence: string | null; overall_flag: string | null; period: string; findings: unknown; evidence: unknown; dossier_id: number }[];
  if (!reps.length) return null;
  const period = reps.find((r) => r.period)?.period ?? null;
  const ids = reps.map((r) => r.id);
  // DATA GAP (found 23-Sep-2026): some live report notes were re-written without their evidence[] (e.g. every note of
  // check 202607071859 on 20/21-Sep); the readings they cited survive only on the retracted earlier version. Borrow
  // that evidence, and say so on every card (evidence_source).
  const missing = reps.filter((r) => !Array.isArray(r.evidence) || !(r.evidence as unknown[]).length).map((r) => r.perspective);
  const borrowed = new Map<string, { id: number; evidence: unknown }>();
  if (missing.length) {
    const old = await sql`
      SELECT DISTINCT ON (coalesce(n.perspective, '')) coalesce(n.perspective, '') AS perspective, n.id::int, n.attrs->'evidence' AS evidence
      FROM living_office.note n JOIN living_office.dossier d ON d.id = n.dossier_id
      WHERE n.type = 'report' AND n.retracted_at IS NOT NULL AND d.entity_id = ${v.id} AND n.attrs->>'check_file_id' = ${cf}
        AND coalesce(n.perspective, '') = ANY(${missing}) AND jsonb_typeof(n.attrs->'evidence') = 'array' AND jsonb_array_length(n.attrs->'evidence') > 0
      ORDER BY coalesce(n.perspective, ''), n.retracted_at DESC, n.id DESC`;
    for (const o of old as unknown as { perspective: string; id: number; evidence: unknown }[]) borrowed.set(o.perspective, { id: o.id, evidence: o.evidence });
  }
  for (const r of reps) { const b = borrowed.get(r.perspective); if (b && (!Array.isArray(r.evidence) || !(r.evidence as unknown[]).length)) { r.evidence = b.evidence; (r as unknown as { evidence_source: string }).evidence_source = `retracted earlier version (note ${b.id})`; } }
  const postits = await sql`
    SELECT n.id::int, coalesce(n.perspective, '') AS perspective, coalesce(n.importance, n.attrs->>'importance', 'low') AS importance, n.body,
           nullif(trim(n.attrs->>'action_required'), '') AS action_required, n.attrs->>'applies_to' AS applies_to,
           n.attrs->>'written_at' AS written_at, n.attrs->>'pattern_flag' AS pattern_flag, n.about_note_id::int, n.attrs->'evidence' AS own_evidence
    FROM living_office.note n JOIN living_office.dossier d ON d.id = n.dossier_id
    WHERE n.type = 'postit' AND n.retracted_at IS NULL AND d.entity_id = ${v.id}
      AND (n.attrs->>'applies_to' = ${period} OR n.about_note_id = ANY(${ids}))
    ORDER BY n.id`;
  const byPersp = new Map(reps.map((r) => [r.perspective, r]));
  const rank: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const findings = (postits as unknown as { id: number; perspective: string; importance: string; body: string; action_required: string | null; applies_to: string | null; written_at: string | null; pattern_flag: string | null; about_note_id: number | null; own_evidence: unknown }[])
    .filter((p) => p.perspective !== SYNTH)
    .map((p) => {
      const rep = (p.about_note_id && reps.find((r) => r.id === p.about_note_id)) || byPersp.get(p.perspective) || null;
      const ev = Array.isArray(p.own_evidence) && (p.own_evidence as unknown[]).length ? p.own_evidence : (rep && Array.isArray(rep.evidence) ? rep.evidence : []);
      return {
        id: p.id, perspective: p.perspective, severity: sev(p.importance), importance: p.importance,
        headline: headline(p.body), body: p.body, action_required: p.action_required, applies_to: p.applies_to,
        written_at: p.written_at, pattern_flag: p.pattern_flag, about_note_id: p.about_note_id,
        evidence: (ev as { tag_id?: string; label?: string; value?: string }[]).filter((e) => e && e.tag_id).slice(0, 12),
        evidence_from: (Array.isArray(p.own_evidence) && (p.own_evidence as unknown[]).length ? "the postit itself" : (p.about_note_id ? "the report note it is about" : "the report note of the same check + perspective")) + (rep && (rep as unknown as { evidence_source?: string }).evidence_source ? ` — ${(rep as unknown as { evidence_source: string }).evidence_source}` : ""),
      };
    })
    .sort((a, b) => rank[a.severity]! - rank[b.severity]! || a.id - b.id);
  const synthesis = (postits as unknown as { perspective: string; body: string }[]).find((p) => p.perspective === SYNTH) ?? null;
  const year = period ? period.slice(0, 4) : null;
  const story = year ? await sql`
    SELECT ref, title, narrative, next_step FROM living_office.dossier
    WHERE entity_id = ${v.id} AND ref LIKE ${"%-" + year} ORDER BY id LIMIT 1` : [];
  const scored = reps.filter((r) => r.score != null);
  const health = scored.length ? Math.round(scored.reduce((s, r) => s + (r.score as number), 0) / scored.length * 10) / 10 : null;
  return {
    cf, period, health, status: STATUS(health),
    counts: { clusters: reps.length, scored: scored.length, poor: reps.filter((r) => r.status === "POOR").length,
      items: findings.length, high: findings.filter((f) => f.severity === "high").length, medium: findings.filter((f) => f.severity === "medium").length, low: findings.filter((f) => f.severity === "low").length },
    findings,
    synthesis: synthesis ? synthesis.body : null,
    analyses: reps.map((r) => ({ id: r.id, perspective: r.perspective, title: r.title, score: r.score, status: r.status, confidence: r.confidence, overall_flag: r.overall_flag,
      body: r.body, findings: Array.isArray(r.findings) ? r.findings : [], evidence: Array.isArray(r.evidence) ? r.evidence : [],
      evidence_source: (r as unknown as { evidence_source?: string }).evidence_source ?? null })),
    story: (story[0] as unknown as { ref: string; title: string; narrative: string; next_step: string | null } | undefined) ?? null,
  };
}

/** Every finding of a vessel across every analysed check (the Findings tab). */
export async function findingsAll(v: Vessel) {
  const rows = await sql`
    SELECT n.id::int, coalesce(n.perspective, '') AS perspective, coalesce(n.importance, n.attrs->>'importance', 'low') AS importance, n.body,
           nullif(trim(n.attrs->>'action_required'), '') AS action_required,
           coalesce(n.attrs->>'applies_to', r.attrs->>'period') AS period, coalesce(r.attrs->>'check_file_id', '') AS cf,
           n.about_note_id::int, n.attrs->'evidence' AS own_evidence, r.attrs->'evidence' AS rep_evidence
    FROM living_office.note n
    JOIN living_office.dossier d ON d.id = n.dossier_id
    LEFT JOIN living_office.note r ON r.id = n.about_note_id
    WHERE n.type = 'postit' AND n.retracted_at IS NULL AND d.entity_id = ${v.id} AND coalesce(n.perspective, '') <> ${SYNTH}
    ORDER BY period DESC NULLS LAST, n.id`;
  // evidence fallback for unlinked postits: the report note of the same check + perspective
  const need = (rows as unknown as { period: string | null; perspective: string; about_note_id: number | null }[]).filter((r) => !r.about_note_id && r.period);
  const fb = new Map<string, unknown>();
  if (need.length) {
    const periods = [...new Set(need.map((r) => r.period as string))];
    const reps = await sql`
      SELECT n.attrs->>'period' AS period, coalesce(n.perspective, '') AS perspective, n.attrs->'evidence' AS evidence, n.attrs->>'check_file_id' AS cf, (n.retracted_at IS NULL) AS live
      FROM living_office.note n JOIN living_office.dossier d ON d.id = n.dossier_id
      WHERE n.type = 'report' AND d.entity_id = ${v.id} AND n.attrs->>'period' = ANY(${periods})
      ORDER BY (n.retracted_at IS NULL) DESC, n.retracted_at DESC NULLS FIRST, n.id DESC`;
    for (const r of reps as unknown as { period: string; perspective: string; evidence: unknown; cf: string; live: boolean }[]) {
      const k = `${r.period}|${r.perspective}`; const has = Array.isArray(r.evidence) && (r.evidence as unknown[]).length > 0; const cur = fb.get(k) as { evidence: unknown; cf: string; has: boolean } | undefined;
      if (!cur) fb.set(k, { evidence: r.evidence, cf: r.cf, has });
      else if (!cur.has && has) fb.set(k, { evidence: r.evidence, cf: cur.cf || r.cf, has });   // live note without evidence → borrow the retracted version's
    }
  }
  return (rows as unknown as { id: number; perspective: string; importance: string; body: string; action_required: string | null; period: string | null; cf: string; about_note_id: number | null; own_evidence: unknown; rep_evidence: unknown }[]).map((r) => {
    const f = fb.get(`${r.period}|${r.perspective}`) as { evidence: unknown; cf: string } | undefined;
    const ev = Array.isArray(r.own_evidence) && (r.own_evidence as unknown[]).length ? r.own_evidence : (Array.isArray(r.rep_evidence) && (r.rep_evidence as unknown[]).length ? r.rep_evidence : (f && Array.isArray(f.evidence) ? f.evidence : []));
    return { id: r.id, perspective: r.perspective, severity: sev(r.importance), importance: r.importance, headline: headline(r.body), body: r.body,
      action_required: r.action_required, period: r.period, cf: r.cf || f?.cf || "", about_note_id: r.about_note_id,
      evidence: (ev as { tag_id?: string; label?: string; value?: string }[]).filter((e) => e && e.tag_id).slice(0, 12) };
  });
}

/* ── noon report ────────────────────────────────────────────────────── */

export async function noon(v: Vessel, since: string) {
  const rows = await sql`
    SELECT to_char(report_date AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS d, rec_type AS t, status AS st, lat::float, long::float AS lon,
           voy_no AS voy, trade_lane AS lane, port_name AS port, me_load_pct::float AS load, me_output_kw::float AS kw,
           total_foc_day::float AS foc, avg_speed_og::float AS sog, weather_summary AS wx, wind_bf::float AS bf, swell_height::float AS swell
    FROM noon_report.readable WHERE imo = ${v.imo} AND report_date >= ${since}::date
    ORDER BY report_date, rec_seq NULLS FIRST`;
  return rows;
}

const trackCache = new Map<string, { at: number; rows: unknown[] }>();
export async function track(v: Vessel) {
  const c = trackCache.get(v.imo);
  if (c && Date.now() - c.at < 10 * 60_000) return c.rows;
  const rows = await sql`
    SELECT to_char(report_date AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS d, lat::float, long::float AS lon, status AS st, avg_speed_og::float AS sog
    FROM noon_report.readable WHERE imo = ${v.imo} AND lat IS NOT NULL AND long IS NOT NULL
    ORDER BY report_date, rec_seq NULLS FIRST`;
  const out = (rows as unknown as { d: string; lat: number; lon: number; st: string | null; sog: number | null }[]).map((r) => [r.d, r.lat, r.lon, r.st, r.sog]);
  trackCache.set(v.imo, { at: Date.now(), rows: out });
  return out;
}
