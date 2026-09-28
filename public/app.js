/* =====================================================================
   M0 Checklist Monitoring System — the app script.
   Ported from the reference mockup (02-MTI/presentation-2026-09-24/app-understanding/
   mockup-v4/reference.html) with every embedded constant replaced by a fetch
   from ./api/… . The component layer (components.js) is the same file.
   One selected date per screen drives every card; UI.setCursor moves the dot.
   ===================================================================== */

/* ---- app-relative API (the LifeOS preview proxies GET under its own prefix) ---- */
const APP_BASE = location.href.replace(/[?#].*$/, '').replace(/[^/]*$/, '');
const apiUrl = p => new URL(p.replace(/^\/+/, ''), APP_BASE).toString();
const _cache = new Map();
async function api(path, {fresh=false}={}){
  if(!fresh && _cache.has(path)) return _cache.get(path);
  const p = fetch(apiUrl(path), {headers:{accept:'application/json'}}).then(async r=>{ const b = await r.json().catch(()=>({error:'bad json'})); if(!r.ok) throw new Error(b.error || ('HTTP '+r.status)); return b; });
  _cache.set(path, p); p.catch(()=>_cache.delete(path)); return p;
}
const showErr = (id, e) => { const el = document.getElementById(id); if(el) el.innerHTML = `<div class="err">Could not load: ${esc(e && e.message || e)}</div>`; };

/* ---- DATA MAPPING: every card/graph carries a `source` → the ⓘ marker (DATA-MAPPING.md in the reference folder).
   Every table here is what src/server/queries.ts actually reads. ---- */
const SRC = {
  fleet:        {table:'living_office.entity + living_office.note (type=report) + noon_report.readable', columns:"entity.slug, name, attrs.imo, attrs.vessel_type · note.attrs check_file_id/period/score · readable status, port_name, lat, long", filter:"entity.type='vessel'; note.retracted_at IS NULL", rows:'one row per vessel; health = the latest analysed check on or before the selected date', derived:'health = avg(score) over the check\'s report notes; high/medium/low = postit notes by importance'},
  fleetAsOf:    {table:"living_office.note (type='report') grouped by attrs->>'check_file_id', per entity", columns:"attrs->>'period', avg(score)", filter:'per vessel: the latest analysed check on or before the selected date', rows:'one row per vessel; vessels with no analysed check by then show as not yet analysed'},
  get umsVerdict(){ const n = (typeof UMS_CRITERIA!=='undefined' ? UMS_CRITERIA.filter(c=>!V||c.imo===V.vessel.imo) : []); const tags = new Set(n.flatMap(c=>c.tag_ids||[])).size;
    return {status:'to be checked',
    table:`m0_check_reports.ums_criteria (PLANNED \u2014 today ums-criteria.js, ${n.length} rules) + check_readable + tag_thresholds + noon_report.readable`,
    columns:'criteria: criterion, grp (= Skill-2 cluster), kind, tag_ids[], required jsonb, condition, tier, weight, hard_stop, action \u00b7 readings: value, value_numeric, in_range, min_val/max_val \u00b7 thresholds: expected_normal_state, acceptable/expected band, needs_review \u00b7 noon: status and total_foc_day on the check date',
    filter:`active criteria whose condition is 'any' or the noon status; api/vessel/:slug/checklist/:cf?tags=<the ${tags} tags the rules name>`,
    rows:'one verdict per check \u2192 the future ums_verdict row (verdict, risk, horizon_until, hard_stops, reasons[], conditions[])',
    derived:'ums.js UMS.evaluate(): severity fail 1 \u00b7 not yet reviewed \u00bd \u00b7 cannot judge \u00bd \u00b7 not read 0.3; risk = \u03a3 weight\u00d7severity \u00f7 \u03a3 weight \u00d7 100; NO-GO if a hard stop fails or risk > 50; GO only if nothing is left to confirm and risk < 20; CANNOT JUDGE below 90 % coverage; NOT FILED when no check that day',
    note:'the readings, thresholds and voyage condition are live from nyk_mti; only the rules are still a file. Nothing is stored \u2014 ums_verdict.py (Skill 1) will write the same result to m0_check_reports.ums_verdict once the two tables exist (chain Phase 1\u20132). Spec + conformance test: app-understanding/ums-spec/.'}; },
  healthTrend:  {table:"living_office.note (type='report')", columns:"attrs->>'check_file_id', 'period', 'score', 'status', perspective", filter:'dossier.entity_id = this vessel AND retracted_at IS NULL', rows:'one point per check_file_id', derived:'x = period; y = avg(score) over the perspectives of that check'},
  openItems:    {table:"living_office.note (type='postit')", columns:"importance, perspective, attrs->>'applies_to', about_note_id", filter:"retracted_at IS NULL AND perspective <> 'daily-overview'", rows:'count per check (applies_to, else the report note it is about), split high / medium', derived:'average = mean over this vessel\'s analysed checks'},
  findings:     {table:"living_office.note (type='postit')", columns:"id, perspective, importance, body, attrs->>'action_required', 'applies_to', 'written_at', about_note_id", filter:"entity + retracted_at IS NULL AND perspective <> 'daily-overview'", rows:'one finding per postit note, sorted high → low'},
  evidence:     {table:"living_office.note (type='report') attrs->'evidence'[]", columns:"e->>'tag_id', 'label', 'value' · postit.about_note_id → report note.id", filter:'the report note the postit is about; else the report note of the same check + perspective', rows:'one chart card per evidence tag (max 12)', note:'about_note_id is not set on every postit — the fallback is by check + perspective; each card says which'},
  tagSeries:    {table:'m0_check_reports.check_readable', columns:'check_date, check_file_id, value, value_numeric, in_range', filter:'imo = this vessel AND tag_id = <tag> ORDER BY check_date', rows:'one point per check the tag was read on', note:'state tags (lamps, switches) use value (text); numeric tags use value_numeric'},
  tagMeta:      {table:'m0_check_reports.master_tags + tag_classification', columns:'tag_name, unit_or_state, min_val, max_val · system, equipment', filter:'imo = this vessel AND version_id = current master version (master_versions.valid_to IS NULL)', rows:'one row per tag', note:'the band shown is master_tags.min_val/max_val — the master file\'s own range (tag_thresholds, the derived band, exists for Atlas Leader only and is not shown)'},
  siblings:     {table:'m0_check_reports.master_tags + tag_classification + check_readable', columns:'tag_name (one index token removed), system, value on the selected check', filter:'same imo, same version, same system', rows:'one bar per sibling tag on the selected date', derived:'rule: names equal after removing one index token (No.1, #3, 3rd, Cyl 4) — computed server-side, src/server/queries.ts siblingKey()'},
  systems:      {table:'m0_check_reports.tag_classification', columns:'system, equipment, tag_id', filter:'imo = this vessel AND version_id = current master version', rows:'one row per system; tag count = count(*)', derived:'red dot = readings on the selected check with in_range = false; amber dot = a tag of the system is cited in a report note'},
  checklist:    {table:'m0_check_reports.check_readable + check_raw (+ tag_classification)', columns:'tag_id, tag_name, value, value_numeric, min_val, max_val, in_range, reading_ts · walkaround_start_ts, walkaround_end_ts, master_version_id', filter:'imo = this vessel AND check_file_id = the selected check (the check with the most readings that day)', rows:'one row per reading, in reading_ts order'},
  oor:          {table:'m0_check_reports.check_readable', columns:'in_range', filter:'the selected check_file_id', rows:'count of readings with in_range = false (NULL = no band / state tag, not counted)'},
  noon:         {table:'noon_report.readable', columns:'report_date, rec_type, rec_seq, status, lat, long, voy_no, trade_lane, port_name, me_load_pct, me_output_kw, total_foc_day, avg_speed_og, weather_summary, wind_bf, swell_height', filter:'imo = this vessel; the report on or just before the selected date', rows:'one noon report', note:'wind direction and sea state are not in readable — only in noon_report.report_raw.raw_json (to be checked)', status:'to be checked'},
  noonSeries:   {table:'noon_report.readable', columns:'report_date, avg_speed_og / total_foc_day / wind_bf', filter:"imo = this vessel AND rec_type = '50_SEA' (at sea only), since 2024-01-01", rows:'one point per noon report'},
  track:        {table:'noon_report.readable', columns:'report_date, lat, long, status, avg_speed_og', filter:'imo = this vessel AND lat IS NOT NULL', rows:'every position on file (server caches 10 min)', note:'coastline: Natural Earth 110m land (public domain) — not in the DB'},
  analysis:     {table:"living_office.note (type='report')", columns:"perspective, title, body (the written analysis, markdown), attrs->>'score', 'status', 'confidence', 'overall_flag', attrs->'findings', attrs->'evidence'", filter:"attrs->>'check_file_id' = the selected check AND retracted_at IS NULL", rows:'one score card per perspective'},
  story:        {table:'living_office.dossier', columns:'ref, title, narrative (markdown), next_step', filter:'entity_id = this vessel AND ref ends with the check\'s year', rows:'one story per vessel-YEAR (the dossier grain since 22-Sep-2026)', note:'per-check stories do not exist in the DB; this is the year narrative', status:'to be checked'},
  postits:      {table:"living_office.note (type='postit')", columns:"importance, body, attrs->>'action_required', 'applies_to', 'written_at', about_note_id", filter:'the selected check AND perspective = <cluster>', rows:'one row per postit of that cluster'},
  comments:     {status:'to be checked', table:'(none yet) — comments.js', columns:'key → sentence', rows:'one sentence per card per date', note:"proposal: living_office.note type='comment' with attrs.key and about_note_id"},
  dates:        {table:"m0_check_reports.check_raw + living_office.note (type='report')", columns:"check_raw.check_date, check_file_id, walkaround_start_ts/end_ts (every filed check) · report notes' attrs->>'check_file_id' (analysed)", filter:'imo = this vessel; one entry per calendar day (the check with the most readings)', rows:'every check date; analysed dates carry their health colour'},
  timeline:     {table:"m0_check_reports.check_raw + living_office.note (type='report')", columns:'check_date (every check) · check_file_id + score (analysed)', filter:'imo = this vessel', rows:'one tick per check date; play steps through them in order', note:'the grey zone on the right is a provision for projections — no table feeds it yet', status:'to be checked'},
  tagStats:     {table:'m0_check_reports.check_readable + master_tags + living_office.note evidence[]', columns:'latest value, streak of unchanged readings, min_val/max_val, report notes whose evidence[] cites the tag', filter:'imo = this vessel AND tag_id = <tag>', rows:'one row each', derived:'"Unchanged for" = consecutive readings equal to the latest, counted backwards'},
  weather:      {status:'to be checked', table:'(none yet) — weather.js, proposal weather.track_point + weather.grid', columns:'report_date, lat, lon, wind_dir, wind_speed_kn, wave_height_m', rows:'one row per noon position', note:'sources verified: Open-Meteo ERA5 + marine (free). See WEATHER-SOURCES.md in the reference folder'},
};
document.querySelectorAll('.a-infoslot').forEach(e=>{ const k=e.dataset.src; e.outerHTML = UI.info(SRC[k] || {status:'to be checked', note:'no mapping written for "'+k+'"'}); });
function commentFor(key, fallback){ const c = (typeof COMMENTS!=='undefined') && COMMENTS[key]; return (c && String(c).trim()) ? c : (fallback||''); }

/* ---- state ---- */
let FLEET = null;            /* api/fleet */
let V = null;                /* api/vessel/:slug — the open vessel */
let TAGS = {};               /* api/vessel/:slug/tags */
const CL = {};               /* checklist per check_file_id */
const CK = {};               /* check detail per check_file_id */
const TAGD = {};             /* tag detail per tag id */
const SYSS = {};             /* system series per system|to */
let NOON = [], TRACK = [], FIND_ALL = null;
let curVesselSlug = null, curDate = null, curIdx = 0;
const HEALTH_ZONES=[{lo:0,hi:73,color:'#E30019'},{lo:73,hi:83,color:'#FE9413'},{lo:83,hi:100,color:'#1DA100'}];
const FUTURE = 1/3;
const vesselOf = slug => (FLEET ? FLEET.vessels.find(v=>v.slug===slug) : null);
const checks = () => V ? V.checks : [];
const TREND = () => checks();
const dateOf = iso => V ? V.dates.find(d=>d.d===iso) : null;
const cfOf = iso => { const d = dateOf(iso); return d ? d.cf : (AN().has(iso) ? checks()[AN().get(iso)].cf : null); };
let _AN=null; function AN(){ if(!_AN){ _AN=new Map(); checks().forEach((c,i)=>_AN.set(c.period, i)); } return _AN; }
const HISTORY_DATES = () => V ? V.dates.map(d=>d.d) : [];
let SPAN = null;

/* ---- date models (UI.DateModel): one selected date per screen; the player, the timeline and the strip are independent
   mounts of the same model. The app only listens for 'change'. ---- */
const FLEET_MODEL = new UI.DateModel({scopes:[{key:'analysed', label:'Analysed dates', dates:[], interval:1100}]});
const VESSEL_MODEL = new UI.DateModel({scopes:[{key:'analysed', label:'Analysed', dates:[], interval:1000},{key:'all', label:'All checks', dates:[], interval:450}]});
FLEET_MODEL.on('change', m=>{ if(m.selected && m.selected!==fleetDate) fleetSetDate(m.selected); });
VESSEL_MODEL.on('change', m=>{ if(m.selected && m.selected!==curDate) setCheckDate(m.selected); });
/* thin wrappers kept for the keyboard handler and the test scripts */
const PLAY = { get timer(){ return (FLEET_MODEL.playing || VESSEL_MODEL.playing) ? 1 : null; }, get ctx(){ return FLEET_MODEL.playing ? 'fleet' : VESSEL_MODEL.playing ? 'vessel' : null; }, get speed(){ return VESSEL_MODEL.speed; }, get scope(){ return VESSEL_MODEL.scope; } };
function playStop(){ FLEET_MODEL.pause(); VESSEL_MODEL.pause(); }
function playSpeed(x){ (document.getElementById('screen-fleet').classList.contains('active') ? FLEET_MODEL : VESSEL_MODEL).setSpeed(x); }
function playScope(k){ VESSEL_MODEL.setScope(k); }
function fleetPlayToggle(){ FLEET_MODEL.toggle(); }
function fleetStep(d){ FLEET_MODEL.step(d); }
function vesselPlayToggle(){ VESSEL_MODEL.toggle(); }
function vesselStep(d){ VESSEL_MODEL.step(d); }
document.addEventListener('keydown', e=>{ if(e.code!=='Space' || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return; e.preventDefault(); if(document.getElementById('screen-fleet').classList.contains('active')) fleetPlayToggle(); else if(curVesselSlug) vesselPlayToggle(); });

/* =====================================================================
   FLEET
   ===================================================================== */
const FLEET_DATES = () => FLEET ? [...new Set(FLEET.vessels.flatMap(v=>v.checks.map(c=>c.period)))].sort() : [];
let fleetDate = null;
function fleetSetDate(iso){ fleetDate = iso; renderFleet(); }
function fleetItems(){ return FLEET_DATES().map(x=>{ const hs = FLEET.vessels.map(v=>v.checks.find(c=>c.period===x)).filter(Boolean).map(c=>c.health).filter(h=>h!=null); const avg = hs.length ? hs.reduce((a,b)=>a+b,0)/hs.length : null; return {x, analysed:true, tier:tier(avg)}; }); }
async function loadFleet(){
  try { FLEET = await api('api/fleet'); }
  catch(e){ showErr('fleetErr', e); return; }
  const FD = FLEET_DATES(); fleetDate = fleetDate || FD[FD.length-1] || null;
  SPAN = FLEET.span && FLEET.span[0] ? FLEET.span : null;
  document.getElementById('topTime').textContent = new Date().toISOString().slice(0,16).replace('T',' ') + ' UTC';
  document.getElementById('lookSw').innerHTML = UI.lookSwitch({});
  renderSidebar(); renderFleet();
  loadFleetVerdicts();
}
/* the UMS verdict of each vessel's latest analysed walkaround — the sidebar, the fleet rows and the fleet hero show it next to the health score */
const FLEET_VERDICT = {};
async function loadFleetVerdicts(){
  const crit = typeof UMS_CRITERIA!=='undefined' ? UMS_CRITERIA : [];
  await Promise.all(FLEET.vessels.map(async v=>{
    const rules = crit.filter(c=>c.imo===v.imo); const last = v.checks[v.checks.length-1];
    if(!rules.length || !last){ FLEET_VERDICT[v.slug] = {verdict:'NO RULES', risk:null, d:last?last.period:null}; return; }
    try {
      const ids = [...new Set(rules.flatMap(c=>c.tag_ids))];
      const d = await api(`api/vessel/${v.slug}/checklist/${last.cf}?tags=${ids.join(',')}`); const by = {}; d.rows.forEach(r=>{ if(!by[r.t]) by[r.t]=r; });
      const r = UMS.evaluate({criteria:rules, condition:(d.check&&d.check.noon_status)||'any', reading:t=>by[t]||null, threshold:t=>(by[t]||{}).th||null, filed:d.rows.length>0, start:d.check?d.check.start:null, end:d.check?d.check.end:null, asOf:last.period, noon:{foc:d.check?d.check.noon_foc:null}});
      FLEET_VERDICT[v.slug] = {verdict:r.verdict, risk:r.risk, d:last.period, cf:last.cf};
    } catch(e){ FLEET_VERDICT[v.slug] = {verdict:'CANNOT JUDGE', risk:null, d:last.period, err:e.message}; }
  }));
  renderSidebar(); if(document.getElementById('screen-fleet').classList.contains('active')) renderFleet(); else highlightSidebar(curVesselSlug);
}
function fleetVerdictPill(slug){ const f = FLEET_VERDICT[slug]; return f ? UI.verdictPill(f.verdict, {small:true, risk:f.risk}) : `<span class="a-vpill small" style="color:#AEAEB2;background:#AEAEB214"><i style="background:#AEAEB2"></i>…</span>`; }
function renderFleet(){
  if(!FLEET) return;
  const results = {}; let sum=0, count=0; const counts={good:0,warn:0,alarm:0,none:0};
  FLEET.vessels.forEach(v=>{
    const trend = v.checks.filter(c=>c.period<=fleetDate && c.health!=null);
    if(!trend.length){ results[v.slug]={value:null, points:[], tier:'none'}; counts.none++; return; }
    const last = trend[trend.length-1]; const t = tier(last.health);
    results[v.slug]={value:last.health, points:trend.map(c=>({health:c.health})), tier:t, date:last.period, check:last};
    counts[t]++; sum+=last.health; count++;
  });
  const fleetAvg = count ? sum/count : null; const FD = FLEET_DATES();
  document.getElementById("heroNum").textContent = fleetAvg!=null ? fleetAvg.toFixed(1) : '\u2014';
  document.getElementById("heroNum").style.color = fleetAvg!=null ? colorFor(fleetAvg) : 'var(--ink-3)';
  const ft = fleetAvg!=null ? tier(fleetAvg) : 'none';
  document.getElementById("heroLbl").innerHTML = `Fleet health \u00b7 ${ft==='good'?'Good':ft==='warn'?'Satisfactory':ft==='alarm'?'Attention':'\u2014'} \u00b7 as of ${fleetDate?fmtDate(fleetDate):'\u2014'}${fleetDate===FD[FD.length-1]?' \u00b7 latest':''} \u00b7 ${count} of ${FLEET.vessels.length} vessels analysed by then ${UI.info(SRC.fleetAsOf)}`;
  const fvc = {}; FLEET.vessels.forEach(v=>{ const k = FLEET_VERDICT[v.slug] ? FLEET_VERDICT[v.slug].verdict : '…'; fvc[k]=(fvc[k]||0)+1; });
  document.getElementById('fleetVerdict').innerHTML = `<span>UMS today ·</span>${Object.entries(fvc).map(([k,n])=>(k==='…'?'<span>computing…</span>':UI.verdictPill(k,{small:true}))+`<b style="margin:0 8px 0 -4px">${n}</b>`).join('')}`;
  document.getElementById('fleetExplain').innerHTML = UI.explain({title:'What these numbers mean', text:'<b>Fleet health</b> is the mean of each vessel\'s latest analysed health score on or before the selected date; a vessel\'s health is the mean of the analyst\'s cluster scores on that check (living_office.note, type report) — condition, not permission. <b>UMS today</b> counts the verdict of each vessel\'s latest analysed walkaround: may the engine room be left unmanned for the next 8 h? Rules exist for Atlas Leader only, so the other vessels say NO RULES until an admin adds theirs.', rows:[{k:'Health', v:`${count} of ${FLEET.vessels.length} vessels analysed by ${fmtDate(fleetDate)} · mean ${fleetAvg!=null?fleetAvg.toFixed(1):'—'} · Good ≥ 83 · Satisfactory 73–83 · Attention < 73`},{k:'Verdict', v:'the UMS card on each vessel — 22 POC criteria over 28 critical tags, computed from the walkaround readings and tag_thresholds; nothing stored yet'}]});
  if(FLEET_MODEL._n !== FD.length){ FLEET_MODEL._n = FD.length; FLEET_MODEL.dates = fleetItems(); FLEET_MODEL.scopes[0].dates = FD; FLEET_MODEL.span = SPAN; }
  FLEET_MODEL.set({selected:fleetDate});
  UI.mountDateBar(document.getElementById('fleetBar'), FLEET_MODEL, {selector:true});
  const n = FLEET.vessels.length;
  const segs = [{n:counts.good,c:"#1DA100"},{n:counts.warn,c:"#FE9413"},{n:counts.alarm,c:"#E30019"},{n:counts.none,c:"#D2D2D7"}];
  document.getElementById("distBar").innerHTML = segs.map(s=>`<span style="width:${(s.n/n*100).toFixed(1)}%;background:${s.c}"></span>`).join("");
  document.getElementById("distLegend").innerHTML = `
    <span class="k"><span class="sw" style="background:#1DA100"></span>Good <b>${counts.good}</b></span>
    <span class="k"><span class="sw" style="background:#FE9413"></span>Satisfactory <b>${counts.warn}</b></span>
    <span class="k"><span class="sw" style="background:#E30019"></span>Attention <b>${counts.alarm}</b></span>${counts.none?`<span class="k"><span class="sw" style="background:#D2D2D7"></span>Not yet analysed by ${fmtDate(fleetDate)} <b>${counts.none}</b></span>`:''}`;
  const attn = FLEET.vessels.filter(v=>results[v.slug].tier!=="good" && results[v.slug].tier!=="none");
  document.getElementById("chipAttnN").textContent = attn.length;
  document.getElementById("chipOnbN").textContent = n;
  document.getElementById("vesselCountLbl").textContent = n;
  document.getElementById("clist").innerHTML = FLEET.vessels.map(v=>{
    const r = results[v.slug]; const nn = v.noon;
    const pill = nn ? (/SEA/i.test(nn.status||'') ? `<span class="pill pill-sea">AT SEA</span>` : `<span class="pill pill-port">${esc((nn.status||'').toUpperCase() || 'IN PORT')}</span>`) : '';
    const noonTxt = nn ? `${pill} noon ${fmtDate(nn.d)}${nn.port?' \u00b7 '+esc(nn.port):''}` : '';
    if(r.tier==='none') return `<div class="crow" data-name="${esc(v.name.toLowerCase())}" data-status="good" onclick="openVessel('${v.slug}')">
      <span class="cdot d-none"></span><div class="cname">${esc(v.name)}</div>
      <div class="cmeta">${esc(v.type||'')} \u00b7 not yet analysed by ${fmtDate(fleetDate)} ${noonTxt}</div><span></span>
      <div class="chealth" style="color:var(--ink-3)">\u2014</div></div>`;
    return `<div class="crow" data-name="${esc(v.name.toLowerCase())}" data-status="${r.tier==='good'?'good':'attention'}" onclick="openVessel('${v.slug}')">
      <span class="cdot d-${r.tier}"></span><div class="cname">${esc(v.name)}</div>
      <div class="cmeta">${esc(v.type||'')} ${noonTxt}${r.date!==fleetDate?` \u00b7 last analysed ${fmtDate(r.date)}`:''} \u00b7 ${r.check.high} high / ${r.check.medium} medium</div>
      ${fleetVerdictPill(v.slug)}${sparkSvg(r.points,44,17,colorForTier(r.tier))}
      <div class="chealth h-${r.tier==='alarm'?'alarm':r.tier==='warn'?'warn':'good'}">${r.value.toFixed(1)}</div>
    </div>`;
  }).join("");
  const totalChecks = FLEET.vessels.reduce((s,v)=>s+v.checks.length,0);
  document.getElementById("fleetNotice").innerHTML = UI.notice({
    glyph:'\u2699', color:'#1D3C67', id:'fleetNoticeCard', title:`${totalChecks} analysed checks across ${n} vessels`,
    body:`Health is the average score of an analysed check's cluster reports (living_office.note, type report). Out-of-range flags come from the check readings' own bands (check_readable.in_range) — the same for every vessel.`
  });
  setFilter(document.querySelector('.filterchips .chip.active[data-f]')?.dataset.f || 'attention');
}
function setFilter(f){
  document.querySelectorAll('.filterchips .chip[data-f]').forEach(c=>c.classList.toggle('active', c.dataset.f===f));
  document.querySelectorAll('#clist .crow').forEach(r=>{ r.classList.toggle('hidden', f==='attention' && r.dataset.status!=='attention'); });
  if(f==='attention' && !document.querySelector('#clist .crow:not(.hidden)')) setFilter('good');
}
function filterList(){ const q = document.getElementById('search').value.toLowerCase(); document.querySelectorAll('#clist .crow').forEach(r=>{ r.classList.toggle('hidden', q && !r.dataset.name.includes(q)); }); }
function renderSidebar(){
  document.getElementById('sbFleetN').textContent = FLEET.vessels.length;
  document.getElementById('sbList').innerHTML = FLEET.vessels.map(v=>{
    const last = [...v.checks].reverse().find(c=>c.health!=null); const t = last ? tier(last.health) : 'none';
    return `<div class="sb-row" id="sb-${v.slug}" onclick="openVessel('${v.slug}')"><span class="dot d-${t}"></span><span>${esc(v.name)}</span>${fleetVerdictPill(v.slug)}<span class="n">${last?last.health.toFixed(1):'\u2014'}</span></div>`;
  }).join("");
  const sel = document.getElementById('vswitch'); sel.innerHTML = FLEET.vessels.map(v=>`<option value="${v.slug}">${esc(v.name)}</option>`).join("");
}
function highlightSidebar(slug){ document.querySelectorAll('.sb-row').forEach(r=>r.classList.toggle('on', !!slug && r.id==='sb-'+slug)); }
function toggleSidebar(){ document.querySelector('.appshell').classList.toggle('collapsed'); }
function updateCrumb(parts){
  document.getElementById('crumb').innerHTML = parts.map((p,i)=>{ const isLast = i===parts.length-1; const sep = i>0 ? `<span class="sep">\u203a</span>` : ''; return sep + (isLast ? `<b>${esc(p.label)}</b>` : `<a onclick="${p.onclick}">${esc(p.label)}</a>`); }).join(' ');
}
/* =====================================================================
   THE PROJECT — one screen, six selectors on top (24-Sep-2026)

   The left rail still lists these pages and still works; every one of
   those handlers now routes through openProject() so both navigations
   show the same thing. Once the top bar has carried everything, the
   left list can go and nothing else has to change.
   ===================================================================== */
const PROJ_TABS = [
  {key:'problem', label:'The problem'},
  {key:'steps',   label:'Step by step'},
  {key:'built',   label:'How it was built'},
  {key:'skills',  label:'The two skills'},
  {key:'works',   label:'How it works'},
  {key:'example', label:'One walkaround'},
  {key:'now',     label:'Now'},
];
const PROJ = {
  problem:{crumb:'The problem', bleed:true,
           html:()=> UI.scenesPage(UI.storyScenes((typeof STORY!=='undefined' && STORY.problem) || null))},
  steps:  {crumb:'Step by step', bleed:true,
           html:()=> UI.cinemaPage(typeof PROCESS!=='undefined' ? PROCESS : null)},
  built:  {crumb:'How it was built', bleed:true,
           html:()=> UI.scenesPage(UI.storyScenes((typeof STORY!=='undefined' && STORY.built) || null))},
  skills: {crumb:'The two skills', bleed:true,
           html:()=> UI.scenesPage(UI.skillScenes(typeof SKILLS!=='undefined' ? SKILLS : null))},
  works:  {crumb:'How it works',
           html:()=> UI.aboutPage(ABOUT, {rules: typeof UMS_CRITERIA!=='undefined' ? UMS_CRITERIA : null,
                     onTag: t => `openVessel('atlas-leader').then(()=>openTagDetail('${t}'))`})},
  example:{crumb:'One walkaround', bleed:true,
           html:()=> UI.scenesPage(typeof EXAMPLE!=='undefined' ? EXAMPLE : null)},
  now:    {crumb:'Now', bleed:true,
           html:()=> UI.nowPage(typeof NOW!=='undefined' ? NOW : null)},
};
let projTab = 'problem';            // remembered, so the left button returns you where you were
function openProject(key){
  const P = PROJ[key || projTab]; if(!P) return;
  projTab = key || projTab;
  playStop(); closeTagDetail(); if(typeof closeAnalysis==='function') closeAnalysis();
  ['screen-fleet','screen-vessel','screen-about'].forEach(id=>{ const e=document.getElementById(id); if(e) e.classList.remove('active'); });
  document.getElementById('screen-story').classList.add('active');
  const body = document.getElementById('storyBody');
  body.classList.toggle('bleed', !!P.bleed);
  body.innerHTML = UI.topTabs({tabs:PROJ_TABS, active:projTab, onclick:'openProject'})
                 + (P.html() || '');
  highlightSidebar(null); setNavOn('sbProject');
  updateCrumb([{label:'M0 project', onclick:'openProject()'},{label:P.crumb}]);
  if(UI.cinemaInit) UI.cinemaInit(body);
  if(UI.railInit)   UI.railInit(body);
  window.scrollTo(0,0);
}
/* Compatibility shims. The left rail no longer calls these — it has one
   entry now — but the names are kept so any existing link still lands. */
function openStoryPage(key){ openProject(key === 'built' ? 'built' : 'problem'); }
function openProcess(){     openProject('steps');  }
function openSkillsPage(){  openProject('skills'); }
function openAbout(){       openProject('works');  }
function setNavOn(id){ document.querySelectorAll('.sb-item').forEach(x=>x.classList.toggle('on', x.id===id)); }
function openFleet(){
  document.getElementById('screen-about').classList.remove('active'); document.getElementById('screen-story').classList.remove('active'); setNavOn('');
  playStop(); if(FLEET) renderFleet();
  document.getElementById('screen-vessel').classList.remove('active');
  document.getElementById('screen-fleet').classList.add('active');
  curVesselSlug = null; highlightSidebar(null); updateCrumb([{label:'Fleet'}]); closeTagDetail(); closeAnalysis(); window.scrollTo(0,0);
}

/* =====================================================================
   VESSEL — open, date model, date bar
   ===================================================================== */
async function openVessel(slug){
  playStop(); closeTagDetail(); closeAnalysis(); document.getElementById('screen-about').classList.remove('active'); document.getElementById('screen-story').classList.remove('active'); setNavOn('');
  document.getElementById('screen-fleet').classList.remove('active');
  document.getElementById('screen-vessel').classList.add('active');
  document.getElementById('vswitch').value = slug;
  curVesselSlug = slug; highlightSidebar(slug); window.scrollTo(0,0);
  const vv = vesselOf(slug); updateCrumb([{label:'Fleet',onclick:'openFleet()'},{label:vv?vv.name:slug}]);
  if(!V || V.vessel.slug!==slug){
    V = null; _AN = null; TAGS = {}; NOON = []; TRACK = []; FIND_ALL = null;
    for(const k of Object.keys(CL)) delete CL[k]; for(const k of Object.keys(CK)) delete CK[k]; for(const k of Object.keys(TAGD)) delete TAGD[k]; for(const k of Object.keys(SYSS)) delete SYSS[k];
    UI._cards = {}; VESSEL_MODEL._slug = null; document.getElementById('healthNum').textContent='\u2014'; document.getElementById('dateLbl').textContent='loading\u2026';
    for(const id of ['dateBar','content','findInsight','noonNow','clResults','oorList','clPager','oorLimitCard','anBody','sysList','equipList','tagList','findGroups']) document.getElementById(id).innerHTML='';
    document.getElementById('clDateLbl').textContent=''; document.getElementById('oorCountLbl').textContent=''; document.getElementById('chart').innerHTML='';
    try {
      const [detail, tags] = await Promise.all([api(`api/vessel/${slug}`), api(`api/vessel/${slug}/tags`)]);
      if(curVesselSlug!==slug) return;
      V = detail; TAGS = tags; _AN = null; SPAN = V.span && V.span[0] ? V.span : SPAN;
      buildSysTree();
    } catch(e){ showErr('vesselErr', e); return; }
    document.getElementById('vesselErr').innerHTML = '';
    document.getElementById('clTabN').textContent = V.version ? V.version.tag_count.toLocaleString() : '';
    document.getElementById('vesselFoot').textContent = `${V.vessel.name} \u00b7 imo ${V.vessel.imo} \u00b7 ${V.dates.length.toLocaleString()} checks on file \u00b7 ${checks().length} analysed \u00b7 master version ${V.version?V.version.version_id:'\u2014'} (${V.version?V.version.tag_count.toLocaleString():'?'} tags)`;
    api(`api/vessel/${slug}/noon?since=2024-01-01`).then(r=>{ if(curVesselSlug===slug){ NOON = r; buildNoonIndex(); renderNoonNow(curDate); } }).catch(()=>{});
    api(`api/vessel/${slug}/track`).then(r=>{ if(curVesselSlug===slug){ TRACK = r; renderNoonNow(curDate); } }).catch(()=>{});
    initHealthChart();
  }
  document.querySelectorAll('.vtabpanel').forEach(p=>p.classList.remove('active'));
  /* the fleet date follows you into the vessel when that vessel has a check that day */
  const start = (fleetDate && (dateOf(fleetDate) || AN().has(fleetDate))) ? fleetDate : (checks().length ? checks()[checks().length-1].period : (V.dates.length ? V.dates[V.dates.length-1].d : null));
  renderVNav();
  setVTab('overview');
  if(start) await setCheckDate(start); else { document.getElementById('dateLbl').textContent = 'No checks on file for this vessel'; }
}
const VTAB_LABELS = {overview:'Overview', systems:'Systems', findings:'Findings', analysis:'Analysis', rules:'Rules', checklist:'Checklist'};
function setVTab(name){
  document.querySelectorAll('.vtabs button').forEach(b=>b.classList.toggle('active', b.dataset.t===name));
  document.querySelectorAll('.vtabpanel').forEach(p=>p.classList.toggle('active', p.id==='vtab-'+name));
  document.getElementById('vesselWrap').classList.toggle('wide', name!=='overview');
  if(curVesselSlug && V) updateCrumb([{label:'Fleet',onclick:'openFleet()'},{label:V.vessel.name,onclick:`setVTab('overview')`},{label:VTAB_LABELS[name]||name}]);
  if(!V) return;
  if(name==='systems') showSysList();
  if(name==='findings') renderFindingsTab();
  if(name==='analysis') renderAnalysisTab();
  if(name==='rules') renderRules();
  if(name==='checklist') refreshChecklistForDate();
  window.scrollTo(0,0);
}

/* ---- the selected check date drives every tab ---- */
function nearestAnalysedIdx(iso){ let best=-1; checks().forEach((p,i)=>{ if(p.period<=iso) best=i; }); return best<0 ? 0 : best; }
let dpYear = 2026, dpMonth = 6, dpOpen = false;
function dateItems(){ const an = AN(); return HISTORY_DATES().map(x=>({x, analysed:an.has(x), tier:an.has(x)?tier(checks()[an.get(x)].health):null})); }
function syncVesselModel(){
  if(VESSEL_MODEL._slug === curVesselSlug) return;
  VESSEL_MODEL._slug = curVesselSlug; VESSEL_MODEL.dates = dateItems(); VESSEL_MODEL.span = SPAN;
  VESSEL_MODEL.scopes = [{key:'analysed', label:'Analysed', dates:checks().map(p=>p.period), interval:1000},{key:'all', label:'All checks', dates:HISTORY_DATES(), interval:450}];
  if(!VESSEL_MODEL.scopes.some(x=>x.key===VESSEL_MODEL.scope)) VESSEL_MODEL.scope='analysed';
}
/* the floating vessel nav: fill the name and the date chip, and flip .stuck once the bar reaches the top */
function renderVNav(){
  const nav = document.getElementById('vnav'); if(!nav) return;
  const name = (typeof V!=='undefined' && V && V.vessel) ? V.vessel.name : (typeof DISPLAY!=='undefined' && DISPLAY[curVesselSlug] ? DISPLAY[curVesselSlug].name : '');
  const n1 = document.getElementById('vnavName'), n2 = document.getElementById('vheadName');
  if(n1) n1.textContent = name; if(n2) n2.textContent = name;
  const d = document.getElementById('vnavDateTxt'); if(d) d.textContent = curDate ? fmtDate(curDate) : '\u2014';
  if(!nav._probe){
    nav._probe = () => { const r = nav.getBoundingClientRect(); nav.classList.toggle('stuck', r.top <= 1 && window.scrollY > 4); };
    window.addEventListener('scroll', nav._probe, {passive:true}); window.addEventListener('resize', nav._probe, {passive:true});
  }
  requestAnimationFrame(nav._probe);
}
function renderDateBar(){
  const el = document.getElementById('dateBar'); if(!el || !V) return;
  syncVesselModel(); VESSEL_MODEL.set({selected:curDate});
  if(!el.querySelector('#vesselBar')) el.innerHTML = `<div id="vesselBar"><div class="a-datebar"><div class="a-pl"></div><div class="a-tl" id="tlVessel"></div></div></div><div id="stripWrap" class="a-strip-wrap" style="display:none"></div><div id="datePop" class="a-pop" style="display:none;left:0;top:70px"></div>`;
  UI.mountDateBar(document.getElementById('vesselBar'), VESSEL_MODEL, {w:620, 
    label: m => m.scope==='analysed' ? `${checks().length} analysed · every tab, the map and the charts follow the date` : `${m.dates.length.toLocaleString()} checks on file · readings, map and checklist follow the date`,
    extra: UI.info(SRC.timeline), onMore:'toggleDatePop()', open: () => dpOpen });
  const sw = document.getElementById('stripWrap'); sw.style.display = dpOpen ? '' : 'none';
  if(dpOpen){ UI.mountDateStrip(sw, VESSEL_MODEL, {onMore:'toggleDatePop()'}); }
  document.getElementById('datePop').style.display = dpOpen ? 'block' : 'none'; if(dpOpen) renderDatePicker();
}
function renderDatePicker(){ const pop = document.getElementById('datePop'); if(!pop) return; pop.innerHTML = UI.datePicker({dates:VESSEL_MODEL.dates, selected:curDate, year:dpYear, month:dpMonth, onclick:'setCheckDate', onNav:'dpNav'}); pop.style.top = (document.getElementById('vesselBar').offsetHeight + (document.getElementById('stripWrap').offsetHeight||0) + 8) + 'px'; }
function toggleDatePop(){ dpOpen = !dpOpen; if(dpOpen && curDate){ dpYear = +curDate.slice(0,4); dpMonth = +curDate.slice(5,7)-1; } renderDateBar(); }
function dpNav(cmd){ if(cmd==='prev'){ dpMonth--; if(dpMonth<0){ dpMonth=11; dpYear--; } } else if(cmd==='next'){ dpMonth++; if(dpMonth>11){ dpMonth=0; dpYear++; } } else if(cmd.startsWith('y:')){ dpYear=+cmd.slice(2); const inY = HISTORY_DATES().filter(d=>d.startsWith(dpYear+'-')); if(inY.length && !inY.some(d=>+d.slice(5,7)-1===dpMonth)) dpMonth = +inY[inY.length-1].slice(5,7)-1; } renderDatePicker(); }
async function setCheckDate(iso){
  dpOpen = false; curDate = iso;
  const analysed = AN().has(iso);
  curIdx = analysed ? AN().get(iso) : nearestAnalysedIdx(iso);
  const p = checks()[curIdx];
  if(analysed && p){
    document.getElementById("healthNum").textContent = p.health!=null ? p.health.toFixed(1) : '\u2014'; document.getElementById("healthNum").style.color = p.health!=null ? colorFor(p.health) : 'var(--ink-3)';
    document.getElementById("dateLbl").textContent = fmtDate(p.period) + (curIdx===checks().length-1 ? " \u00b7 Latest analysed" : "");
  } else {
    document.getElementById('healthNum').textContent = '\u2014'; document.getElementById('healthNum').style.color = 'var(--ink-3)';
    document.getElementById('dateLbl').innerHTML = p ? `${fmtDate(iso)} \u00b7 readings only, not analysed \u00b7 nearest analysed: <a class="a-link" onclick="setCheckDate('${p.period}')">${fmtDate(p.period)}</a>` : `${fmtDate(iso)} \u00b7 readings only \u00b7 no analysed check yet`;
  }
  if(document.getElementById('prevPt')) { document.getElementById('prevPt').disabled = curIdx<=winStart; document.getElementById('nextPt').disabled = curIdx>=checks().length-1; }
  drawChart(); renderDateBar(); renderNoonNow(iso);
  refreshDateViews();
  await renderOverviewFindings(p, analysed);
}
function refreshDateViews(){
  UI.setCursor(curDate); renderUms(); renderVNav();
  const sn = document.getElementById('sysDateNote'); if(sn) sn.textContent = curDate ? `Readings from the ${fmtDate(curDate)} walkaround \u2014 out of range = in_range false as stored with the reading.` : '';
  const fn = document.getElementById('findDateNote'); if(fn) fn.textContent = curDate ? (AN().has(curDate) ? `The ${fmtDate(curDate)} check is analysed \u2014 its findings are in the list below, with every other analysed check of this vessel.` : `The ${fmtDate(curDate)} check is not analysed \u2014 the list below holds every finding across this vessel's ${checks().length} analysed checks.`) : '';
  const active = document.querySelector('.vtabpanel.active')?.id;
  if(active==='vtab-systems') renderTagPane();
  if(active==='vtab-checklist') refreshChecklistForDate();
  if(active==='vtab-analysis') renderAnalysisTab();
}
function selectLatest(){ if(checks().length) setCheckDate(checks()[checks().length-1].period); }
function stepPoint(d){ const i = Math.max(winStart, Math.min(checks().length-1, curIdx+d)); if(checks()[i]) setCheckDate(checks()[i].period); }

/* =====================================================================
   OVERVIEW — health chart (hand-rolled, as in the reference), open items, findings
   ===================================================================== */
const W=632,H=140,PAD_L=6,PAD_R=6,PAD_T=14,PAD_B=8;
let dates=[], minT=0, maxT=1, winStart=0, winKey='all', minV=0, maxV=100;
function initHealthChart(){
  dates = checks().map(p=>new Date(p.period+"T00:00:00Z").getTime());
  const vals = checks().map(p=>p.health).filter(v=>v!=null);
  minV = (vals.length?Math.min(...vals):60)-6; maxV = (vals.length?Math.max(...vals):90)+6;
  winKey='all'; winStart=0; minT = dates[0]||0; maxT = dates[dates.length-1]||1; if(maxT===minT) maxT = minT + 86400000*30;
  renderHealthWin();
  document.getElementById('hAx0').textContent = checks().length ? fmtDate(checks()[winStart].period) : '';
  document.getElementById('hAx1').textContent = checks().length ? fmtDate(checks()[checks().length-1].period) + ' \u2192 next \u00b7 provision, not a forecast' : '';
}
function setHealthWin(key){
  winKey=key; const days={'90d':90,'12m':365,'all':null}[key];
  winStart = days ? Math.max(0, dates.findIndex(t=> t >= dates[dates.length-1]-days*86400000)) : 0;
  minT = dates[winStart]; maxT = dates[dates.length-1]; if(maxT===minT) maxT = minT + 86400000*30;
  renderHealthWin();
  document.getElementById('hAx0').textContent = fmtDate(checks()[winStart].period);
  if(curIdx < winStart) setCheckDate(checks()[checks().length-1].period); else drawChart();
}
function renderHealthWin(){
  const n = checks().length-winStart;
  document.getElementById('healthWin').innerHTML = UI.period({options:[{key:'90d',label:'90d'},{key:'12m',label:'12M'},{key:'all',label:'All'}], active:winKey, onclick:'setHealthWin'}) + `<div style="font-size:11.5px;color:var(--ink-3);margin-top:4px">${n} analysed check${n===1?'':'s'} in view</div>`;
}
function xFor(t){return PAD_L+(t-minT)/((maxT-minT)*(1+FUTURE))*(W-PAD_L-PAD_R);}
function yFor(v){return H-PAD_B-(v-minV)/(maxV-minV)*(H-PAD_T-PAD_B);}
function drawChart(){
  const svg=document.getElementById("chart"); const T = checks();
  if(!T.length){ svg.innerHTML = `<text x="${W/2}" y="${H/2}" text-anchor="middle" font-size="9" fill="#8E8E93">No analysed check yet for this vessel</text>`; return; }
  const vis = T.map((p,i)=>i).filter(i=>i>=winStart && T[i].health!=null);
  const linePts = vis.map(i=>`${xFor(dates[i]).toFixed(1)},${yFor(T[i].health).toFixed(1)}`).join(" ");
  const cur=T[curIdx]; const cx=xFor(dates[curIdx]), cy=cur.health!=null ? yFor(cur.health) : H/2;
  const clampY = v => Math.max(PAD_T, Math.min(H-PAD_B, yFor(Math.max(minV, Math.min(maxV, v)))));
  const zones = HEALTH_ZONES.map(z=>{ const top=clampY(z.hi), bot=clampY(z.lo); return bot-top>0.5 ? `<rect x="${PAD_L}" y="${top.toFixed(1)}" width="${W-PAD_L-PAD_R}" height="${(bot-top).toFixed(1)}" fill="${z.color}" opacity="0.07"/><text x="${W-PAD_R-4}" y="${(top+9).toFixed(1)}" text-anchor="end" font-size="7" fill="${z.color}" opacity=".9">${z.hi===100?'good \u226583':z.lo===73?'satisfactory 73\u201383':'attention <73'}</text>` : ''; }).join('');
  const xl = xFor(maxT), xe = W-PAD_R;
  const futureZone = `<rect x="${xl.toFixed(1)}" y="${PAD_T-4}" width="${(xe-xl).toFixed(1)}" height="${H-PAD_T-PAD_B+4}" fill="#8E8E93" opacity="0.07"/><line x1="${xl.toFixed(1)}" x2="${xl.toFixed(1)}" y1="${PAD_T-4}" y2="${H-PAD_B}" stroke="#AEAEB2" stroke-width="1" stroke-dasharray="2,3"/>`;
  const curMark = AN().has(curDate) ? `<line x1="${cx.toFixed(1)}" y1="${PAD_T-4}" x2="${cx.toFixed(1)}" y2="${H-PAD_B}" stroke="${colorFor(cur.health)}" stroke-width="1.4" stroke-dasharray="3,3" opacity="0.6"/><circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="5.5" fill="${colorFor(cur.health)}" stroke="#fff" stroke-width="2"/>`
    : (curDate ? `<line x1="${xFor(new Date(curDate+'T00:00:00Z').getTime()).toFixed(1)}" y1="${PAD_T-4}" x2="${xFor(new Date(curDate+'T00:00:00Z').getTime()).toFixed(1)}" y2="${H-PAD_B}" stroke="#0071E3" stroke-width="1.2" stroke-dasharray="3,3" opacity="0.7"/>` : '');
  svg.innerHTML = `${zones}${futureZone}
    <polyline points="${linePts}" fill="none" stroke="#1D3C67" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>
    ${vis.map(i=>`<circle cx="${xFor(dates[i]).toFixed(1)}" cy="${yFor(T[i].health).toFixed(1)}" r="${i===curIdx?0:2}" fill="#1D3C67" opacity="0.5"/>`).join("")}${curMark}`;
}
function nearestIndexForX(px){ let best=0,bestDist=Infinity; checks().forEach((p,i)=>{ if(i<winStart) return; const x=xFor(dates[i]); const dist=Math.abs(x-px); if(dist<bestDist){bestDist=dist;best=i;}}); return best; }
(function wireScrub(){ const svgEl = document.getElementById("chart"); const svgX = evt => { const rect=svgEl.getBoundingClientRect(); return (evt.clientX-rect.left)/rect.width*W; }; let dragging=false, lastI=-1;
  const go = e => { if(!checks().length) return; const i = nearestIndexForX(svgX(e)); if(i!==lastI){ lastI=i; setCheckDate(checks()[i].period); } };
  svgEl.addEventListener("pointerdown", e=>{ dragging=true; lastI=-1; go(e); }); window.addEventListener("pointermove", e=>{ if(dragging) go(e); }); window.addEventListener("pointerup", ()=>{ dragging=false; }); })();

async function loadCheck(cf){ if(!cf) return null; if(CK[cf]) return CK[cf]; try { const d = await api(`api/vessel/${curVesselSlug}/check/${cf}`); CK[cf] = d; return d; } catch(e){ return null; } }
function renderFindInsight(ck){
  const T = checks(); const n = T.length; const f = ck ? ck.counts : (T[curIdx] || {high:0,medium:0});
  const avgHigh = n ? T.reduce((s,p)=>s+p.high,0) / n : 0, avgMed = n ? T.reduce((s,p)=>s+p.medium,0) / n : 0;
  let sentence;
  if(f.high > avgHigh) sentence = `This check has more high-severity open items (${f.high}) than the vessel's own ${n}-check average (${avgHigh.toFixed(1)}).`;
  else if(f.high===0 && f.medium <= avgMed) sentence = `No high-severity items this check \u2014 medium-severity is at or below the vessel's own average.`;
  else sentence = `${f.high} high, ${f.medium} medium open item${f.medium===1?'':'s'} this check \u2014 in line with the vessel's own ${n}-check history.`;
  const period = T[curIdx] ? T[curIdx].period : curDate;
  document.getElementById('findInsight').innerHTML = UI.insightCard({
    icon:{glyph:'!', color:'#B85D00'}, title:'Open items', meta:fmtDate(period), source:SRC.openItems,
    sentence: commentFor('overview.openItems.'+period, sentence),
    compare:[{label:'This check', color:'var(--brand)', parts:[{value:f.high, unit:'high'},{value:f.medium, unit:'medium'}]},
             {label:`Average, ${n} analysed checks`, color:'var(--ink-3)', parts:[{value:avgHigh.toFixed(1), unit:'high'},{value:avgMed.toFixed(1), unit:'medium'}]}],
    viz:`<div id="findChart" style="margin-top:6px"></div><p class="scrubhint" style="text-align:left;padding:0;margin-top:6px">One pair of bars per analysed check (red = high, amber = medium); the shaded column is the check you're on.</p>`,
    foot: UI.nav({icon:{glyph:'\u2261', color:'#1D3C67'}, label:'All findings, grouped by system', onclick:"setVTab('findings')"})
  });
  drawFindChart();
}
function drawFindChart(){
  const el = document.getElementById('findChart'); if(!el) return; const T = checks(); if(!T.length){ el.innerHTML=''; return; }
  el.innerHTML = UI.barChart({series:[{label:'high', color:'#E30019', points:T.map(p=>({x:p.period, v:p.high}))},{label:'medium', color:'#FE9413', points:T.map(p=>({x:p.period, v:p.medium}))}], stacked:false, spacing:'even', highlightX:T[curIdx]?T[curIdx].period:null, w:1100, h:200});
}
let toggleId = 0;
async function renderOverviewFindings(p, analysed){
  const el = document.getElementById("content");
  if(!p){ renderFindInsight(null); el.innerHTML = `<p class="plain-note">No analysed check yet for this vessel \u2014 readings, checklist and noon reports are available on the other tabs.</p>`; return; }
  const ck = await loadCheck(p.cf); if(curVesselSlug!==V?.vessel.slug) return;
  renderFindInsight(ck);
  if(!ck){ el.innerHTML = `<p class="plain-note">Could not load the ${fmtDate(p.period)} check.</p>`; return; }
  const lead = analysed ? '' : `<p class="plain-note" style="padding-top:0">The ${fmtDate(curDate)} check is not analysed. Below: the nearest analysed check, <b>${fmtDate(p.period)}</b>.</p>`;
  if(!ck.findings.length){
    el.innerHTML = lead + `<div class="decision2"><h1>Nothing flagged</h1><p>${ck.counts.scored} of ${ck.counts.clusters} systems scored, health ${ck.health!=null?ck.health:'\u2014'} on ${fmtDate(p.period)}.</p></div>`; return;
  }
  const high = ck.findings.filter(a=>a.severity==='high'), med = ck.findings.filter(a=>a.severity==='medium'), low = ck.findings.filter(a=>a.severity==='low');
  toggleId = 0;
  const rows = (list, autoOpenFirst) => list.map((a,i)=>{ const id = 'f'+(toggleId++); return frow(id, a, autoOpenFirst && i===0, false); }).join("");
  el.innerHTML = lead + `
    <div class="decision2"><h1>${high.length} high, ${med.length} medium open item${med.length===1?'':'s'}</h1>
      <p>${ck.counts.scored} of ${ck.counts.clusters} systems scored, health ${ck.health!=null?ck.health:'\u2014'} (${ck.status}) on ${fmtDate(p.period)}.</p></div>
    ${high.length ? `<p class="fgroup-lbl">High</p>` + rows(high, true) : ""}
    ${med.length ? `<p class="fgroup-lbl">Medium</p>` + rows(med, false) : ""}
    ${low.length ? `<div class="lowline" id="lowlbl" data-closed="+${low.length} low / data-quality items \u25be" onclick="toggleLow()">+${low.length} low / data-quality items \u25be</div><div class="lowgroup" id="lowgroup">${rows(low, false)}</div>` : ""}`;
  document.querySelectorAll('#content .frow.open').forEach(mountFindingCards);
}
const PERSP_NAME = {'main-engine-propulsion':'Main Engine / Propulsion','power-generation-electrical':'Power Generation / Electrical','boiler-steam':'Boiler / Steam','boiler-auxiliary':'Boiler / Auxiliary','cooling-freshwater':'Cooling / Freshwater','fuel-lube-oil':'Fuel / Lube Oil','hotel-auxiliary':'Hotel / Auxiliary','navigation-steering':'Navigation / Steering','safety-environmental':'Safety / Environmental','ums-readiness':'UMS Readiness','voyage-performance':'Voyage Performance','cross-system':'Cross-System','compressed-air-system':'Compressed Air','daily-overview':'Daily overview'};
const perspName = s => PERSP_NAME[s] || (s||'').replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
const FROWS = {};
function frow(id, a, open, withDate){
  FROWS[id] = a;
  return `<div class="frow ${open?'open':''}" id="${id}">
    <div class="frow-head" onclick="toggleFind('${id}')">
      <span class="dot" style="background:${a.severity==='high'?'var(--alarm)':a.severity==='medium'?'var(--warning)':'var(--ink-3)'}"></span>
      <div class="h">${esc(a.headline)}</div>${findingPreview(a)}
      ${withDate?`<span style="font-size:12px;color:var(--ink-3);flex-shrink:0;margin-top:2px">${a.period?fmtDate(a.period):'undated'}</span>`:''}
      <span class="chev">\u203a</span>
    </div>
    <div class="frow-detail"><div class="txt md">${mdToHtml(a.body)}${a.action_required?`<p style="color:var(--warning-ink)">\u2192 ${esc(a.action_required)}</p>`:''}<p style="font-size:12px;color:var(--ink-3)">${esc(perspName(a.perspective))}${a.evidence_from?` \u00b7 evidence via ${esc(a.evidence_from)}`:''}</p></div><div class="frow-cards"></div></div>
  </div>`;
}
function findingPreview(a){ if(!a.evidence || !a.evidence.length) return '<span class="fprev fprev-none">narrative</span>'; const e = a.evidence[0]; return `<span class="fprev"><b>${esc(e.value||'')}</b><em>${esc(e.label||e.tag_id)}</em></span>`; }
function toggleFind(id){ const row = document.getElementById(id); row.classList.toggle('open'); if(row.classList.contains('open')) mountFindingCards(row); }
function toggleLow(){ document.getElementById('lowgroup').classList.toggle('open'); const el = document.getElementById('lowlbl'); el.textContent = document.getElementById('lowgroup').classList.contains('open') ? 'Hide low/data-quality items \u25b4' : el.dataset.closed; }
function shortName(name){ return ((name||'').split(')').pop().trim()) || name; }
async function loadTag(id){ if(TAGD[id]) return TAGD[id]; const d = await api(`api/vessel/${curVesselSlug}/tag/${id}`); TAGD[id] = d; return d; }
function tagPoints(id){ const d = TAGD[id]; return d ? d.series.map(([x,v])=>({x,v})) : []; }
function tagStates(id){ const d = TAGD[id]; return d ? d.states.map(([x,s])=>({x,s})) : []; }
function tagMeta(id){ const g = TAGS[id] || (TAGD[id] && TAGD[id].meta) || {}; return {name:g.name||id, unit:g.unit||'', lo:g.lo??null, hi:g.hi??null, system:g.system||'', equipment:g.equipment||''}; }
function expectedState(id){ const m = tagMeta(id); return m.lo==null && m.unit && /^[A-Za-z]/.test(m.unit) ? m.unit : ''; }
/* a supporting chart card per evidence tag, mounted once, under the finding row */
function mountFindingCards(row){
  const holder = row.querySelector('.frow-cards'); if(!holder || holder.dataset.mounted) return;
  holder.dataset.mounted = '1'; const a = FROWS[row.id]; const tags = a ? a.evidence : [];
  if(!tags.length){ holder.innerHTML = `<p class="plain-note" style="padding:6px 0">This finding is a narrative read across the check \u2014 no tag is tied to it in the note's evidence, so there is no reading to chart.</p>`; return; }
  holder.innerHTML = tags.map((e,i)=>`<div id="${row.id}-c${i}"><p class="plain-note" style="padding:6px 0">Loading ${esc(e.label||e.tag_id)}\u2026</p></div>`).join('');
  tags.forEach((e,i)=>{ loadTag(e.tag_id).then(()=>{
      const m = tagMeta(e.tag_id), pts = tagPoints(e.tag_id), sts = pts.length ? [] : tagStates(e.tag_id); const el = document.getElementById(`${row.id}-c${i}`); if(!el) return;
      UI.mountChartCard(el, { id:`${row.id}-c${i}`, compact:true, source:SRC.evidence, icon:{glyph:'\u223f', color:'#1D3C67'}, title:shortName(m.name), meta:`${e.value||''}`.trim(),
        sentence: commentFor('finding.'+a.id+'.'+e.tag_id, commentFor('tag.'+e.tag_id, (pts.length || sts.length) ? '' : `Read as "${e.value}" on this check \u2014 no history for this tag.`)),
        points: pts, states: sts, expected: expectedState(e.tag_id), band:{lo:m.lo, hi:m.hi}, unit:m.unit, defaultRange:'90d', onclick: `openTagDetail('${e.tag_id}')`, foot: 'Click the chart for the full tag detail \u203a' });
    }).catch(()=>{ const el = document.getElementById(`${row.id}-c${i}`); if(el) el.innerHTML = `<p class="plain-note">Could not load ${esc(e.tag_id)}.</p>`; }); });
}

/* =====================================================================
   FINDINGS TAB — every postit of the vessel, grouped by cluster
   ===================================================================== */
let findSevOn = {high:true, medium:true, low:false};
function toggleFindSev(sev){ findSevOn[sev] = !findSevOn[sev]; document.querySelector(`.chip[data-sev="${sev}"]`).classList.toggle('active', findSevOn[sev]); renderFindingsTab(); }
async function renderFindingsTab(){
  if(!FIND_ALL){ try { FIND_ALL = await api(`api/vessel/${curVesselSlug}/findings`); } catch(e){ showErr('findGroups', e); return; } }
  const all = FIND_ALL; const counts = {high:0,medium:0,low:0}; all.forEach(a=>counts[a.severity]++);
  document.getElementById('findCountHigh').textContent = counts.high; document.getElementById('findCountMedium').textContent = counts.medium; document.getElementById('findCountLow').textContent = counts.low;
  document.getElementById('findScopeLbl').textContent = `${all.length} post-it notes across ${checks().length} analysed checks`;
  const shown = all.filter(a=>findSevOn[a.severity]); const groups = {};
  shown.forEach(a=>{ (groups[a.perspective]=groups[a.perspective]||[]).push(a); });
  const order = Object.keys(groups).sort((x,y)=> groups[y].length - groups[x].length); let fid = 0;
  document.getElementById('findGroups').innerHTML = order.length ? order.map(k=>{ const items = groups[k].sort((a,b)=> (a.period||'') < (b.period||'') ? 1 : -1);
    return `<div class="section"><p class="grouplbl">${esc(perspName(k))} <span>${items.length}</span></p><div>${items.map(a=>frow('ff'+(fid++), a, false, true)).join("")}</div></div>`; }).join("") : `<p class="plain-note">No findings at this severity.</p>`;
}

/* =====================================================================
   SYSTEMS TAB — system › equipment › tags, values on the selected check
   ===================================================================== */
let SYS_TREE = {}, curSystem = null, curEquip = null;
function buildSysTree(){ SYS_TREE = {}; Object.entries(TAGS).forEach(([id,t])=>{ (SYS_TREE[t.system] = SYS_TREE[t.system] || {})[t.equipment] = (SYS_TREE[t.system][t.equipment] || []); SYS_TREE[t.system][t.equipment].push(id); }); curSystem = V.systems[0] ? V.systems[0].system : null; curEquip = null; }
function equipmentOf(sys){ const eq = SYS_TREE[sys] || {}; return Object.keys(eq).map(e=>({equipment:e, n:eq[e].length})).sort((a,b)=>b.n-a.n); }
const curCl = () => CL[cfOf(curDate)] || null;
function readingAt(id){ const c = curCl(); if(!c) return null; return c.byTag[id] || null; }
function sysOOR(sys){ const c = curCl(); return c ? c.rows.filter(r=>r.oor && r.s===sys).length : 0; }
function sysCited(sys){ const eq = SYS_TREE[sys]||{}; return Object.values(eq).some(ids=>ids.some(id=>TAGS[id].cited>0)); }
async function ensureChecklist(iso){ const cf = cfOf(iso||curDate); if(!cf) return null; if(CL[cf]) return CL[cf]; const d = await api(`api/vessel/${curVesselSlug}/checklist/${cf}`); d.byTag = {}; d.rows.forEach((r,i)=>{ if(!d.byTag[r.t]) d.byTag[r.t] = Object.assign({idx:i+1}, r); }); CL[cf] = d; return d; }
function showSysList(){ renderSysPane(); ensureChecklist().then(()=>{ renderSysPane(); }).catch(()=>{}); }
function renderSysPane(){
  const el = document.getElementById('sysList'); document.getElementById('sysCount').textContent = V.systems.length;
  el.innerHTML = V.systems.map(({system:name, tags:count})=>`<div class="prow ${name===curSystem?'active':''}" onclick="selectSystem('${name.replace(/'/g,"\\'")}')">
      <span class="cdot" style="background:${sysOOR(name)?'#E30019':sysCited(name)?'#FE9413':'#D2D2D7'}" title="${sysOOR(name)?sysOOR(name)+' out of range on this check':''}"></span><span>${esc(name)}</span><span class="n">${count}</span></div>`).join("");
  renderEquipPane();
}
function selectSystem(name){ curSystem = name; renderSysPane(); }
function renderEquipPane(){
  document.getElementById('equipPaneLbl').innerHTML = `${esc(curSystem||'')} <span>equipment</span>`;
  const el = document.getElementById('equipList'); const list = equipmentOf(curSystem);
  if(!list.length){ el.innerHTML = `<p class="plain-note">No tags classified under ${esc(curSystem||'')}.</p>`; renderTagPane(); return; }
  if(!list.find(e=>e.equipment===curEquip)) curEquip = list[0].equipment;
  el.innerHTML = list.map(e=>`<div class="prow ${e.equipment===curEquip?'active':''}" onclick="selectEquip('${e.equipment.replace(/'/g,"\\'")}')"><span>${esc(e.equipment.replace('M/E ',''))}</span><span class="n">${e.n}</span></div>`).join("");
  renderTagPane();
}
function selectEquip(name){ curEquip = name; renderEquipPane(); }
let tagFilterOpts = {type:'all', citedFirst:false, oorOnly:false};
function setTagType(v){ tagFilterOpts.type = v; document.querySelectorAll('#tagTypeSeg button').forEach(b=>b.classList.toggle('on', b.dataset.v===v)); renderTagPane(); }
function toggleTagOpt(opt){ tagFilterOpts[opt] = !tagFilterOpts[opt]; document.getElementById(opt==='citedFirst'?'citedFirstChip':'oorOnlyChip').classList.toggle('active', tagFilterOpts[opt]); renderTagPane(); }
function seriesWindow(){ const d = new Date((curDate||'2026-07-07')+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()-90); return [d.toISOString().slice(0,10), curDate]; }
function sysSeries(system){ const [from,to] = seriesWindow(); const k = system+'|'+to; if(SYSS[k]) return SYSS[k].data || null; SYSS[k] = {data:null}; api(`api/vessel/${curVesselSlug}/series?system=${encodeURIComponent(system)}&from=${from}&to=${to}`).then(d=>{ SYSS[k].data = d; if(curSystem===system) renderTagPane(); }).catch(()=>{}); return null; }
function renderTagPane(){
  if(!V || !curSystem) return;
  const ids = ((SYS_TREE[curSystem]||{})[curEquip]) || [];
  const ss = sysSeries(curSystem); const cl = curCl();
  document.getElementById('tagPaneLbl').innerHTML = `${esc(curEquip||'')} <span>${ids.length} tags${ss?'':' \u00b7 loading 90-day history\u2026'}${cl?'':' \u00b7 loading readings\u2026'}</span>`;
  const el = document.getElementById('tagList'); const filterBar = document.getElementById('tagFilterBar');
  if(!ids.length){ filterBar.style.display='none'; el.innerHTML = `<p class="plain-note">Pick an equipment group on the left.</p>`; return; }
  filterBar.style.display = 'flex';
  const q = (document.getElementById('tagSearch').value||'').toLowerCase();
  const rows = ids.map(id=>{ const m = tagMeta(id); const r = readingAt(id); const s = ss && ss[id]; const pts = s ? s.p.map(([x,v])=>({x,v})) : []; const sts = s && !pts.length ? s.s : [];
    return {id, m, cl:r, pts, sts, numeric: pts.length>0 || (r && r.num!=null), oor: !!(r && r.oor), cited: (TAGS[id]||{}).cited>0}; });
  let pool = rows.filter(r=>{ if(tagFilterOpts.type==='numeric' && !r.numeric) return false; if(tagFilterOpts.type==='state' && r.numeric) return false; if(tagFilterOpts.oorOnly && !r.oor) return false; if(q && !r.m.name.toLowerCase().includes(q) && !r.id.includes(q)) return false; return true; });
  pool.sort((a,b)=>{ if(tagFilterOpts.citedFirst){ const c=(b.cited?1:0)-(a.cited?1:0); if(c) return c; } const o=(b.oor?1:0)-(a.oor?1:0); if(o) return o; return (b.cited?1:0)-(a.cited?1:0); });
  if(!pool.length){ el.innerHTML = `<p class="plain-note">No tags match this filter.</p>`; return; }
  el.innerHTML = pool.map(r=>{
    const cl = r.cl; const th = cl && cl.th || null; const rc = UI.rangeChain(th, cl?cl.mn:null, cl?cl.mx:null); if(!rc.band && !rc.stateBands && r.m.lo!=null && r.m.hi!=null) Object.assign(rc, {band:{lo:r.m.lo, hi:r.m.hi}, bandName:'master'});
    const states = th ? th.states.map(x=>Object.assign({}, x, {expected: th.exp!=null && x.s.trim().toLowerCase()===th.exp.trim().toLowerCase()})) : [];
    return UI.readingRow({id:r.id, name:shortName(r.m.name), time:cl?cl.ts:'', system:'', equipment:'', value:cl?cl.v:'', num:cl?cl.num:null, unit:cl?cl.u:r.m.unit, band:rc.band||null, bandName:rc.bandName||'', stateBands:rc.stateBands||null,
      expected: th && th.exp ? th.exp : '', states, review: !!(th && th.review), prev: cl ? cl.prev : null, oor:r.oor, judged: cl ? cl.judged!==false : true, cited:r.cited,
      spark:r.pts, statesN:r.sts.length, loading:!ss, onclick:`openTagDetail('${r.id}')`});
  }).join("");
}

/* =====================================================================
   TAG DETAIL — slide-over
   ===================================================================== */
async function openTagDetail(tagId){
  document.getElementById('tdBackdrop').classList.add('open'); document.getElementById('tdPanel').classList.add('open');
  document.getElementById('tdHead').innerHTML = `<p class="loading">Loading ${esc(tagId)}\u2026</p>`; document.getElementById('tdStats').innerHTML=''; document.getElementById('tdChartCard').innerHTML=''; document.getElementById('tdCylChart').innerHTML=''; document.getElementById('tdFindings').innerHTML='';
  let d; try { [d] = await Promise.all([loadTag(tagId), ensureChecklist().catch(()=>null)]); } catch(e){ document.getElementById('tdHead').innerHTML = `<div class="err">${esc(e.message)}</div>`; return; }
  if(!d.meta){ document.getElementById('tdHead').innerHTML = `<div class="err">Tag ${esc(tagId)} is not in this vessel's current master version.</div>`; return; }
  const m = tagMeta(tagId); const cl = readingAt(tagId); const cites = d.citations.length; const hasBand = m.lo!=null && m.hi!=null;
  const th = (cl && cl.th) || d.meta.th || null;
  const pill = cl && cl.oor ? {state:'alarm', label:'Out of range'} : (th && th.review) ? {state:'watch', label:'Threshold not yet reviewed'} : (cl && cl.judged && th) ? {state:'ok', label: th.exp ? 'Expected state' : 'Within the band'} : (cl && cl.num!=null && hasBand) ? {state:'ok', label:'In range'} : {state:'none', label: cl ? (th ? 'Read \u00b7 not judged' : 'No threshold yet') : 'Not read on this walkaround'};
  const total = curCl() ? curCl().rows.length : 0;
  document.getElementById('tdHead').innerHTML = UI.detailHeader({ breadcrumb: (m.system||'') + (m.equipment ? ' \u203a ' + m.equipment : ''), name: shortName(m.name), pill, threshold: UI.thresholdLine(th, {value: cl ? cl.v : null, mn: cl ? cl.mn : m.lo, mx: cl ? cl.mx : m.hi, unit: m.unit}),
    link: {label: cl ? `Seen in the ${fmtDate(curDate)} checklist, row ${cl.idx} of ${total.toLocaleString()}` : 'Not read on this walkaround', onclick:`openChecklistFromTag('${tagId}')`} });
  const pts = tagPoints(tagId), sts = pts.length ? [] : tagStates(tagId);
  let latest, unchanged;
  if(pts.length){ const st = UI.stats(pts); let n=1; for(let i=pts.length-2;i>=0 && pts[i].v===st.latest;i--) n++; latest = {v:UI.fmtNum(st.latest), unit:m.unit}; unchanged = {v:n, unit:`of ${pts.length} readings`}; }
  else if(sts.length){ const ss = UI.stateStats(sts); latest = {v:ss.latest, unit:''}; unchanged = {v:ss.streak, unit:`of ${ss.n} readings`}; }
  else { latest = {v: cl ? cl.v : '\u2014', unit: cl ? (cl.u||'') : ''}; unchanged = {v:'\u2014', unit:'no history'}; }
  document.getElementById('tdStats').innerHTML = UI.rowsCard({title:'Reading', meta:'', source:SRC.tagStats, rows:[
    {k:'Latest', v: latest.v, unit: latest.unit}, {k:'Unchanged for', v: unchanged.v, unit: unchanged.unit},
    {k:'Expected band', v:`${m.lo}\u2013${m.hi}`, unit: m.unit, hidden: !hasBand}, {k:'Cited in findings', v: cites, unit:`agent report${cites===1?'':'s'}`} ]});
  document.getElementById('tdCylChart').style.display = d.siblings.length ? '' : 'none';
  if(d.siblings.length) drawSiblingBars(tagId);
  UI.mountChartCard(document.getElementById('tdChartCard'), { id:'td-'+tagId, source:SRC.tagSeries, icon:{glyph:'\u223f', color:'#1D3C67'}, title:'History', meta:`${(pts.length||sts.length).toLocaleString()} readings`, sentence: commentFor('tag.'+tagId),
    points: pts, states: sts, expected: expectedState(tagId), band:{lo:m.lo, hi:m.hi}, unit:m.unit, defaultRange:'90d', future: FUTURE });
  document.getElementById('tdFindCount').textContent = cites;
  document.getElementById('tdFindings').innerHTML = cites ? d.citations.map(f=>`<div class="findrow" style="padding:12px 4px"><span class="dot" style="background:var(--warning);margin-top:6px"></span>
      <div class="body"><div style="font-size:12px;color:var(--ink-3);margin-bottom:2px">${f.period?fmtDate(f.period):''} \u00b7 ${esc(perspName(f.perspective))}${f.value?' \u00b7 read '+esc(f.value):''}</div><div class="p" style="color:var(--ink);font-size:13.5px">${esc(f.excerpt)}\u2026</div></div></div>`).join("")
    : `<p class="plain-note">No agent report cites this parameter.</p>`;
}
function closeTagDetail(){ document.getElementById('tdBackdrop').classList.remove('open'); document.getElementById('tdPanel').classList.remove('open'); }
function openChecklistFromTag(tagId){ closeTagDetail(); setVTab('checklist'); const r = readingAt(tagId); document.getElementById('clSearch').value = r ? r.n : ''; searchChecklist(); document.getElementById('clResults').scrollIntoView({block:'start'}); }
function drawSiblingBars(tagId){
  const d = TAGD[tagId]; if(!d) return; const m = tagMeta(tagId); const cl = curCl();
  const groups = d.siblings.map(x=>{ const r = cl ? cl.byTag[x.id] : null; return {label:'#'+x.idx, v: r && r.num!=null ? r.num : null, s: r ? r.v : null, highlight:x.id===tagId, id:x.id, name:x.name}; });
  const numeric = groups.some(g=>g.v!=null);
  const body = UI.head({icon:{glyph:'\u2261', color:'#1D3C67'}, title:`All ${d.siblings.length} \u00b7 ${d.family}`, meta: fmtDate(curDate), source:SRC.siblings}) +
    `<p class="a-sentence" style="font-size:13.5px;margin:6px 0 8px">${esc(commentFor('family.'+d.family, cl ? (numeric ? 'Same reading across the siblings on this check \u2014 the highlighted bar is this tag; the shaded band is its expected range.' : 'Same reading across the siblings on this check.') : 'Loading the readings of this check\u2026'))}</p>` +
    (numeric ? UI.groupBars({groups, band:{lo:m.lo, hi:m.hi}, unit:m.unit, h:170})
             : `<div class="a-rows">${groups.map(g=>`<div class="a-row"><span class="k" style="${g.highlight?'font-weight:600':''}">${esc(g.label)} <span style="color:var(--ink-3);font-weight:400">${esc(g.name||'')}</span></span><span class="v"><b>${esc(g.s??'\u2014')}</b></span></div>`).join('')}</div>`) +
    `<div class="a-foot">${groups.map(g=>`<span class="a-link" onclick="openTagDetail('${g.id}')">${esc(g.label)}</span>`).join(' \u00b7 ')}</div>`;
  document.getElementById('tdCylChart').innerHTML = UI.card({body});
}

/* =====================================================================
   CHECKLIST TAB — every reading of the selected check
   ===================================================================== */
function isCited(t){ return (TAGS[t]||{}).cited>0; }
/* 90-day series for a handful of visible rows (checklist page, out-of-range list): one batch call, cached per tag|window */
const ROWSER = {};
function rowSeries(ids, onDone){
  const [from,to] = seriesWindow(); const need = ids.filter(id=>!(ROWSER[id+'|'+to]));
  if(need.length){ need.forEach(id=>ROWSER[id+'|'+to] = {p:[], s:[], pending:true}); const slug = curVesselSlug;
    api(`api/vessel/${slug}/series?tags=${need.join(',')}&from=${from}&to=${to}`).then(d=>{ need.forEach(id=>{ ROWSER[id+'|'+to] = d[id] || {p:[], s:[]}; }); if(curVesselSlug===slug && onDone) onDone(); }).catch(()=>{ need.forEach(id=>{ ROWSER[id+'|'+to] = {p:[], s:[], failed:true}; }); if(curVesselSlug===slug && onDone) onDone(); }); }
  return id => ROWSER[id+'|'+to];
}
function readingRowFor(r, ser, idx){
  const m = TAGS[r.t] || {}; const th = r.th || null;
  const rc = UI.rangeChain(th, r.mn, r.mx); if(!rc.band && !rc.stateBands && m.lo!=null && m.hi!=null) Object.assign(rc, {band:{lo:m.lo, hi:m.hi}, bandName:'master'});
  const states = th ? th.states.map(x=>Object.assign({}, x, {expected: th.exp!=null && x.s.trim().toLowerCase()===th.exp.trim().toLowerCase()})) : [];
  const sp = ser ? ser(r.t) : null;
  return UI.readingRow({id:r.t, idx, name:r.n, time:r.ts, system:r.s, equipment:r.e, value:r.v, num:r.num, unit:r.u, band:rc.band||null, bandName:rc.bandName||'', stateBands:rc.stateBands||null,
    expected: th && th.exp ? th.exp : '', states, review: !!(th && th.review), prev:r.prev, oor:r.oor, judged:r.judged!==false, cited:isCited(r.t),
    spark: sp && !sp.pending ? sp.p.map(([x,v])=>({x,v})) : [], statesN: sp && !sp.pending ? sp.s.length : 0, loading: !!(sp && sp.pending), critical: UMS_CRITICAL.has(r.t), onclick:`openTagDetail('${r.t}')`});
}
function clRow(r, cited){
  return `<div class="crow" onclick="openTagDetail('${r.t}')"><span class="cdot" style="background:${r.oor?'#E30019':cited?'#FE9413':'#D2D2D7'}"></span>
    <div class="cname" style="min-width:0;flex:1.6;font-weight:${cited?'700':'560'}">${esc(r.n)}</div><div class="cmeta" style="flex:0.7">${esc(r.ts)} \u00b7 ${esc(r.s)}</div>
    <div class="chealth" style="min-width:auto;font-weight:600">${esc(r.v)} ${esc(r.u||'')}</div>
    <div style="width:150px;text-align:right;display:flex;gap:8px;justify-content:flex-end;white-space:nowrap">${r.oor?`<span style="font-size:10.5px;font-weight:600;color:#E30019">OUT OF RANGE</span>`:''}${cited?`<span style="font-size:10.5px;font-weight:600;color:#B85D00">CITED</span>`:''}</div>
    <span class="chev" style="color:var(--ink-3);font-size:13px;margin-left:2px">\u203a</span></div>`;
}
/* =====================================================================
   UMS VERDICT (POC, 24-Sep-2026) — ums-criteria.js rows (the future ums_criteria table) evaluated in the browser
   by ums.js against this check's readings of the critical tags only (api/…/checklist/:cf?tags=), with the
   thresholds the route already joins and the noon status it returns. Nothing is stored.
   ===================================================================== */
const UMS_CRITICAL = new Set((typeof UMS_CRITERIA!=='undefined' ? UMS_CRITERIA : []).flatMap(c=>c.tag_ids||[]));
const UMSCL = {};            /* critical-tag readings per check_file_id */
let UMS_LAST = null;         /* {cf, v} — the last verdict rendered, read by the Analysis tab's score cards */
function renderHeroVerdict(v, A){
  const hv = document.getElementById('heroVerdict'), he = document.getElementById('heroExplain'); if(!hv) return;
  if(!v){ hv.innerHTML=''; he.innerHTML=''; return; }
  hv.innerHTML = `${UI.verdictPill(v.verdict, {risk:v.risk})}<span>UMS for the next 8 h · ${esc(v.why||'')}</span>`;
  const h = document.getElementById('healthNum').textContent;
  const sc = A ? A.analyses.filter(x=>x.score!=null).sort((a,b)=>a.score-b.score) : [];
  he.innerHTML = UI.explain({title:`What ${h==='\u2014'?'this':h} means`, text: A && sc.length ? `<b>Health ${h}</b> is the mean of the ${sc.length} scores the analyst gave this check's systems (living_office.note, type report, attrs.score) — condition, not permission. <b>${esc(v.verdict)}</b> is the UMS answer for the same walkaround, computed from the ${v.criteria_total} applicable criteria over the critical readings.` : `This date is not analysed — no health score. <b>${esc(v.verdict)}</b> is still computed from the walkaround's critical readings.`,
    rows: A && sc.length ? [{k:'Lowest systems', v: sc.slice(0,3).map(x=>`<a class="a-link" onclick="setVTab('analysis');openAnalysis('${A.cf||cfOf(curDate)}','${x.perspective}')">${esc(perspName(x.perspective))}</a> ${x.score}`).join(' \u00b7 ')},{k:'Highest', v: sc.slice(-2).map(x=>`${esc(perspName(x.perspective))} ${x.score}`).join(' \u00b7 ')},{k:'Verdict', v:`${esc(v.verdict)} \u00b7 risk ${v.risk} \u2014 <a class="a-link" onclick="document.getElementById('umsCard').scrollIntoView({behavior:'smooth'})">the UMS card</a> shows every criterion and its reading`}] : [{k:'Verdict', v:`${esc(v.verdict)} \u00b7 risk ${v.risk}`}]});
}
function umsCriteria(){ return (typeof UMS_CRITERIA!=='undefined' && V) ? UMS_CRITERIA.filter(c=>c.imo===V.vessel.imo) : []; }
/* tier "info": the cluster's other readings on this check — counted from the full checklist once it is loaded (3 s); null → "counting…" */
function umsClusterInfo(key){
  const c = curCl(); if(!c) return null; const cl = UMS.cluster(key); if(!cl) return null; let n=0, oor=0, notread=0;
  c.rows.forEach(r=>{ if(UMS_CRITICAL.has(r.t) || !cl.systems.includes(r.s)) return; n++; if(r.oor) oor++; if(!UMS.isRead(r.v)) notread++; });
  return {n, oor, notread};
}
function umsOpenSystems(key){ const cl = UMS.cluster(key); const sys = (cl ? cl.systems : []).filter(x=>SYS_TREE && SYS_TREE[x]).sort((a,b)=>Object.values(SYS_TREE[b]).flat().length-Object.values(SYS_TREE[a]).flat().length)[0]; setVTab('systems'); if(sys){ selectSystem(sys); } window.scrollTo(0,0); }
function umsRowFor(tagId, m, ser){
  const c = UMSCL[cfOf(curDate)]; const meta = tagMeta(tagId);
  const r = (c && c.byTag[tagId]) || {t:tagId, n:meta.name, v:'-', num:null, u:meta.unit, mn:null, mx:null, s:meta.system, e:meta.equipment, oor:false, judged:false, ts:'', prev:null, th:null};
  return readingRowFor(r, ser, null);
}
function renderRules(){
  const el = document.getElementById('rulesBody'); if(!el || !V) return;
  const rules = (typeof UMS_CRITERIA!=='undefined' ? UMS_CRITERIA : []).filter(c=>c.imo===V.vessel.imo);
  const n = document.getElementById('rulesTabN'); if(n) n.textContent = rules.length || '';
  if(!rules.length){ el.innerHTML = `<p class="plain-note">No UMS rules for ${esc(V.vessel.name)} yet \u2014 an admin adds them here once this vessel's thresholds exist (only Atlas Leader has them today).</p>`; return; }
  el.innerHTML = UI.rulesPage({rules, vessel:V.vessel.name, imo:V.vessel.imo, version:(V.version&&V.version.version_id)||'\u2014',
    candidates:{'main-engine-propulsion':76,'power-generation-electrical':40,'safety-environmental':40,'boiler-steam':17},
    onTag:t=>`openTagDetail('${t}')`,
    note:'<b>Read-only in this build.</b> Editing writes one row per rule per condition to <code>m0_check_reports.ums_criteria</code>, which is designed but not created \u2014 a write to nyk_mti needs explicit confirmation. Until then the rules live in <code>ums-criteria.js</code> and this screen shows exactly what runs.'});
}
async function renderUms(){
  const el = document.getElementById('umsCard'); if(!el || !V || !curDate) return;
  const slug = curVesselSlug, iso = curDate, crit = umsCriteria();
  if(!crit.length){ el.innerHTML = UI.verdictCard({v:null, source:SRC.umsVerdict, dateLabel:fmtDate(iso), note:`No UMS criteria for ${V.vessel.name} yet — the POC rules are seeded for Atlas Leader only (the one vessel with tag_thresholds). NO RULES until an admin adds this vessel's rules.`}); document.getElementById('heroVerdict').innerHTML = `${UI.verdictPill('NO RULES')}<span>no UMS criteria for this vessel yet</span>`; document.getElementById('heroExplain').innerHTML = UI.explain({title:`What ${document.getElementById('healthNum').textContent} means`, text:'<b>Health</b> is the mean of the scores the analyst gave this check\'s systems (living_office.note, type report) — condition, not permission. The UMS verdict needs criteria and thresholds; this vessel has neither yet.'}); return; }
  const cf = cfOf(iso);
  if(!cf){ const v = UMS.evaluate({criteria:crit, filed:false, reading:()=>null, threshold:()=>null, asOf:iso}); el.innerHTML = UI.verdictCard({v, source:SRC.umsVerdict, dateLabel:`${fmtDate(iso)} — no check filed`, showConfirm:false}); UMS_LAST = {cf:null, v}; renderHeroVerdict(v, null); return; }
  const ids = [...new Set(crit.flatMap(c=>c.tag_ids))];
  if(!UMSCL[cf]){
    /* while playing, keep the last verdict on screen (dimmed) instead of blanking the card for every step */
    if(el.querySelector('.a-verdict[data-verdict]')) el.classList.add('updating'); else el.innerHTML = UI.verdictCard({v:null, source:SRC.umsVerdict, dateLabel:fmtDate(iso)});
    try { const d = await api(`api/vessel/${slug}/checklist/${cf}?tags=${ids.join(',')}`); d.byTag = {}; d.rows.forEach(r=>{ if(!d.byTag[r.t]) d.byTag[r.t] = r; }); UMSCL[cf] = d; }
    catch(e){ el.innerHTML = UI.verdictCard({v:null, source:SRC.umsVerdict, dateLabel:fmtDate(iso), note:`Could not load the critical readings: ${e.message}`}); return; }
    if(curVesselSlug!==slug || curDate!==iso) return;
  }
  el.classList.remove('updating');
  const c = UMSCL[cf]; const cond = (c.check && c.check.noon_status) || (noonFor(iso)||{}).st || 'any';
  const v = UMS.evaluate({criteria:crit, condition:cond, reading:t=>c.byTag[t]||null, threshold:t=>(c.byTag[t]||{}).th||null, meta:tagMeta, filed:c.rows.length>0,
    start:c.check?c.check.start:null, end:c.check?c.check.end:null, asOf:iso, clusterInfo:umsClusterInfo, noon:{foc: (c.check && c.check.noon_foc!=null) ? c.check.noon_foc : ((noonFor(iso)||{}).foc ?? null)}});
  if(!curCl()){ ensureChecklist(iso).then(()=>{ if(curDate===iso && curVesselSlug===slug) renderUms(); }).catch(()=>{}); }
  const times = c.check && c.check.start ? `${c.check.start.slice(11,16)}–${c.check.end?c.check.end.slice(11,16):''} UTC` : '';
  const ser = rowSeries(ids, ()=>{ if(curDate===iso) renderUms(); });
  const A = AN().has(iso) ? (CK[cf] || await loadCheck(cf)) : null; if(curVesselSlug!==slug || curDate!==iso) return;
  UMS_LAST = {cf, v};
  el.innerHTML = UI.verdictCard({v, source:SRC.umsVerdict, dateLabel:`as at the ${fmtDate(iso)} walkaround`, timeLabel:times, rowFor:(t,m)=>umsRowFor(t, m, ser),
    analysisFor: k => { const x = A && A.analyses.find(a=>a.perspective===k); return x ? {score:x.score, status:x.status, onclick:`openAnalysis('${cf}','${k}')`} : null; },
    onOther: k => `umsOpenSystems('${k}')`, reviewFor: () => null,
    noteStatus: (A && (A.analyses.find(a=>a.perspective==='ums-readiness')||{}).status) || ''});
  renderHeroVerdict(v, A);
}
async function refreshChecklistForDate(){
  const lbl=document.getElementById('clDateLbl'); if(!curDate){ lbl.textContent='No check selected'; return; }
  if(!cfOf(curDate)){ lbl.textContent = `${fmtDate(curDate)} \u00b7 no check filed that day`; document.getElementById('oorLimitCard').innerHTML=''; document.getElementById('oorList').innerHTML=''; document.getElementById('clResults').innerHTML=''; document.getElementById('clPager').innerHTML=''; return; }
  lbl.textContent = `${fmtDate(curDate)} \u00b7 loading readings\u2026`;
  let c; try { c = await ensureChecklist(); } catch(e){ lbl.textContent = `${fmtDate(curDate)} \u00b7 could not load: ${e.message}`; return; }
  if(cfOf(curDate)!==c.check?.cf && CL[cfOf(curDate)]!==c) return;
  const times = c.check && c.check.start ? ` \u00b7 ${c.check.start.slice(11,16)}\u2013${c.check.end?c.check.end.slice(11,16):''} UTC` : '';
  lbl.textContent = `${fmtDate(curDate)}${times} \u00b7 ${c.rows.length.toLocaleString()} readings \u00b7 check ${c.check?c.check.cf:''}${c.check&&c.check.prev_d?` \u00b7 previous walkaround ${fmtDate(c.check.prev_d)}`:''}`;
  renderOOR();
}
function renderOOR(){
  const c = curCl(); if(!c) return; const oor = c.rows.filter(r=>r.oor);
  document.getElementById('oorCountLbl').textContent = `${oor.length} of ${c.rows.length.toLocaleString()}`;
  document.getElementById('oorLimitCard').innerHTML = UI.limitCard({ icon:{glyph:'!', color:'#E30019'}, title:'Out of range', meta:'this walkaround', source:SRC.oor,
    compare:[{label:'Out of range', color:'var(--alarm)', parts:[{value:oor.length, unit:'readings'}]},{label:'Total readings', color:'var(--hairline)', parts:[{value:c.rows.length.toLocaleString(), unit:'readings'}]}], value:oor.length, total:c.rows.length, color:'var(--alarm)' });
  const ser = rowSeries(oor.map(r=>r.t), renderOOR);
  document.getElementById('oorList').innerHTML = oor.length ? oor.map(r=>readingRowFor(r, ser, c.rows.indexOf(r)+1)).join('') : `<p class="plain-note">No reading outside its band on this check.</p>`;
  renderChecklistPage();
}
let clPage = 0; const CL_PAGE = 50;
/* checklist filters: type (numeric / state), out of range, cited, read only (skip "-"), one system */
let clFilter = {type:'all', oor:false, cited:false, read:false, system:''};
function setClType(v){ clFilter.type = v; document.querySelectorAll('#clTypeSeg button').forEach(b=>b.classList.toggle('on', b.dataset.v===v)); searchChecklist(); }
function toggleClOpt(k){ clFilter[k] = !clFilter[k]; document.getElementById({oor:'clOorChip', cited:'clCitedChip', read:'clReadChip', ums:'clUmsChip'}[k]).classList.toggle('active', clFilter[k]); searchChecklist(); }
function setClSystem(v){ clFilter.system = v; searchChecklist(); }
function clFilterSystems(rows){ const sel = document.getElementById('clSystem'); if(!sel) return; const cur = sel.value; const systems = [...new Set(rows.map(r=>r.s).filter(Boolean))].sort(); sel.innerHTML = '<option value="">All systems</option>' + systems.map(x=>`<option value="${esc(x)}"${x===cur?' selected':''}>${esc(x)}</option>`).join(''); }
function clPass(r){
  const isNum = (r.num!=null) || (r.raw!=null) || (r.v!=null && r.v!=='' && r.v!=='-' && !isNaN(parseFloat(r.v)) && /^[-+]?\d/.test(String(r.v)));
  if(clFilter.type==='numeric' && !isNum) return false;
  if(clFilter.type==='state' && isNum) return false;
  if(clFilter.oor && !r.oor) return false;
  if(clFilter.cited && !isCited(r.t)) return false;
  if(clFilter.read && (r.v==null || r.v==='' || r.v==='-')) return false;
  if(clFilter.ums && !UMS_CRITICAL.has(r.t)) return false;
  if(clFilter.system && r.s!==clFilter.system) return false;
  return true;
}
function clMatches(){ const c = curCl(); if(!c) return []; clFilterSystems(c.rows); const q = (document.getElementById('clSearch').value||'').toLowerCase().trim(); return c.rows.filter(r=> clPass(r) && (!q || r.n.toLowerCase().includes(q) || r.t.includes(q) || (r.s||'').toLowerCase().includes(q))); }
function renderChecklistPage(){
  const c = curCl(); if(!c) return; const m = clMatches(); const pages = Math.max(1, Math.ceil(m.length/CL_PAGE)); clPage = Math.min(clPage, pages-1);
  const slice = m.slice(clPage*CL_PAGE, clPage*CL_PAGE+CL_PAGE);
  const ser = rowSeries(slice.map(r=>r.t), renderChecklistPage);
  document.getElementById('clResults').innerHTML = slice.length ? slice.map((r,i)=>readingRowFor(r, ser, clPage*CL_PAGE+i+1)).join('') : `<p class="plain-note">No matches in this check's ${c.rows.length.toLocaleString()} readings.</p>`;
  document.getElementById('clPager').innerHTML = `<span>Showing ${m.length? clPage*CL_PAGE+1:0}\u2013${Math.min(m.length, (clPage+1)*CL_PAGE)} of ${m.length.toLocaleString()}${m.length!==c.rows.length?` (filtered from ${c.rows.length.toLocaleString()})`:''}</span>
    <span style="margin-left:auto;display:flex;gap:6px;align-items:center"><button class="chip small" ${clPage===0?'disabled style="opacity:.4"':''} onclick="clGo(-1)">\u2039 Prev</button><span style="font-size:12.5px;color:var(--ink-2)">${clPage+1} / ${pages}</span><button class="chip small" ${clPage>=pages-1?'disabled style="opacity:.4"':''} onclick="clGo(1)">Next \u203a</button></span>`;
}
function clGo(d){ clPage += d; renderChecklistPage(); document.getElementById('clResults').scrollIntoView({block:'start'}); }
function searchChecklist(){ clPage = 0; renderChecklistPage(); }

/* =====================================================================
   NOON REPORT — "Now" strip, voyage cards, the globe
   ===================================================================== */
const WX = {B:'Blue sky', BC:'Partly cloudy', C:'Cloudy', O:'Overcast', R:'Rain', D:'Drizzle', F:'Fog', OTHER:'Other'};
function fmtPos(lat, lon){ if(lat==null||lon==null) return '\u2014'; const f=(v,p,n)=>{ const a=Math.abs(v); const d=Math.floor(a); const m=Math.round((a-d)*60); return `${d}\u00b0${String(m).padStart(2,'0')}\u2032${v>=0?p:n}`; }; return `${f(lat,'N','S')} ${f(lon,'E','W')}`; }
function noonFor(period){ let best=null; for(const r of NOON){ if(r.d<=period) best=r; else break; } return best; }
let NOON_BY_DATE = {}; function buildNoonIndex(){ NOON_BY_DATE = {}; NOON.forEach(q=>{ if(!NOON_BY_DATE[q.d] || q.t==='50_SEA') NOON_BY_DATE[q.d]=q; }); }
let trackPeriod = 'all', trackMode = 'globe';
function trackFor(period, upto){ const end = upto || curDate; const d = new Date(end+'T00:00:00Z'); let from = '0000'; if(period==='90d') d.setUTCDate(d.getUTCDate()-90); else if(period==='12m') d.setUTCFullYear(d.getUTCFullYear()-1); else if(period==='3y') d.setUTCFullYear(d.getUTCFullYear()-3); if(period!=='all') from = d.toISOString().slice(0,10); return TRACK.filter(t=>t[0]>=from && t[0]<=end); }
function weatherFor(iso){ return (typeof WEATHER!=='undefined' ? WEATHER : []).filter(w=>w[0]===iso).map(w=>[w[1], w[2], w[3], w[4], w[5]]); }
function noonTip(t){
  const q = NOON_BY_DATE[t[0]]; const row = (k,v) => v==null || v==='' ? '' : `<div class="r"><span>${k}</span><b>${esc(v)}</b></div>`; const wx = weatherFor(t[0])[0];
  return `<div class="h">${fmtDate(t[0])}${t[3]?' \u00b7 '+esc(t[3]):''}</div>` + row('Position', fmtPos(t[1], t[2])) + row('Speed', t[4]!=null ? UI.fmtNum(t[4])+' kn' : null) +
    (q ? row('Voyage', q.voy ? q.voy + (q.lane?' \u00b7 '+q.lane:'') : q.lane) + row('Port', q.port) + row('ME load', q.load!=null ? UI.fmtNum(q.load)+' %'+(q.kw!=null?' \u00b7 '+UI.fmtNum(q.kw)+' kW':'') : null) + row('Fuel', q.foc!=null ? UI.fmtNum(q.foc)+' t/day' : null) + row('Wind', q.bf!=null ? 'BF '+UI.fmtNum(q.bf)+(q.wx?' \u00b7 '+(WX[q.wx]||q.wx):'') : null) + row('Swell', q.swell!=null ? UI.fmtNum(q.swell)+' m' : null)
       : `<div style="color:var(--ink-3);margin-top:4px">noon report fields loaded from 2024 only \u2014 position, status and speed for this date</div>`) +
    (wx ? row('Weather (model)', `${wx[3]} kn from ${wx[2]}\u00b0${wx[4]!=null?' \u00b7 wave '+wx[4]+' m':''}`) : '');
}
function mountTrack(r){
  const el = document.getElementById('noonGlobe'); if(!el) return;
  if(!TRACK.length){ el.innerHTML = `<p class="loading">Loading the track\u2026</p>`; return; }
  const tr = trackFor(trackPeriod); const sel = r ? (TRACK.find(t=>t[0]===r.d) || null) : null; const last = sel || tr[tr.length-1];
  const st = UI._globes['track']; const center = st && st._centered && st._slug===curVesselSlug ? st.center : (last ? [last[2], Math.max(-60, Math.min(60, last[1]))] : [20,0]);
  const dims = trackMode==='globe' ? {w:640, h:560} : {w:1040, h:520};
  UI.mountGlobe(el, Object.assign({id:'track', coast:COAST, track:tr, mode:trackMode, center, selected:sel, _centered:true, _slug:curVesselSlug, tip:noonTip, weather:weatherFor(curDate)}, dims));
  const n = document.getElementById('trackN'); if(n) n.textContent = `${tr.length.toLocaleString()} positions${tr.length?` \u00b7 ${fmtDate(tr[0][0])} \u2192 ${fmtDate(tr[tr.length-1][0])}`:''}`;
}
function setTrackPeriod(k){ trackPeriod = k; renderNoonNow(curDate); }
function setTrackMode(k){ trackMode = k; const st = UI._globes['track']; if(st){ st._centered = false; } renderNoonNow(curDate); }
function renderNoonNow(period){
  const el = document.getElementById('noonNow'); if(!el || !period) return;
  const r = noonFor(period);
  if(!r){ el.innerHTML = NOON.length ? `<p class="plain-note">No noon report on or before ${fmtDate(period)} in the loaded window (since 2024).</p>` : `<p class="loading">Loading noon reports\u2026</p>`; return; }
  const tile = (k,v,unit,sub) => `<div class="t"><span class="k">${k}</span><span class="v">${v==null?'\u2014':esc(v)}${unit&&v!=null?`<em>${esc(unit)}</em>`:''}</span>${sub?`<span class="s">${esc(sub)}</span>`:''}</div>`;
  el.innerHTML = UI.card({body:
    UI.head({icon:{glyph:'\u2693', color:'#0071E3'}, title:'Position & voyage', meta:`noon report \u00b7 ${fmtDate(r.d)}${r.d===period?' (selected date)':' \u00b7 nearest before the selected '+fmtDate(period)}`, source:SRC.noon}) +
    (commentFor('noon.'+r.d) ? `<p class="a-sentence">${esc(commentFor('noon.'+r.d))}</p>` : '') +
    `<div class="a-now">${tile('Status', r.st || '\u2014', '', r.port ? r.port : (r.lane||''))}${tile('Position', fmtPos(r.lat, r.lon), '', r.voy ? 'Voyage '+r.voy : '')}${tile('Speed', r.sog!=null?UI.fmtNum(r.sog):null, 'kn', 'over ground, 24h avg')}${tile('ME load', r.load!=null?UI.fmtNum(r.load):null, '%', r.kw!=null?UI.fmtNum(r.kw)+' kW':'')}${tile('Fuel', r.foc!=null?UI.fmtNum(r.foc):null, 't/day', 'total consumption')}${tile('Wind', r.bf!=null?'BF '+UI.fmtNum(r.bf):null, '', r.wx?WX[r.wx]||r.wx:'')}${tile('Swell', r.swell!=null?UI.fmtNum(r.swell):null, 'm', '')}</div>
    <div class="a-grid3" style="margin-top:14px"><div id="nc-sog"></div><div id="nc-foc"></div><div id="nc-bf"></div></div>
    <div class="a-globe-ctl" style="margin-top:16px">${UI.icon({glyph:'\u25cf', color:'#0071E3'})}<b style="font-size:14px">Track</b>${UI.info(SRC.track)}
      ${UI.period({options:[{key:'90d',label:'90d'},{key:'12m',label:'1Y'},{key:'3y',label:'3Y'},{key:'all',label:'All'}], active:trackPeriod, onclick:'setTrackPeriod'})}
      ${UI.period({options:[{key:'globe',label:'Globe'},{key:'flat',label:'Flat map'}], active:trackMode, onclick:'setTrackMode'})}
      <span class="n" id="trackN" style="font-size:12.5px;color:var(--ink-3)"></span></div>
    <div id="noonGlobe" style="max-width:${trackMode==='globe'?'640px':'1040px'};margin:0 auto"></div>
    <p class="scrubhint" style="text-align:left;padding:0;margin-top:6px">Drag to rotate (globe) or pan (flat). One colour per year; hover a point for that day's noon report. Blue ring = the noon report shown above; press play in the date bar and it moves. Weather arrows appear once weather.js is filled (provision).</p>
    <div class="a-foot">noon_report.readable \u00b7 ${NOON.length.toLocaleString()} reports since 2024 \u00b7 ${TRACK.length.toLocaleString()} positions${TRACK.length?' since '+fmtDate(TRACK[0][0]):''} on the map.</div>`});
  mountTrack(r);
  const pts = key => NOON.filter(q=>q[key]!=null && q.t==='50_SEA').map(q=>({x:q.d, v:q[key]}));
  UI.mountChartCard(document.getElementById('nc-sog'), {id:'nc-sog', compact:true, source:SRC.noonSeries, icon:{glyph:'\u223f',color:'#0071E3'}, title:'Speed over ground', meta:'at sea only', points:pts('sog'), unit:'kn', defaultRange:'90d', color:'#0071E3'});
  UI.mountChartCard(document.getElementById('nc-foc'), {id:'nc-foc', compact:true, source:SRC.noonSeries, icon:{glyph:'\u223f',color:'#0071E3'}, title:'Fuel consumption', meta:'at sea only', points:pts('foc'), unit:'t/day', defaultRange:'90d', color:'#0071E3'});
  UI.mountChartCard(document.getElementById('nc-bf'), {id:'nc-bf', compact:true, source:SRC.noonSeries, icon:{glyph:'\u223f',color:'#0071E3'}, title:'Wind', meta:'Beaufort, at sea', points:pts('bf'), unit:'BF', defaultRange:'90d', color:'#0071E3'});
}

/* =====================================================================
   ANALYSIS TAB — story + score cards → the written analysis in the side panel
   ===================================================================== */
const STATUS_COLOR = {GOOD:'#1DA100', SATISFACTORY:'#B85D00', POOR:'#E30019'};
function mdToHtml(md){
  const lines = (md||'').replace(/\r/g,'').replace(/^---\n[\s\S]*?\n---\n/, '').split('\n'); let out=[], list=false, table=[], para=[];
  const inline = t => esc(t).replace(/\*\*([\s\S]+?)\*\*/g,'<b>$1</b>').replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').replace(/(^|[\s(])\*(?!\s)([^*\n]+?)\*(?=[\s).,;:]|$)/g,'$1<i>$2</i>');
  const flushList = () => { if(list){ out.push('</ul>'); list=false; } };
  const flushPara = () => { if(para.length){ out.push(`<p>${inline(para.join(' '))}</p>`); para=[]; } };
  const flushTable = () => { if(table.length){ const rows=table.filter(r=>!/^\|?\s*:?-{2,}/.test(r)); const cells=r=>r.replace(/^\||\|$/g,'').split('|').map(c=>inline(c.trim())); out.push('<table><thead><tr>'+cells(rows[0]||'').map(c=>`<th>${c}</th>`).join('')+'</tr></thead><tbody>'+rows.slice(1).map(r=>'<tr>'+cells(r).map(c=>`<td>${c}</td>`).join('')+'</tr>').join('')+'</tbody></table>'); table=[]; } };
  for(const raw of lines){ const l=raw.trimEnd();
    if(/^\|/.test(l)){ flushPara(); flushList(); table.push(l); continue; } else flushTable();
    if(/^#{1,3}\s/.test(l)){ flushPara(); flushList(); const lv=l.match(/^(#+)/)[1].length; out.push(`<h${lv}>${inline(l.replace(/^#+\s*/,''))}</h${lv}>`); continue; }
    if(/^---+$/.test(l)){ flushPara(); flushList(); out.push('<hr>'); continue; }
    if(/^>\s?/.test(l)){ flushPara(); flushList(); out.push(`<blockquote>${inline(l.replace(/^>\s?/,''))}</blockquote>`); continue; }
    if(/^\s*[-*]\s+/.test(l)){ flushPara(); if(!list){ out.push('<ul>'); list=true; } out.push(`<li>${inline(l.replace(/^\s*[-*]\s+/,''))}</li>`); continue; }
    if(/^\s*\d+\.\s+/.test(l)){ flushPara(); if(!list){ out.push('<ul>'); list=true; } out.push(`<li>${inline(l.replace(/^\s*\d+\.\s+/,''))}</li>`); continue; }
    if(!l.trim()){ flushPara(); flushList(); continue; }
    if(list && /^\s{2,}\S/.test(raw)){ out[out.length-1] = out[out.length-1].replace(/<\/li>$/, ' '+inline(l.trim())+'</li>'); continue; }   /* wrapped list item */
    flushList(); para.push(l.trim());
  }
  flushPara(); flushList(); flushTable(); return out.join('');
}
async function renderAnalysisTab(){
  const el = document.getElementById('anBody'); if(!el || !V) return; const p = checks()[curIdx];
  if(!p){ el.innerHTML = `<p class="plain-note">No analysed check yet for this vessel.</p>`; return; }
  el.innerHTML = `<p class="loading">Loading the ${fmtDate(p.period)} analysis\u2026</p>`;
  const A = await loadCheck(p.cf); if(!A || checks()[curIdx]!==p) { if(!A) el.innerHTML = `<div class="err">Could not load the analysis.</div>`; return; }
  const note = curDate!==p.period ? `<p class="foot-note" style="padding:0 4px;margin:4px 0 10px">The ${fmtDate(curDate)} check is not analysed \u2014 showing the nearest analysed check, ${fmtDate(p.period)}.</p>` : '';
  const UV = (UMS_LAST && UMS_LAST.cf===p.cf) ? UMS_LAST.v : null;
  const clusterAn = [...A.analyses].filter(x=>UMS.cluster(x.perspective)).sort((a,b)=>(a.score??101)-(b.score??101));
  const cards = clusterAn.map(x=>{ const cl = UMS.cluster(x.perspective); const u = UV ? UV.clusters.find(q=>q.key===x.perspective) : null;
    const lead = mdToHtml(UI.analysisLead(x.body||''));
    return UI.analysisCard({key:x.perspective, label:cl.label, question:cl.question, must:cl.must, score:x.score, status:x.status, confidence:x.confidence||'', lead, evidence:(x.evidence||[]).slice(0,8), postits:A.findings.filter(q=>q.perspective===x.perspective).map(q=>({severity:q.importance||q.severity, body:q.body||''})), ums:u && u.total ? u : null, onOpen:`openAnalysis('${p.cf}','${x.perspective}')`, onTag:t=>`openTagDetail('${t}')`, onOther:k=>`umsOpenSystems('${k}')`, source:SRC.analysis}); }).join('');
  const scores = [...A.analyses].filter(x=>!UMS.cluster(x.perspective)).sort((a,b)=>(a.score??101)-(b.score??101)).map(x=>{ const c = STATUS_COLOR[x.status] || '#8E8E93'; const ucl = UV ? UV.clusters.find(q=>q.key===x.perspective) : null;
    return `<div class="a-card a-score clickable" onclick="openAnalysis('${p.cf}','${x.perspective}')"><div class="sys">${esc(perspName(x.perspective))}</div>
      <div class="row"><span class="sc" style="color:${c}">${x.score!=null?x.score:'\u2014'}</span><span class="st" style="color:${c}">${esc(x.status||'')}</span></div>${ucl && ucl.total ? `<div style="margin-top:2px">${UI.verdictPill(ucl.status,{small:true})} <span style="font-size:11px;color:var(--ink-3)">${ucl.met} of ${ucl.total} UMS criteria met</span></div>` : ''}
      <div class="m">${x.findings.length} finding${x.findings.length===1?'':'s'}${x.evidence.length?` \u00b7 ${x.evidence.length} readings cited`:''}${x.confidence?` \u00b7 ${esc(x.confidence)} confidence`:''}</div><div class="open">Read the analysis \u203a</div></div>`; }).join('');
  const story = A.story; const storyLead = story ? mdToHtml((story.narrative||'').replace(/^---\n[\s\S]*?\n---\n/, '').slice(0, 1400)) : '';
  el.innerHTML = note +
    (story ? UI.card({body: UI.head({icon:{glyph:'\u2261',color:'#0071E3'}, title:'Story', meta:story.ref, source:SRC.story}) + `<div class="md story-lead" style="max-width:820px">${storyLead}</div><div style="margin-top:10px"><span class="a-link" onclick="openStory('${p.cf}')">Read the full story</span></div>`}) : `<p class="plain-note">No year narrative in living_office.dossier for ${p.period.slice(0,4)}.</p>`) +
    (A.synthesis ? UI.card({body: UI.head({icon:{glyph:'\u2261',color:'#1D3C67'}, title:'Daily overview', meta:fmtDate(p.period), source:SRC.postits}) + `<div class="md" style="max-width:820px">${mdToHtml(A.synthesis)}</div>`}) : '') +
    `<p class="grouplbl" style="margin:18px 0 10px">Systems \u2014 the analyst's condition and the UMS permission, side by side <span>${clusterAn.length} clusters \u00b7 worst first</span>${UI.info(SRC.analysis)}</p><div class="a-an-stack">${cards}</div>` +
    (scores ? `<p class="grouplbl" style="margin:18px 0 10px">Cross-cutting perspectives <span>${A.analyses.length-clusterAn.length}</span></p><div class="a-scores">${scores}</div>` : '');
}
function openStory(cf){ const A = CK[cf]; if(!A || !A.story) return; document.getElementById('anPanelBody').innerHTML = `<div class="datelbl" style="font-size:12.5px">${esc(A.story.ref)} \u00b7 ${esc(A.story.title||'')}</div><div class="md" style="margin-top:8px">${mdToHtml(A.story.narrative)}</div>${A.story.next_step?`<p class="a-sentence"><b>Next step:</b> ${esc(A.story.next_step)}</p>`:''}`; document.getElementById('anBackdrop').classList.add('open'); document.getElementById('anPanel').classList.add('open'); }
function openAnalysis(cf, persp){
  const A = CK[cf]; if(!A) return; const x = A.analyses.find(a=>a.perspective===persp); if(!x) return; const c = STATUS_COLOR[x.status] || '#8E8E93';
  const posts = A.findings.filter(q=>q.perspective===persp);
  const chip = e => `<span class="chip small" style="display:inline-flex;margin:4px 6px 0 0" onclick="event.stopPropagation();closeAnalysis();openTagDetail('${e.tag_id}')">${esc(e.label||e.tag_id)} \u00b7 ${esc(e.value||'')} \u203a</span>`;
  document.getElementById('anPanelBody').innerHTML =
    `<div class="datelbl" style="font-size:12.5px">${fmtDate(A.period)} \u00b7 check ${esc(cf)} \u203a ${esc(perspName(persp))}</div>
     <div style="display:flex;align-items:baseline;gap:12px;margin:4px 0 6px"><span style="font-size:34px;font-weight:700;color:${c}">${x.score!=null?x.score:'\u2014'}</span><span style="font-size:12px;font-weight:600;letter-spacing:.04em;color:${c}">${esc(x.status||'')}</span>${x.confidence?`<span style="font-size:12px;color:var(--ink-3)">${esc(x.confidence)} confidence</span>`:''}</div>
     <div class="md">${mdToHtml(x.body)}</div>
     ${x.evidence.length?`<p class="grouplbl" style="margin-top:18px">Readings cited <span>${x.evidence.length}${x.evidence_source?' \u00b7 from the '+esc(x.evidence_source):''}</span>${UI.info(SRC.evidence)}</p><div>${x.evidence.map(chip).join('')}</div>`:`<p class="foot-note" style="padding:8px 0 0">No readings cited in this note's evidence[].</p>`}
     ${posts.length?`<p class="grouplbl" style="margin-top:22px">Post-its from this analysis <span>${posts.length}</span>${UI.info(SRC.postits)}</p>`+posts.map(q=>`<div class="findrow" style="padding:12px 4px"><span class="dot" style="background:${q.severity==='high'?'var(--alarm)':q.severity==='medium'?'var(--warning)':'var(--ink-3)'};margin-top:6px"></span><div class="body"><div style="font-size:12px;color:var(--ink-3);margin-bottom:2px">${esc(q.importance||'')}${q.action_required?' \u00b7 action required':''}</div><div class="p md" style="font-size:13.5px;color:var(--ink)">${mdToHtml(q.body)}</div>${q.action_required?`<div class="p" style="font-size:13px;color:var(--warning-ink);margin-top:4px">\u2192 ${esc(q.action_required)}</div>`:''}<div>${(q.evidence||[]).map(chip).join('')}</div></div></div>`).join(''):''}`;
  document.getElementById('anBackdrop').classList.add('open'); document.getElementById('anPanel').classList.add('open');
}
function closeAnalysis(){ document.getElementById('anBackdrop').classList.remove('open'); document.getElementById('anPanel').classList.remove('open'); }

/* ---- go ---- */
loadFleet();
