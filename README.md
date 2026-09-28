# M0 Checklist Monitoring System (`mti-fleet-monitor`)

The MTI eUMS mockup-v4 UI as a Bun app over the live `nyk_mti` database — all 5 pilot vessels,
read-only. Moved from the mockup on 23-Sep-2026; the mockup folder is the reference:
`02-MTI/presentation-2026-09-24/app-understanding/mockup-v4/` (`reference.html`, `COMPONENTS.md`,
`DATA-MAPPING.md`, `TODO.md`, `PLAN.md`).

## Shape

```
lifeos-app.json        manifest ("M0 Checklist Monitoring System", start: bun run server.ts, env: .env.app)
server.ts              entry — router in src/server/app.ts, port binding in src/server/startup.ts
src/server/db.ts       keyless Postgres via pg-relay + @neondatabase/serverless (Vercel OIDC → GCP WIF), one pool per request
scripts/local.ts       run against a local/proxied Postgres (with scripts/wsproxy.ts) — no OIDC needed
src/server/queries.ts  the read-only query layer, one function per route, written from DATA-MAPPING.md
src/server/app.ts      the router: /api/... + the inlined index
public/components.js   the reusable component library — identical to the mockup's
public/components.css  its styles
public/app.js          the app: the mockup's logic with every embedded constant replaced by a fetch
public/index.html, style.css, coast.js (Natural Earth 110m), comments.js (card sentences), weather.js (provision)
tests/                 bun test: router (no DB) + live (LIVE_DB=1)
```

## Routes (all GET, JSON)

| Route | Reads |
|---|---|
| `api/health` | — |
| `api/fleet` | entity + report notes grouped by `attrs.check_file_id` + postit counts + last noon report |
| `api/vessel/:slug` | checks, every check date (one per day: the check with the most readings), systems, master version |
| `api/vessel/:slug/tags` | master_tags + tag_classification (current version) + citation counts |
| `api/vessel/:slug/checklist/:cf` | check_readable rows of one check in reading order + walkaround times + tag_thresholds + PREVIOUS + the noon status on that date; `?tags=a,b` limits the rows to those tags (the verdict card asks for the 28 UMS-critical ones) |
| `api/vessel/:slug/tag/:id` | full history (numeric or state), citations from report-note evidence, siblings |
| `api/vessel/:slug/series?system=&from=&to=` | numeric/state series for every tag of a system in a window |
| `api/vessel/:slug/check/:cf` | findings (postits), analyses (report notes), daily overview, year story |
| `api/vessel/:slug/findings` | every postit of the vessel with evidence |
| `api/vessel/:slug/noon?since=` | noon_report.readable rows |
| `api/vessel/:slug/track` | every position (cached 10 min) |

## Grain decisions (were "to be checked" in the mockup)

- A **check** = the report notes that share `attrs.check_file_id`. A dossier is one vessel-year since 22-Sep-2026.
- A **finding** = a postit note; its date = `attrs.applies_to`, else the period of the report note it is about.
- **Evidence** for a finding = the report note it is about (`about_note_id`), else the report note of the same check + perspective. Each card says which.
- The **band** = `check_readable.min_val/max_val`; **out of range** = `in_range = false` (NULL = no band, not counted).
- The **story** = `dossier.narrative` of the year.

## Looks

Three looks, switch in the top bar (Lined · Float · Glass), remembered per browser, `?look=` in the URL. Float is the
default: grey base, white floating cards, no borders. Glass adds sticky blurred bars. All of it is the LOOKS block in
`public/components.css`; the date controls (player, timeline, strip) are independent mounts of one `UI.DateModel`.

## Run / test

The host starts it (`bun run server.ts`, PORT from the environment). Tests: `bun test` (router, no DB);
`bun run scripts/wsproxy.ts &` then `LIVE_DB=1 PGPORT=5433 PGUSER=… PGPASSWORD=… bun test` for the live
read-only checks (through `cloud-sql-proxy --port 5433`). Local server: `bun run scripts/local.ts` with the same PG* vars. Typecheck: `bun run typecheck`.
