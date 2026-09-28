/* =====================================================================
   UMS readiness — rules + evaluator (shared verbatim by the reference and the app)
   "Is the ship safe to leave the engine room unmanned for the next ~8 h after this walkaround?"

   Pure functions, no DOM, no fetch. Input = criteria rows shaped exactly like the future
   m0_check_reports.ums_criteria table (SCHEMA-AND-UI-PLAN.md Part F/G) + this check's readings
   + tag_thresholds; output = an object shaped like the future ums_verdict row, plus a per-cluster
   breakdown for the card. The Python twin (ums_verdict.py, Skill 1, chain Phase 2) must give the
   same answer on the same inputs — keep the rules here and there identical, and small.

   Clusters = mti-t1-system-analysis/clusters/*.md (10, each "the decision this answers" + its
   tag_classification.system list). ums_criteria.grp is one of these keys.
   ===================================================================== */
const UMS = {};

UMS.CLUSTERS = [
  {key:'safety-environmental', must:'fire detection powered with no lamp against its normal state, oil mist detector running with no alarm, no bilge high-level alarm, CO₂ ready',        label:'Safety & environmental',      short:'Safety',      question:'Is the vessel ready for a fire or pollution event?',                                        systems:['Fire Fighting / Safety','Bilge / Ballast System','Lifesaving Equipment','Hull Corrosion Protection','Life Saving / Rescue Equipment','Cathodic Protection System']},
  {key:'power-generation-electrical', must:'at least one D/G able to start itself (selector in Auto), the emergency generator on standby in Auto, switch positions in Remote, LO levels on the running machines in band', label:'Power generation & electrical', short:'Power',     question:'Is generator redundancy actually intact? (what makes an unmanned engine room defensible)', systems:['Diesel Generator / Electrical Power']},
  {key:'navigation-steering', must:'both steering gear panels powered and both LO tanks in band — there is no third pump',         label:'Navigation & steering',       short:'Steering',    question:'Is the single-point-of-failure control chain sound?',                                        systems:['Steering Gear','Navigation / Bridge','Navigation & Bridge Equipment']},
  {key:'main-engine-propulsion', must:'the engine under remote control (not Local), auxiliary blowers in Auto, LO and FO pressures in band',      label:'Main engine & propulsion',    short:'Main engine', question:'Is propulsion healthy and under remote control?',                                            systems:['Main Engine','Shaft / Propeller']},
  {key:'boiler-steam', must:'drum level and pressure in band and one circulation pump on standby (no rules named yet)',                label:'Boiler & steam',              short:'Boiler',      question:'Is the steam plant safe and balanced between its two sources?',                              systems:['Boiler / Steam System']},
  {key:'fuel-lube-oil', must:"service and settling tank ROB above the watch's consumption and purifiers running (no rules named yet)",               label:'Fuel & lube oil',             short:'Oil',         question:'Is oil handling, purification and storage sound?',                                           systems:['Fuel Oil System','Lube Oil System','Waste Oil / Incinerator System']},
  {key:'cooling-freshwater', must:'central cooling pressure held and one pump on standby (no rules named yet)',          label:'Cooling & fresh water',       short:'Cooling',     question:'Are the circuits everything else depends on healthy?',                                       systems:['Cooling System','Sea Water Systems','Fresh Water Generator']},
  {key:'compressed-air-system', must:'control air in band and the starting air reservoir above the minimum for a restart',       label:'Compressed air',              short:'Air',         question:'Is compressed air available where it is needed?',                                            systems:['Compressed Air System']},
  {key:'hotel-auxiliary', must:'funnel clean; the rest is comfort, not safety',             label:'Hotel & auxiliary',           short:'Hotel',       question:'Are crew welfare and support systems functioning?',                                          systems:['Provision Refrigeration / HVAC','Fresh Water / Sanitary','Engine Room Environment','Deck / Accommodation Machinery','Workshop','Bow Thruster','Deck / Cargo Machinery','Bow Thruster System','Sewage / Sanitary Treatment System','Cargo Hold Ventilation System']},
  {key:'exhaust-gas-cleaning', must:'not fitted on this vessel',        label:'Exhaust gas cleaning',        short:'Scrubber',    question:'Is the scrubber cleaning exhaust without a washwater problem?',                             systems:['Exhaust Gas Cleaning System (Scrubber)']},
];
UMS.cluster = key => UMS.CLUSTERS.find(c=>c.key===key) || null;
UMS.clusterOfSystem = sys => (UMS.CLUSTERS.find(c=>c.systems.includes(sys)) || {}).key || null;

UMS.VERDICTS = {
  'GO':                 {color:'#1DA100', tone:'ok',    line:'Safe to leave the engine room unmanned for the next 8 hours.'},
  'GO WITH CONDITIONS': {color:'#FE9413', tone:'watch', line:'Can go unmanned for the next 8 hours once the conditions below are confirmed.'},
  'NO-GO':              {color:'#E30019', tone:'alarm', line:'Do not leave the engine room unmanned until the hard stops below are cleared.'},
  'CANNOT JUDGE':       {color:'#8E8E93', tone:'none',  line:'Too many UMS-critical readings are missing to judge this walkaround.'},
  'NOT FILED':          {color:'#8E8E93', tone:'none',  line:'No M0 checklist was filed for this day — no verdict.'},
  'NO RULES':           {color:'#AEAEB2', tone:'none',  line:'No UMS criteria named for this vessel yet — nothing to judge against.'},
};
UMS.SEVERITY = {fail:1.0, review:0.5, unjudged:0.5, notread:0.3, pass:0};
UMS.RULES = {go_below:20, nogo_above:50, horizon_h:8};

/* the same normalisation as threshold_lookup.normalize_state: trim, case-fold, drop punctuation/spaces */
UMS.norm = x => String(x==null?'':x).trim().toLowerCase().replace(/[.\s\-_/]+/g,'');
/* a mixed tag reads a number when running and a marker (STBY, -) when idle — the marker is a legitimate reading */
UMS.STANDBY = /^(stby|s\/b|standby|idle|stop|stopped|-|−)$/i;
UMS.isStandby = function(r, th){
  if(!r || r.v==null || r.v==='') return false; const v = String(r.v).trim();
  if(th && th.standby && th.standby.split('/').some(x=>x.trim() && x.trim().toLowerCase()===v.toLowerCase())) return true;
  return UMS.STANDBY.test(v);
};
UMS.isRead = v => !(v==null || v==='' || String(v).trim()==='-' || String(v).trim()==='−');
UMS.num = r => (r && r.num!=null && Number.isFinite(+r.num)) ? +r.num : (r && r.raw!=null ? +r.raw : (r && UMS.isRead(r.v) && /^[-+]?\d/.test(String(r.v)) && !isNaN(parseFloat(r.v)) ? parseFloat(r.v) : null));

/** one tag against one `required` shape → {tag, name, value, expected, status, sev} */
UMS.evalTag = function(tagId, required, ctx){
  const r = ctx.reading(tagId) || null, th = ctx.threshold(tagId) || null, meta = ctx.meta ? (ctx.meta(tagId)||{}) : {};
  const name = (r && r.n) || meta.name || tagId;
  const out = {tag:tagId, name, value: r ? (r.v==null?'':String(r.v)) : '', num: UMS.num(r), unit: (r && r.u) || meta.unit || '', expected:'', status:'pass', why:'', standby: UMS.isStandby(r, th)};
  if(!r || !UMS.isRead(r.v)){
    /* a MIXED tag (a real number when running, a marker when idle) records its idle marker as the reading; "-" there
       is a legitimate standby state, not a missing reading — threshold_lookup makes the same distinction */
    if(r && th && th.standby && UMS.isStandby({v: String(r.v||'-')}, th)){ out.status='pass'; out.standby=true; out.why='on standby — the idle marker is a legitimate reading'; return out; }
    out.status='notread'; out.why='not read on this walkaround'; out.expected = required.state || (th && th.exp) || ''; return out; }
  const fmt = v => (v==null||isNaN(v)) ? '—' : (Math.abs(v)>=100 ? (+v).toFixed(0) : Math.abs(v)>=10 ? (+v).toFixed(1) : (+(+v).toFixed(3)).toString());
  if(required.state){ out.expected = required.state; if(UMS.norm(r.v)!==UMS.norm(required.state)){ out.status = th && th.review ? 'review' : 'fail'; out.why = `reads ${r.v}, required ${required.state}`; } return out; }
  if(required.min!=null || required.max!=null){
    const n = UMS.num(r); out.expected = required.min!=null && required.max!=null ? `${fmt(required.min)}–${fmt(required.max)}` : required.min!=null ? `at least ${fmt(required.min)}` : `at most ${fmt(required.max)}`;
    if(n==null){ if(UMS.isStandby(r, th)){ out.status='pass'; out.why='on standby — the idle marker is a legitimate reading'; return out; } out.status='unjudged'; out.why='not a number'; }
    else if((required.min!=null && n<required.min) || (required.max!=null && n>required.max)){ out.status='fail'; out.why=`reads ${fmt(n)}${out.unit?' '+out.unit:''}, ${out.expected} (engineering limit, not the observed band)`; }
    return out; }
  /* ROB: is there enough in the tank for the UMS horizon at today's burn? rate comes from the noon report. */
  if(required.hours_of_burn!=null){
    const n = UMS.num(r), rate = ctx.noon && ctx.noon.foc!=null ? +ctx.noon.foc : null, dens = required.density || 0.98, margin = required.margin || 1;
    const need = rate!=null ? (rate/24) * required.hours_of_burn * margin / dens : null;
    out.expected = need!=null ? `at least ${fmt(need)} (${required.hours_of_burn} h × ${margin}× at ${fmt(rate)} t/day)` : `${required.hours_of_burn} h of burn — no noon report`;
    if(n==null){ out.status='notread'; out.why='level not read'; return out; }
    if(need==null){ out.status='unjudged'; out.why='no fuel consumption in the noon report for this day'; return out; }
    out.hours = n * dens / (rate/24);
    if(n < need){ out.status='fail'; out.why=`${fmt(n)} holds ${fmt(out.hours)} h at ${fmt(rate)} t/day — less than ${required.hours_of_burn} h × ${margin}`; }
    else out.why = `${fmt(n)} holds ${fmt(out.hours)} h at ${fmt(rate)} t/day`;
    return out; }
  if(required.read){ return out; }
  /* {} — the threshold table decides, the same chain the reading row shows: acceptable → expected → reading band; states via expected_normal_state */
  const n = UMS.num(r);
  if(n!=null && !(th && th.exp)){
    const band = th && th.amin!=null && th.amax!=null ? [th.amin, th.amax, 'acceptable'] : th && th.emin!=null && th.emax!=null ? [th.emin, th.emax, 'expected'] : (r.mn!=null && r.mx!=null) ? [+r.mn, +r.mx, 'reading band'] : null;
    if(band){ out.expected = `${fmt(band[0])}–${fmt(band[1])}`; if(n<band[0] || n>band[1]){ out.status='fail'; out.why=`reads ${fmt(n)}, ${band[2]} ${out.expected}`; } else if(r.oor===true){ out.status='fail'; out.why='out of range as stored'; } return out; }
    if(r.oor===true){ out.status='fail'; out.why='out of range as stored'; return out; }
    out.status='unjudged'; out.why='no band for this tag yet'; return out;
  }
  const exp = th && th.exp;
  if(exp){ out.expected = exp; if(UMS.norm(r.v)!==UMS.norm(exp)){ out.status = th.review ? 'review' : 'fail'; out.why = `reads ${r.v}, expected ${exp}${th.review?' (threshold not yet reviewed)':''}`; } return out; }
  /* a state tag with no expected state: while its threshold row is still to be reviewed nothing can fail it (in_range is NULL in the DB for these) */
  if(!(th && th.review) && r.oor===true){ out.status='fail'; out.why='out of range as stored'; return out; }
  out.status='unjudged'; out.why = th && th.review ? 'threshold not yet reviewed — no expected state' : 'no expected state for this tag yet'; out.why += th && th.states && th.states.length ? ` (seen: ${th.states.map(s=>s.s).join(' | ')})` : ''; return out;
};

/** one criterion row → {…row, status, sev, members[], met, need} */
UMS.evalCriterion = function(c, ctx){
  const req = c.required || {};
  const members = (c.tag_ids||[]).map(t => UMS.evalTag(t, c.kind==='group' ? (req.state ? {state:req.state} : req.min!=null||req.max!=null ? {min:req.min, max:req.max} : req.read_pct!=null ? {read:true} : {}) : req, ctx));
  let status = 'pass', met = members.filter(m=>m.status==='pass').length, need = members.length;
  if(c.kind==='group'){
    if(req.read_pct!=null){ const read = members.filter(m=>m.status!=='notread').length; need = members.length; met = read; status = (read/Math.max(1,members.length))*100 >= req.read_pct ? 'pass' : 'fail'; }
    else if(req.one_running_one_standby){
      members.forEach(m=>{ if(m.num!=null && Math.abs(m.num)<=0.001) m.standby = true; });   /* 0 A / 0 MPa on a pump = idle, the same as STBY */
      const run = members.filter(m=>m.num!=null && Math.abs(m.num)>0.001), sby = members.filter(m=>m.standby);
      need = 2; met = (run.length?1:0) + (sby.length?1:0);
      status = (run.length>=1 && sby.length>=1) ? 'pass' : (run.length===0 ? 'fail' : 'review');
      members.forEach(m=>{ m.role = m.num!=null && Math.abs(m.num)>0.001 ? 'running' : m.standby ? 'standby' : 'unclear'; });
    }
    else { need = req.min_count || members.length; if(met >= need) status = 'pass'; else { const worst = members.filter(m=>m.status!=='pass'); status = worst.every(m=>m.status==='notread') ? 'notread' : worst.some(m=>m.status==='fail') ? 'fail' : worst.some(m=>m.status==='review') ? 'review' : 'unjudged'; } }
  } else { status = members[0] ? members[0].status : 'unjudged'; }
  return Object.assign({}, c, {status, sev: UMS.SEVERITY[status] ?? 0, members, met, need});
};

/**
 * evaluate({criteria, condition, reading(tagId), threshold(tagId), meta(tagId), filed, start, end, asOf})
 *  → {verdict, risk, condition, horizon_until, expired, criteria_total, criteria_read, criteria_failed, hard_stops,
 *     reasons[], conditions[], clusters[], coverage, rule_version}
 */
UMS.evaluate = function({criteria=[], condition='any', reading, threshold, meta, filed=true, start=null, end=null, asOf=null, rule_version='', clusterInfo=null, noon=null}={}){
  const ctx = {reading, threshold, meta, noon};
  const cond = condition || 'any';
  const active = criteria.filter(c => c.active!==false && (c.condition==='any' || !c.condition || c.condition===cond));
  const evald = active.map(c => UMS.evalCriterion(c, ctx));
  const cov = evald.find(c => c.required && c.required.read_pct!=null) || null;
  const scored = evald.filter(c => c!==cov);
  const wsum = scored.reduce((a,c)=>a+(+c.weight||0), 0);
  const rsum = scored.reduce((a,c)=>a+(+c.weight||0)*c.sev, 0);
  const risk = wsum ? Math.round(rsum/wsum*100) : 0;
  const hardFail = scored.filter(c=>c.hard_stop && c.status==='fail');
  const hardOpen = scored.filter(c=>c.hard_stop && (c.status==='review' || c.status==='unjudged' || c.status==='notread'));
  const fails = scored.filter(c=>c.status!=='pass');
  let verdict;
  if(!filed) verdict = 'NOT FILED';
  else if(cov && cov.status!=='pass') verdict = 'CANNOT JUDGE';
  else if(hardFail.length || risk > UMS.RULES.nogo_above) verdict = 'NO-GO';
  else if(fails.length || hardOpen.length || risk >= UMS.RULES.go_below) verdict = 'GO WITH CONDITIONS';
  else verdict = 'GO';
  const horizon = end ? new Date(new Date(end).getTime() + UMS.RULES.horizon_h*3600e3) : null;
  const why = !filed ? 'no checklist filed for this day' : (cov && cov.status!=='pass') ? `only ${cov.met} of ${cov.need} critical tags read (< ${cov.required.read_pct} %)` : hardFail.length ? `${hardFail.length} hard-stop criterion failed — a hard stop alone makes NO-GO` : risk > UMS.RULES.nogo_above ? `risk ${risk} is above ${UMS.RULES.nogo_above}` : (fails.length || hardOpen.length) ? `${fails.length} criteri${fails.length===1?'on':'a'} to confirm (${hardOpen.length} of them hard stops awaiting a threshold review) — risk ${risk} is below ${UMS.RULES.go_below}, but nothing unresolved may remain for a plain GO` : risk >= UMS.RULES.go_below ? `risk ${risk} is ${UMS.RULES.go_below} or more` : `every criterion met and risk ${risk} < ${UMS.RULES.go_below}`;
  const clusters = UMS.CLUSTERS.map(cl => {
    const cs = scored.filter(c=>c.grp===cl.key);
    const met = cs.filter(c=>c.status==='pass').length;
    const st = !cs.length ? 'none' : cs.some(c=>c.hard_stop && c.status==='fail') ? 'NO-GO' : cs.some(c=>c.status!=='pass') ? 'GO WITH CONDITIONS' : 'GO';
    const n = k => cs.filter(c=>c.status===k).length;
    const why = !cs.length ? 'no criteria named yet' : st==='GO' ? `all ${cs.length} criteria met` : st==='NO-GO' ? `${cs.filter(c=>c.hard_stop && c.status==='fail').length} hard-stop criterion failed` : [n('fail')?`${n('fail')} not met`:'', n('review')?`${n('review')} threshold${n('review')>1?'s':''} to review`:'', n('unjudged')?`${n('unjudged')} cannot be judged yet`:'', n('notread')?`${n('notread')} not read`:''].filter(Boolean).join(', ') + ' — no hard stop failed';
    const hard = cs.filter(c=>c.tier==='hard' || c.hard_stop), cond = cs.filter(c=>!(c.tier==='hard' || c.hard_stop));
    const info = clusterInfo ? (clusterInfo(cl.key) || null) : null;   /* {n, oor, notread} — the cluster's other readings, from the checklist */
    return Object.assign({}, cl, {criteria:cs, hard, cond, info, met, total:cs.length, status:st, why, blocked: hard.filter(c=>c.status==='fail').length, open: st!=='GO' && st!=='none'});
  });
  const reasonOf = c => c.members.filter(m=>m.status!=='pass').map(m=>({criterion_id:c.id, criterion:c.criterion, grp:c.grp, tag_id:m.tag, name:m.name, value:m.value, expected:m.expected, weight:c.weight, hard_stop:!!c.hard_stop, status:m.status, severity:UMS.SEVERITY[m.status], why:m.why}));
  const reasons = fails.flatMap(reasonOf);
  const conditions = fails.map(c => {
    const bad = c.members.filter(m=>m.status!=='pass');
    const what = bad.map(m => m.status==='notread' ? `${m.name} was not read` : `${m.name} reads ${m.value||'—'}${m.expected?` (expected ${m.expected})`:''}`).join('; ');
    return {criterion_id:c.id, grp:c.grp, hard_stop:!!c.hard_stop, action:c.action||'', text: c.status==='review' || c.status==='unjudged' ? `Review the threshold, then confirm: ${c.criterion} — ${what}` : c.status==='notread' ? `Read and confirm: ${c.criterion} — ${what}` : `Confirm before going UMS: ${c.criterion} — ${what}`};
  });
  return {verdict, risk, why, condition:cond, color:UMS.VERDICTS[verdict].color, tone:UMS.VERDICTS[verdict].tone, line:UMS.VERDICTS[verdict].line,
    start, end, horizon_until: horizon ? horizon.toISOString() : null, expired: horizon ? horizon.getTime() < Date.now() : null, asOf,
    criteria_total: evald.length, criteria_read: evald.filter(c=>c.status!=='notread').length, criteria_failed: fails.length, hard_stops: hardFail.length, hard_open: hardOpen.length,
    reasons, conditions, clusters, coverage: cov ? {met:cov.met, need:cov.need, pct: Math.round(cov.met/Math.max(1,cov.need)*100), required:cov.required.read_pct, status:cov.status} : null,
    weights:{sum:wsum, risk_points:+rsum.toFixed(2), scored:scored.length}, counts:{pass:scored.filter(c=>c.status==='pass').length, fail:scored.filter(c=>c.status==='fail').length, review:scored.filter(c=>c.status==='review').length, unjudged:scored.filter(c=>c.status==='unjudged').length, notread:scored.filter(c=>c.status==='notread').length}, rule_version: rule_version || `ums-criteria.js v0 (${criteria.length} rows, POC)`};
};
