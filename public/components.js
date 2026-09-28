/* =====================================================================
   MTI eUMS mockup — component library
   Pure template functions: props in, HTML string out. No app state, no
   DOM lookups, no data — the app (index.html) owns all of that and calls
   these. Loaded before the app script; the gallery (components.html)
   loads the same file, so what you see there is exactly what the app
   renders.

   Two layers:
     atoms  — UI.icon, UI.head, UI.card, UI.big, UI.compare, UI.pill,
              UI.rows, UI.limit, UI.nav, UI.notice, UI.period, UI.rangeBars
     cards  — combos of atoms, one per Apple reference screen:
              UI.summaryCard, UI.insightCard, UI.limitCard, UI.rowsCard,
              UI.rangeCard, UI.detailHeader
   Reference screens: ../screenshots/0N-*.png — see COMPONENTS.md.
   Charts are hand-rolled SVG on purpose (no library): same as every
   other chart in the app.
   ===================================================================== */

/* ---- primitives (shared by app + components) ---------------------- */
function esc(s){ return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function tier(v){ if(v===null || v===undefined) return "none"; if(v>=83) return "good"; if(v>=73) return "warn"; return "alarm"; }
function colorForTier(t){ return t==="good"?"#1DA100":t==="warn"?"#B85D00":t==="alarm"?"#E30019":"#AEAEB2"; }
function colorFor(v){ return colorForTier(tier(v)); }
function fmtDate(d){ const dt=new Date(d+"T00:00:00Z"); return dt.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"}); }
/* sparkline: points = [{health:number}] (any object with .health, or pass key) */
function sparkSvg(points, w, h, color, key="health"){
  if(!points || points.length < 2) return `<svg class="spark" width="${w}" height="${h}"><circle cx="${w/2}" cy="${h/2}" r="2.2" fill="${color}"/></svg>`;
  const vals = points.map(p=>p[key]); const min=Math.min(...vals), max=Math.max(...vals); const range=(max-min)||1;
  const pad=3; const step=(w-pad*2)/(points.length-1);
  const coords = vals.map((v,i)=>{const x=pad+i*step; const y=h-pad-((v-min)/range)*(h-pad*2); return `${x.toFixed(1)},${y.toFixed(1)}`;}).join(" ");
  return `<svg class="spark" width="${w}" height="${h}"><polyline points="${coords}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

const UI = {
  /* ================= atoms ================= */

  /** small round icon: {glyph, color} — color is used at 13% for the disc, full for the glyph */
  icon({glyph='●', color='#1D3C67'}={}){
    return `<span class="a-ic" style="background:${color}22;color:${color}">${esc(glyph)}</span>`;
  },

  /** card header row: {icon:{glyph,color}, title, meta, chevron:boolean} */
  head({icon, title, meta='', chevron=false, source=''}={}){
    return `<div class="a-head">
      <div class="t">${icon?UI.icon(icon):''}${esc(title)}${source?UI.info(source):''}</div>
      <div class="d">${esc(meta)}${chevron?'<span class="chev">›</span>':''}</div>
    </div>`;
  },

  /** provenance marker: ⓘ with a hover/focus popover. source = plain text or an object {table, columns, filter, rows, note, status} */
  info(source){
    const o = typeof source==='string' ? {note:source} : (source||{});
    const rows = [['Table', o.table],['Columns', o.columns],['Filter', o.filter],['Rows', o.rows],['Derived', o.derived],['Note', o.note]].filter(r=>r[1]);
    const st = o.status || (o.table ? 'mapped' : 'to be checked');
    return `<span class="a-info" tabindex="0" onclick="event.stopPropagation()"><span class="a-info-ic">i</span><span class="a-tip"><span class="a-tip-st ${st==='mapped'?'ok':'tbc'}">${st==='mapped'?'Data mapping':'Mapping to be checked'}</span>${rows.map(r=>`<span class="a-tip-row"><b>${esc(r[0])}</b><span>${esc(r[1])}</span></span>`).join('')}</span></span>`;
  },

  /** card shell: {body (html), cls, onclick (js string), id} */
  card({body='', cls='', onclick='', id=''}={}){
    return `<div class="a-card ${cls}${onclick?' clickable':''}"${id?` id="${id}"`:''}${onclick?` onclick="${onclick}"`:''}>${body}</div>`;
  },

  /** big stat: {value, unit, caption, color} */
  big({value, unit='', caption='', color=''}={}){
    return `<div class="a-big">
      <div class="v"${color?` style="color:${color}"`:''}>${esc(value)}${unit?`<span>${esc(unit)}</span>`:''}</div>
      ${caption?`<div class="c">${esc(caption)}</div>`:''}
    </div>`;
  },

  /** side-by-side stats: [{label, color, parts:[{value, unit}]}] — first is "this", second is "reference" */
  compare(stats=[]){
    return `<div class="a-compare">${stats.map(s=>`
      <div class="s">
        <span class="l"><i style="background:${s.color||'var(--ink-3)'}"></i>${esc(s.label)}</span>
        <span class="v">${(s.parts||[]).map((p,i)=>`${i?'<span class="sep"></span>':''}${esc(p.value)}<span>${esc(p.unit||'')}</span>`).join('')}</span>
      </div>`).join('')}</div>`;
  },

  /** status pill: {state:'ok'|'watch'|'alarm'|'none', label} */
  pill({state='none', label=''}={}){
    const glyph = {ok:'✓', watch:'!', alarm:'!', none:'?'}[state] || '?';
    return `<span class="a-pill ${state}"><span class="ic">${glyph}</span>${esc(label)}</span>`;
  },

  /** stacked label/value rows: [{k, v, unit, hidden}] — v is rendered bold */
  rows(items=[]){
    return `<div class="a-rows">${items.filter(r=>!r.hidden).map(r=>`
      <div class="a-row"><span class="k">${esc(r.k)}</span><span class="v"><b>${esc(r.v)}</b>${r.unit?' '+esc(r.unit):''}</span></div>`).join('')}</div>`;
  },

  /** percent-of-limit bar: {value, total, color} */
  limit({value=0, total=1, color=''}={}){
    const pct = total ? value/total*100 : 0;
    return `<div class="a-limit"><div class="fill" style="width:${Math.min(100,pct).toFixed(1)}%${color?`;background:${color}`:''}"></div><span class="cap">${pct.toFixed(1)}%</span></div>`;
  },

  /** navigation row card: {icon, label, onclick} */
  nav({icon, label, onclick=''}={}){
    return `<div class="a-card a-nav"${onclick?` onclick="${onclick}"`:''} style="padding:0">
      <div class="a-nav">${icon?UI.icon(icon):''}<span>${esc(label)}</span><span class="chev">›</span></div>
    </div>`;
  },

  /** notice card: {glyph, color, title, body, id} — dismiss hides by id */
  notice({glyph='!', color='#E30019', title, body, id='notice'}={}){
    return `<div class="a-card" id="${id}"><div class="a-notice">
      <span class="big-ic" style="background:${color}18;color:${color}">${esc(glyph)}</span>
      <div><div class="nt">${esc(title)}</div><div class="nb">${body}</div></div>
      <button class="x" aria-label="Dismiss" onclick="document.getElementById('${id}').style.display='none'">✕</button>
    </div></div>`;
  },

  /** period control: {options:[{key,label}], active, onclick:'fnName'} → calls fnName('key') */
  period({options=[], active, onclick=''}={}){
    return `<div class="a-period">${options.map(o=>`<button class="${o.key===active?'on':''}"${onclick?` onclick="${onclick}('${o.key}')"`:''}>${esc(o.label)}</button>`).join('')}</div>`;
  },

  /** range-bar chart (min–max per column, optional dot + threshold):
      {columns:[{label, min, max, dot}], lo, hi, threshold, unit, color, w, h, empty}
      Renders an honest empty state if columns is empty. */
  rangeBars({columns=[], lo, hi, threshold, unit='', color='#1D3C67', w=632, h=170, empty='No range data yet'}={}){
    if(!columns.length) return `<svg class="a-range" viewBox="0 0 ${w} ${h}"><text x="${w/2}" y="${h/2}" text-anchor="middle" font-size="12.5" fill="#8E8E93" font-family="-apple-system">${esc(empty)}</text></svg>`;
    const vals = columns.flatMap(c=>[c.min,c.max,c.dot].filter(v=>v!=null));
    if(threshold!=null) vals.push(threshold);
    const min = lo!=null?lo:Math.min(...vals), max = hi!=null?hi:Math.max(...vals);
    const range = (max-min)||1, padL=8, padR=52, padT=10, padB=26;
    const iw = w-padL-padR, ih = h-padT-padB;
    const y = v => padT + ih - (v-min)/range*ih;
    const colW = iw/columns.length;
    let s = '';
    // gridlines top/mid/bottom + right-side labels
    [max, (max+min)/2, min].forEach(v=>{ s += `<line x1="${padL}" x2="${w-padR+4}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="#E5E5EA" stroke-width="1"/>
      <text x="${w-padR+8}" y="${(y(v)+4).toFixed(1)}" font-size="11" fill="#AEAEB2" font-family="-apple-system">${esc(Number.isInteger(v)?v:v.toFixed(2))}${esc(unit)}</text>`; });
    if(threshold!=null) s += `<line x1="${padL}" x2="${w-padR+4}" y1="${y(threshold).toFixed(1)}" y2="${y(threshold).toFixed(1)}" stroke="${color}" stroke-width="2" stroke-dasharray="4 3" opacity=".8"/>`;
    columns.forEach((c,i)=>{
      const cx = padL + colW*(i+0.5);
      if(c.min!=null && c.max!=null && c.max!==c.min)
        s += `<line x1="${cx.toFixed(1)}" x2="${cx.toFixed(1)}" y1="${y(c.max).toFixed(1)}" y2="${y(c.min).toFixed(1)}" stroke="${color}" stroke-width="7" stroke-linecap="round"/>`;
      else if(c.min!=null) s += `<circle cx="${cx.toFixed(1)}" cy="${y(c.min).toFixed(1)}" r="4" fill="${color}"/>`;
      if(c.dot!=null) s += `<circle cx="${cx.toFixed(1)}" cy="${y(c.dot).toFixed(1)}" r="3" fill="#fff" stroke="${color}" stroke-width="2"/>`;
      if(c.label) s += `<text x="${cx.toFixed(1)}" y="${h-8}" text-anchor="middle" font-size="11" fill="#AEAEB2" font-family="-apple-system">${esc(c.label)}</text>`;
    });
    return `<svg class="a-range" viewBox="0 0 ${w} ${h}">${s}</svg>`;
  },

  /* ================= cards (combos, one per reference screen) ================= */

  /** ref 01/02 — Summary "pinned" card: header, big stat left, small chart right
      {icon, title, meta, value, unit, caption, color, viz (html), onclick} */
  summaryCard({icon, title, meta, value, unit, caption, color, viz='', onclick='', source=''}={}){
    return UI.card({onclick, body:
      UI.head({icon, title, meta, chevron: !!onclick, source}) +
      `<div class="a-summary">${UI.big({value, unit, caption, color})}${viz?`<div class="viz">${viz}</div>`:''}</div>`});
  },

  /** ref 03/06 — Highlight/insight card: header, one-sentence finding, divider, this-vs-reference stats, chart
      {icon, title, meta, sentence, compare:[...], viz (html), foot (html), id} */
  insightCard({icon, title, meta, sentence, compare=[], viz='', foot='', id='', source=''}={}){
    return UI.card({id, body:
      UI.head({icon, title, meta, source}) +
      (sentence?`<p class="a-sentence">${esc(sentence)}</p><hr class="a-hr">`:'') +
      (compare.length?UI.compare(compare):'') + viz + (foot?`<div class="a-foot">${foot}</div>`:'')});
  },

  /** ref 06 — Percent-of-limit card: header, this-vs-total stats, progress bar
      {icon, title, meta, compare:[...], value, total, color, foot} */
  limitCard({icon, title, meta, compare=[], value, total, color, foot='', source=''}={}){
    return UI.card({body:
      UI.head({icon, title, meta, source}) + UI.compare(compare) + UI.limit({value, total, color}) + (foot?`<div class="a-foot">${foot}</div>`:'')});
  },

  /** ref 05 (lower) — Rows card: header + stacked label/value rows
      {icon, title, meta, rows:[{k,v,unit}]} */
  rowsCard({icon, title, meta='', rows=[], source=''}={}){
    return UI.card({body: (title?UI.head({icon, title, meta, source}):'') + UI.rows(rows)});
  },

  /** ref 04/05 — Range card: header, status pill + caption left, range-bar chart
      {icon, title, meta, pill:{state,label}, caption, chart:{...rangeBars props}} */
  rangeCard({icon, title, meta, pill, caption='', chart={}, source=''}={}){
    return UI.card({body:
      UI.head({icon, title, meta, source}) +
      `<div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap;margin-top:8px">
        <div style="min-width:140px">${pill?UI.pill(pill):''}${caption?`<div class="a-foot" style="margin-top:6px">${caption}</div>`:''}</div>
        <div style="flex:1;min-width:260px">${UI.rangeBars(chart)}</div>
      </div>`});
  },

  /** ref 05/07 — Detail page header: breadcrumb, name, status pill, link
      {breadcrumb, name, pill:{state,label}, link:{label, onclick}} */
  detailHeader({breadcrumb='', name='', pill, link, threshold=''}={}){
    return `<div class="datelbl" style="font-size:12.5px">${esc(breadcrumb)}</div>
      <div class="name" style="font-size:20px;margin-top:2px;font-weight:600">${esc(name)}</div>
      ${pill?`<div style="margin:6px 0 2px">${UI.pill(pill)}</div>`:''}${threshold?`<div class="a-thline">${threshold}</div>`:''}
      ${link?`<span class="backlink" style="font-size:12.5px;margin-top:4px;display:inline-block" onclick="${link.onclick||''}">${esc(link.label)} →</span>`:''}`;
  }
};

/* =====================================================================
   Chart card — the Apple pattern on every card: one sentence, the numbers
   that back it (latest / average / high / low / band), a medium chart,
   a range control ON the card, and a way deeper.

   UI.lineChart(props)      — pure SVG atom
   UI.chartCard(props)      — pure combo (needs the range already applied)
   UI.mountChartCard(el, spec) — the one stateful helper: keeps {range} per
   card id, filters spec.points by range, re-renders on the range buttons.
   Points are [{x:'YYYY-MM-DD', v:number}]; the card owns nothing else.
   ===================================================================== */
UI.RANGES = [{key:'30d',label:'30d',days:30},{key:'90d',label:'90d',days:90},{key:'1y',label:'1Y',days:365},{key:'all',label:'All',days:null}];
UI.rangeFilter = function(points, key){
  const r = UI.RANGES.find(x=>x.key===key); if(!r || !r.days || !points.length) return points;
  const last = new Date(points[points.length-1].x+'T00:00:00Z').getTime();
  const from = last - r.days*86400000;
  return points.filter(p => new Date(p.x+'T00:00:00Z').getTime() >= from);
};
UI.stats = function(points){
  if(!points.length) return null;
  const vs = points.map(p=>p.v);
  const hi = Math.max(...vs), lo = Math.min(...vs);
  return {latest:vs[vs.length-1], avg:vs.reduce((a,b)=>a+b,0)/vs.length, hi, lo,
    hiAt:points[vs.indexOf(hi)].x, loAt:points[vs.indexOf(lo)].x, n:points.length, from:points[0].x, to:points[points.length-1].x};
};
UI.fmtNum = v => (v==null||isNaN(v)) ? '—' : (Math.abs(v)>=100 ? v.toFixed(0) : Math.abs(v)>=10 ? v.toFixed(1) : (+v.toFixed(3)).toString());

/** line chart atom: {points:[{x,v}], band:{lo,hi}, avg:boolean, color, w, h, markers:boolean, unit} */
UI.lineChart = function({points=[], band, zones=[], avg=true, color='#1D3C67', w=632, h=150, markers=true, unit='', future=0, cursor=null}={}){
  if(points.length < 2) return `<svg class="a-chart" viewBox="0 0 ${w} ${h}"><text x="${w/2}" y="${h/2}" text-anchor="middle" font-size="12.5" fill="#8E8E93" font-family="-apple-system">${points.length===1?'Only one reading in this range':'No numeric readings in this range'}</text></svg>`;
  const st = UI.stats(points);
  const vals = points.map(p=>p.v).concat(band&&band.lo!=null?[band.lo]:[], band&&band.hi!=null?[band.hi]:[]);
  let min = Math.min(...vals), max = Math.max(...vals); if(max===min){ max+=1; min-=1; } const padV=(max-min)*0.08; min-=padV; max+=padV;
  const padL=8, padR=78, padT=14, padB=22, iw=w-padL-padR, ih=h-padT-padB;
  const tl = new Date(points[points.length-1].x+'T00:00:00Z').getTime(); const t0 = new Date(points[0].x+'T00:00:00Z').getTime(); const dspan=(tl-t0)||86400000*30;
  /* future: fraction of the data span left empty on the right — a provision for projections/trends, drawn grey */
  const t1 = future>0 ? tl + dspan*future : tl; const span=(t1-t0)||1;
  const X = p => padL + (new Date(p.x+'T00:00:00Z').getTime()-t0)/span*iw;
  const Y = v => padT + ih - (v-min)/(max-min)*ih;
  const lbl = (x,y,txt,extra='') => `<text x="${x}" y="${y}" font-size="11.5" fill="#AEAEB2" font-family="-apple-system" ${extra}>${esc(txt)}</text>`;
  let s='';
  const clampY = v => Math.max(padT, Math.min(padT+ih, Y(Math.max(min, Math.min(max, v)))));
  if(future>0){ const xl = padL + (tl-t0)/span*iw; s += UI._futureZone({x:xl, x2:padL+iw, y:padT, h:ih, points, X, Y, clampY}); }
  zones.forEach(z=>{ const top=clampY(z.hi), bot=clampY(z.lo); if(bot-top>0.5) s += `<rect x="${padL}" y="${top.toFixed(1)}" width="${iw}" height="${(bot-top).toFixed(1)}" fill="${z.color}" opacity="0.07"/>`; });
  if(band && band.lo!=null && band.hi!=null){
    const bt=Y(band.hi), bb=Y(band.lo);
    s += `<rect x="${padL}" y="${bt.toFixed(1)}" width="${iw}" height="${Math.max(1,bb-bt).toFixed(1)}" fill="#2D548B" opacity="0.06"/>` + lbl(w-padR+6, bt+4, `band ${UI.fmtNum(band.lo)}–${UI.fmtNum(band.hi)}`);
  }
  if(avg){ const ya=Y(st.avg); s += `<line x1="${padL}" x2="${padL+iw}" y1="${ya.toFixed(1)}" y2="${ya.toFixed(1)}" stroke="#AEAEB2" stroke-width="1" stroke-dasharray="3 3"/>` + lbl(w-padR+6, ya+4, `avg ${UI.fmtNum(st.avg)}`); }
  s += `<polyline points="${points.map(p=>`${X(p).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
  if(markers){
    const pH = points[points.map(p=>p.v).indexOf(st.hi)], pL = points[points.map(p=>p.v).indexOf(st.lo)];
    s += `<circle cx="${X(pH).toFixed(1)}" cy="${Y(pH.v).toFixed(1)}" r="3" fill="#fff" stroke="${color}" stroke-width="2"/>` + lbl(X(pH)+6, Y(pH.v)-6, `high ${UI.fmtNum(st.hi)}`, 'font-weight="600" fill="#1D1D1F"');
    s += `<circle cx="${X(pL).toFixed(1)}" cy="${Y(pL.v).toFixed(1)}" r="3" fill="#fff" stroke="${color}" stroke-width="2"/>` + lbl(X(pL)+6, Y(pL.v)+13, `low ${UI.fmtNum(st.lo)}`, 'font-weight="600" fill="#1D1D1F"');
  }
  if(points.length<=400) points.forEach(p=>{ s += `<circle class="pt" cx="${X(p).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="1.8" fill="${color}" opacity=".8"><title>${esc(fmtDate(p.x))} \u00b7 ${UI.fmtNum(p.v)} ${esc(unit)}</title></circle>`; });
  const pl = points[points.length-1];
  s += `<circle cx="${X(pl).toFixed(1)}" cy="${Y(pl.v).toFixed(1)}" r="4" fill="${color}"/>`;
  s += UI._cursorMark({cursor, points, X, Y, t0, t1:tl, padT, ih, color, fmt: v=>UI.fmtNum(v)+(unit?' '+unit:'')});
  s += lbl(padL, h-6, fmtDate(points[0].x)) + lbl(future>0 ? X(pl) : padL+iw, h-6, fmtDate(pl.x), 'text-anchor="end"');
  return `<svg class="a-chart" viewBox="0 0 ${w} ${h}" ${UI._chartAttrs(t0,t1,padL,iw,w,h)}>${s}</svg>`;
};

/** chart card combo (pure): {id, icon, title, meta, sentence, points (already range-filtered), allPoints, band, unit, color, range, onclick, foot, compact} */
UI.chartCard = function({id='', icon, title, meta='', sentence='', points=[], states=[], expected='', band, zones=[], unit='', color='#1D3C67', range='all', onclick='', foot='', compact=false, source='', future=0, cursor, asOf=null}={}){
  if(cursor===undefined) cursor = UI._cursor;
  if(asOf && points.length && points[points.length-1].x!==asOf && !meta) meta = `as of ${fmtDate(points[points.length-1].x)}`;
  const rangeCtl = `<div class="a-period">${UI.RANGES.map(r=>`<button class="${r.key===range?'on':''}" onclick="UI._setRange('${id}','${r.key}')">${r.label}</button>`).join('')}</div>`;
  /* state/text tag: strip chart + state stats instead of the numeric line */
  if(!points.length && states.length){
    const ss = UI.stateStats(states);
    const stateStats = `<div class="a-stats">
      <div><span class="k">Latest</span><span class="v">${esc(ss.latest)}</span></div>
      <div><span class="k">Unchanged for</span><span class="v">${ss.streak}<em>of ${ss.n} readings</em></span></div>
      ${expected?`<div><span class="k">Expected</span><span class="v">${esc(expected)}</span></div>`:''}
      ${Object.keys(ss.counts).map(k=>`<div><span class="k">${esc(k)}</span><span class="v">${ss.counts[k]}<em>×</em></span></div>`).join('')}
    </div>`;
    return UI.card({id, cls: compact?'a-chartcard compact':'a-chartcard', body:
      UI.head({icon, title, meta, chevron: !!onclick, source}) +
      (sentence?`<p class="a-sentence">${esc(sentence)}</p>`:'') +
      `<div class="a-chartcard-ctl">${rangeCtl}<span class="n">${ss.n} readings${asOf?` \u00b7 to ${fmtDate(asOf)}`:''}</span></div>` + stateStats +
      `<div class="a-chartwrap"${onclick?` onclick="${onclick}" style="cursor:pointer"`:''}>${UI.stateStrip({points:states, expected, h: compact?90:110, cursor})}</div>` +
      (foot?`<div class="a-foot">${foot}</div>`:'')});
  }
  const st = UI.stats(points);
  const statsRow = st ? `<div class="a-stats">
      <div><span class="k">Latest</span><span class="v">${UI.fmtNum(st.latest)}<em>${esc(unit)}</em></span></div>
      <div><span class="k">Average</span><span class="v">${UI.fmtNum(st.avg)}<em>${esc(unit)}</em></span></div>
      <div><span class="k">High</span><span class="v">${UI.fmtNum(st.hi)}<em>${esc(unit)}</em></span><span class="d">${fmtDate(st.hiAt)}</span></div>
      <div><span class="k">Low</span><span class="v">${UI.fmtNum(st.lo)}<em>${esc(unit)}</em></span><span class="d">${fmtDate(st.loAt)}</span></div>
      ${band&&band.lo!=null?`<div><span class="k">Band</span><span class="v">${UI.fmtNum(band.lo)}–${UI.fmtNum(band.hi)}<em>${esc(unit)}</em></span></div>`:''}
    </div>` : '';
  return UI.card({id, cls: compact?'a-chartcard compact':'a-chartcard', body:
    UI.head({icon, title, meta, chevron: !!onclick, source}) +
    (sentence?`<p class="a-sentence">${esc(sentence)}</p>`:'') +
    `<div class="a-chartcard-ctl">${rangeCtl}<span class="n">${st?st.n+' readings':''}</span></div>` +
    statsRow +
    `<div class="a-chartwrap"${onclick?` onclick="${onclick}" style="cursor:pointer"`:''}>${UI.lineChart({points, band, zones, color, unit, h: compact?120:160, future, cursor})}</div>` +
    (foot?`<div class="a-foot">${foot}</div>`:'')});
};

/* the one stateful bit: card registry + range switching */
UI._cards = {};
UI.mountChartCard = function(el, spec){
  if(!el) return; const id = spec.id || ('cc'+Object.keys(UI._cards).length);
  let range = spec.range || UI._cards[id]?.range || spec.defaultRange || 'all';
  /* auto-widen: if the chosen window holds fewer than 8 readings, step out to the smallest range that has enough (Apple's "show me something useful" default) */
  if(!spec.range && !UI._cards[id]){
    const all = (spec.points||[]).length ? spec.points : (spec.states||[]);
    const keys = UI.RANGES.map(r=>r.key); let k = keys.indexOf(range);
    while(k < keys.length-1 && UI.rangeFilter(all, keys[k]).length < 8) k++;
    range = keys[k];
  }
  UI._cards[id] = Object.assign({}, spec, {id, el, range});
  UI._renderCard(id);
};
UI._renderCard = function(id){
  const c = UI._cards[id]; if(!c) return;
  const pts = UI.rangeFilter(c.points||[], c.range);
  const sts = (c.points||[]).length ? [] : UI.rangeFilter(c.states||[], c.range);
  c.el.innerHTML = UI.chartCard(Object.assign({}, c, {points:pts, states:sts}));
};
UI._setRange = function(id, key){ if(UI._cards[id]){ UI._cards[id].range = key; UI._renderCard(id); } };

/* state strip — the chart for state/text tags (lamp ON/OFF, switch AUTO/MANUAL): one block per reading, coloured by state */
UI.STATE_COLORS = ['#1D3C67','#E30019','#FE9413','#1DA100','#8E8E93','#6D28D9','#0E7490'];
UI.stateStats = function(points){
  if(!points.length) return null;
  const last = points[points.length-1].s; let streak=0;
  for(let i=points.length-1;i>=0 && points[i].s===last;i--) streak++;
  const counts = {}; points.forEach(p=>counts[p.s]=(counts[p.s]||0)+1);
  return {latest:last, streak, counts, n:points.length, from:points[0].x, to:points[points.length-1].x};
};
UI.stateStrip = function({points=[], w=632, h=96, expected, cursor=null}={}){
  if(!points.length) return `<svg class="a-chart" viewBox="0 0 ${w} ${h}"><text x="${w/2}" y="${h/2}" text-anchor="middle" font-size="12.5" fill="#8E8E93" font-family="-apple-system">No readings in this range</text></svg>`;
  const states = [...new Set(points.map(p=>p.s))];
  const col = s => UI.STATE_COLORS[states.indexOf(s) % UI.STATE_COLORS.length];
  const padL=8, padR=8, padT=8, padB=36, iw=w-padL-padR, bh=h-padT-padB;
  const t0 = new Date(points[0].x+'T00:00:00Z').getTime(), t1 = new Date(points[points.length-1].x+'T00:00:00Z').getTime(), span=(t1-t0)||1;
  const X = p => padL + (new Date(p.x+'T00:00:00Z').getTime()-t0)/span*iw;
  let s = `<rect x="${padL}" y="${padT}" width="${iw}" height="${bh}" fill="#F2F2F7" rx="4"/>`;
  points.forEach((p,i)=>{ const x=X(p); const x2 = i<points.length-1 ? X(points[i+1]) : padL+iw; s += `<rect x="${x.toFixed(1)}" y="${padT}" width="${Math.max(2,x2-x).toFixed(1)}" height="${bh}" fill="${col(p.s)}" opacity=".85"/>`; });
  s += UI._cursorMark({cursor, points, X, Y: ()=>padT+bh/2, t0, t1, padT, ih:bh, color:'#1D3C67', fmt: p=>p, key:'s'});
  const st = UI.stateStats(points);
  let lx = padL;
  states.forEach(stt=>{ s += `<rect x="${lx}" y="${h-26}" width="10" height="10" rx="2" fill="${col(stt)}"/><text x="${lx+14}" y="${h-17}" font-size="11" fill="#1D1D1F" font-family="-apple-system">${esc(stt)} ×${st.counts[stt]}</text>`; lx += 14 + (String(stt).length+String(st.counts[stt]).length+3)*6.6 + 12; });
  s += `<text x="${padL}" y="${h-4}" font-size="10.5" fill="#AEAEB2" font-family="-apple-system">${esc(fmtDate(points[0].x))}</text><text x="${padL+iw}" y="${h-4}" text-anchor="end" font-size="10.5" fill="#AEAEB2" font-family="-apple-system">${esc(fmtDate(points[points.length-1].x))}</text>`;
  if(expected) s += `<text x="${padL+iw}" y="${h-17}" text-anchor="end" font-size="11" fill="#6E6E73" font-family="-apple-system">expected ${esc(expected)}</text>`;
  return `<svg class="a-chart" viewBox="0 0 ${w} ${h}" ${UI._chartAttrs(t0,t1,padL,iw,w,h)}>${s}</svg>`;
};

/* =====================================================================
   Data-specific charts (23-Sep, third walkthrough): the chart type follows
   the data — counts per check are bars, siblings on one date are grouped
   bars, states are strips, continuous readings are lines.
   + drag-to-zoom POC: every mounted chart card lets you drag a range on
   the chart (zoom in), "Zoom out" doubles the window, "Reset" returns to
   the preset. Hovering shows the nearest reading.
   ===================================================================== */
/* the grey "what comes next" zone: empty by design. Draws a light grey area after the last reading, a dashed
   continuation of the recent linear trend (least squares over the last third of the points) in grey, labelled
   "provision, not a forecast". The real app fills this from a prediction table when one exists. */
UI._futureZone = function({x, x2, y, h, points, X, Y, clampY}){
  let s = `<rect x="${x.toFixed(1)}" y="${y}" width="${Math.max(0,x2-x).toFixed(1)}" height="${h}" fill="#8E8E93" opacity=".07"/>` +
          `<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${y}" y2="${y+h}" stroke="#AEAEB2" stroke-width="1" stroke-dasharray="2 3"/>`;
  const tail = points.slice(-Math.max(3, Math.floor(points.length/3)));
  if(tail.length>=3){
    const xs = tail.map(p=>X(p)), ys = tail.map(p=>p.v); const n=xs.length, mx=xs.reduce((a,b)=>a+b,0)/n, my=ys.reduce((a,b)=>a+b,0)/n;
    let num=0, den=0; for(let i=0;i<n;i++){ num += (xs[i]-mx)*(ys[i]-my); den += (xs[i]-mx)**2; }
    const k = den ? num/den : 0; const vAt = px => my + k*(px-mx);
    s += `<line x1="${x.toFixed(1)}" y1="${clampY(vAt(x)).toFixed(1)}" x2="${x2.toFixed(1)}" y2="${clampY(vAt(x2)).toFixed(1)}" stroke="#AEAEB2" stroke-width="1.5" stroke-dasharray="4 4" opacity=".8"/>`;
  }
  s += `<text x="${((x+x2)/2).toFixed(1)}" y="${y+h-5}" text-anchor="middle" font-size="10.5" fill="#AEAEB2" font-family="-apple-system">next · provision, not a forecast</text>`;
  return s;
};
/* the moving dot: when the app plays through dates, every mounted chart marks the reading on (or just before) the
   selected date — a vertical line + a ring on the point + the value. Outside the chart's window: nothing. */
UI._cursorMark = function({cursor, points, X, Y, t0, t1, padT, ih, color, fmt, key='v'}){
  if(!cursor || !points.length) return '';
  const tc = new Date(cursor+'T00:00:00Z').getTime(); if(tc < t0 || tc > t1) return '';
  let p=null; for(const q of points){ if(q.x<=cursor) p=q; else break; } if(!p) return '';
  const x = X({x:cursor}), px = X(p), py = Y(p[key]);
  return `<g class="a-cursor"><line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${padT}" y2="${padT+ih}" stroke="#0071E3" stroke-width="1.2" stroke-dasharray="3 3" opacity=".7"/>` +
         `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="5" fill="#0071E3" stroke="#fff" stroke-width="2"/>` +
         `<text x="${(x+6).toFixed(1)}" y="${padT+11}" font-size="11" font-weight="600" fill="#0071E3" font-family="-apple-system">${esc(fmt(p[key]))}${p.x!==cursor?' · '+esc(fmtDate(p.x)):''}</text></g>`;
};
/* app calls UI.setCursor(iso) whenever the selected date changes; every mounted chart card re-renders with the dot */
UI._cursor = null;
UI.setCursor = function(iso){ UI._cursor = iso; Object.keys(UI._cards).forEach(id=>{ const c=UI._cards[id]; if(c.el && c.el.isConnected) UI._renderCard(id); }); };
UI._chartAttrs = (t0,t1,padL,iw,w,h) => `data-zoom="1" data-t0="${t0}" data-t1="${t1}" data-padl="${padL}" data-iw="${iw}" data-w="${w}" data-h="${h}"`;

/** bar chart at calendar positions: {series:[{label,color,points:[{x,v}]}], stacked, highlightX, w, h, unit} — or {points} for one series */
UI.barChart = function({points, series, stacked=true, spacing='calendar', highlightX, color='#1D3C67', w=632, h=130, unit=''}={}){
  if(points && !series) series = [{label:'', color, points}];
  series = (series||[]).filter(s=>s.points && s.points.length);
  if(!series.length) return `<svg class="a-chart" viewBox="0 0 ${w} ${h}"><text x="${w/2}" y="${h/2}" text-anchor="middle" font-size="12.5" fill="#8E8E93" font-family="-apple-system">No readings in this range</text></svg>`;
  const xs = [...new Set(series.flatMap(s=>s.points.map(p=>p.x)))].sort();
  const tot = x => stacked ? series.reduce((a,s)=>a+((s.points.find(p=>p.x===x)||{}).v||0),0) : Math.max(...series.map(s=>(s.points.find(p=>p.x===x)||{}).v||0));
  const max = Math.max(1, ...xs.map(tot));
  const padL=8, padR=56, padT=12, padB=22, iw=w-padL-padR, ih=h-padT-padB;
  const t0=new Date(xs[0]+'T00:00:00Z').getTime(), t1=new Date(xs[xs.length-1]+'T00:00:00Z').getTime(), span=(t1-t0)||1;
  const slot = iw/Math.max(1,xs.length);
  const X = spacing==='even' ? (x => padL + slot*(xs.indexOf(x)+0.5)) : (x => padL + (new Date(x+'T00:00:00Z').getTime()-t0)/span*iw);
  const nSer = stacked ? 1 : series.length;
  const bw = spacing==='even' ? Math.max(3, Math.min(18, slot*0.72/nSer)) : Math.max(3, Math.min(14, slot*0.7/nSer));
  let s='';
  [max, max/2].forEach(v=>{ const y=padT+ih-v/max*ih; s+=`<line x1="${padL}" x2="${padL+iw}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#E5E5EA"/><text x="${w-padR+8}" y="${(y+4).toFixed(1)}" font-size="11" fill="#AEAEB2" font-family="-apple-system">${Number.isInteger(v)?v:v.toFixed(1)}${esc(unit)}</text>`; });
  xs.forEach(x=>{ let acc=0; const cx=X(x); const hl = highlightX && x===highlightX;
    if(hl) s+=`<rect x="${(cx-slot/2).toFixed(1)}" y="${padT-2}" width="${slot.toFixed(1)}" height="${ih+4}" rx="4" fill="#1D3C67" opacity=".07"/>`;
    series.forEach((sr,si)=>{ const v=(sr.points.find(p=>p.x===x)||{}).v||0; if(!v) return;
      const y0=padT+ih-(stacked?acc:0)/max*ih, y1=padT+ih-(stacked?acc+v:v)/max*ih;
      const bx = stacked ? cx-bw/2 : cx - (nSer*bw)/2 + si*bw;
      s+=`<rect x="${bx.toFixed(1)}" y="${y1.toFixed(1)}" width="${(bw-(stacked?0:1)).toFixed(1)}" height="${Math.max(1,y0-y1).toFixed(1)}" rx="2" fill="${sr.color}" opacity="${highlightX?(hl?1:.55):.9}"/>`; acc+=v; });
  });
  if(spacing==='even' && xs.length>8){ const step=Math.ceil(xs.length/6); xs.forEach((x,i)=>{ if(i%step===0 && i>0 && i<xs.length-1 && (padL+iw-X(x))>70) s+=`<text x="${X(x).toFixed(1)}" y="${h-6}" text-anchor="middle" font-size="10" fill="#C7C7CC" font-family="-apple-system">${esc(fmtDate(x).slice(0,6))}</text>`; }); }
  s += `<text x="${padL}" y="${h-6}" font-size="11" fill="#AEAEB2" font-family="-apple-system">${esc(fmtDate(xs[0]))}</text><text x="${padL+iw}" y="${h-6}" text-anchor="end" font-size="11" fill="#AEAEB2" font-family="-apple-system">${esc(fmtDate(xs[xs.length-1]))}</text>`;
  if(series.length>1) s += series.map((sr,i)=>`<rect x="${padL+i*70}" y="2" width="9" height="9" rx="2" fill="${sr.color}"/><text x="${padL+i*70+13}" y="10" font-size="10.5" fill="#6E6E73" font-family="-apple-system">${esc(sr.label)}</text>`).join('');
  return `<svg class="a-chart" viewBox="0 0 ${w} ${h}" ${UI._chartAttrs(t0,t1,padL,iw,w,h)}>${s}</svg>`;
};

/** grouped bars for siblings on one date: {groups:[{label, v, highlight}], band:{lo,hi}, unit, color, w, h} */
UI.groupBars = function({groups=[], band, unit='', color='#8E8E93', hiColor='#E30019', w=632, h=150}={}){
  const vals = groups.map(g=>g.v).filter(v=>v!=null).concat(band&&band.lo!=null?[band.lo]:[], band&&band.hi!=null?[band.hi]:[]);
  if(!vals.length) return `<svg class="a-chart" viewBox="0 0 ${w} ${h}"><text x="${w/2}" y="${h/2}" text-anchor="middle" font-size="12.5" fill="#8E8E93" font-family="-apple-system">No readings</text></svg>`;
  let min=Math.min(0,...vals), max=Math.max(...vals); if(max===min) max=min+1; max+= (max-min)*0.18;
  const padL=8, padR=56, padT=12, padB=24, iw=w-padL-padR, ih=h-padT-padB;
  const Y = v => padT+ih-(v-min)/(max-min)*ih;
  const gw = iw/groups.length, bw = Math.min(46, gw*0.6);
  let s='';
  if(band && band.lo!=null && band.hi!=null){ const bt=Y(band.hi), bb=Y(band.lo); s+=`<rect x="${padL}" y="${bt.toFixed(1)}" width="${iw}" height="${Math.max(1,bb-bt).toFixed(1)}" fill="#2D548B" opacity=".06"/><text x="${w-padR+6}" y="${(bt+4).toFixed(1)}" font-size="10.5" fill="#AEAEB2" font-family="-apple-system">band ${UI.fmtNum(band.lo)}–${UI.fmtNum(band.hi)}</text>`; }
  groups.forEach((g,i)=>{ const cx=padL+gw*(i+0.5); if(g.v==null){ if(g.s!=null){ s+=`<text x="${cx.toFixed(1)}" y="${(Y(Math.max(min,0))-6).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="600" fill="${g.highlight?hiColor:'#6E6E73'}" font-family="-apple-system">${esc(g.s)}</text><text x="${cx.toFixed(1)}" y="${h-7}" text-anchor="middle" font-size="11" fill="${g.highlight?hiColor:'#6E6E73'}" font-family="-apple-system">${esc(g.label)}</text>`; } return; } const y=Y(g.v), y0=Y(Math.max(min,0)); const c=g.highlight?hiColor:color;
    s+=`<rect x="${(cx-bw/2).toFixed(1)}" y="${Math.min(y,y0).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1,Math.abs(y0-y)).toFixed(1)}" rx="4" fill="${c}" opacity="${g.highlight?1:.75}"/>`;
    s+=`<text x="${cx.toFixed(1)}" y="${(y-5).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="${g.highlight?700:500}" fill="${g.highlight?hiColor:'#1D1D1F'}" font-family="-apple-system">${UI.fmtNum(g.v)}</text>`;
    s+=`<text x="${cx.toFixed(1)}" y="${h-7}" text-anchor="middle" font-size="11" fill="${g.highlight?hiColor:'#6E6E73'}" font-family="-apple-system">${esc(g.label)}</text>`; });
  if(unit) s+=`<text x="${w-padR+6}" y="${(Y(max)+14).toFixed(1)}" font-size="10.5" fill="#AEAEB2" font-family="-apple-system">${esc(unit)}</text>`;
  return `<svg class="a-chart" viewBox="0 0 ${w} ${h}">${s}</svg>`;
};

/* ---- zoom: custom ranges on mounted chart cards ---- */
const _origRangeFilter = UI.rangeFilter;
UI.rangeFilter = function(points, key, custom){
  if(key==='custom' && custom) return points.filter(p=>{ const t=new Date(p.x+'T00:00:00Z').getTime(); return t>=custom.from && t<=custom.to; });
  return _origRangeFilter(points, key);
};
const _origRenderCard = UI._renderCard;
UI._renderCard = function(id){
  const c = UI._cards[id]; if(!c) return;
  /* follow the selected date: the window ends at UI._cursor, stats are computed up to it, the headline is that day's
     reading (spec.follow===false opts out — e.g. a fleet trend that should always show the newest). */
  const asOf = c.follow===false ? null : UI._cursor;
  const base = asOf ? (c.points||[]).filter(p=>p.x<=asOf) : (c.points||[]);
  const baseS = asOf ? (c.states||[]).filter(p=>p.x<=asOf) : (c.states||[]);
  const pts = UI.rangeFilter(base, c.range, c.custom);
  const sts = base.length ? [] : UI.rangeFilter(baseS, c.range, c.custom);
  const empty = (c.points||[]).length + (c.states||[]).length > 0 && !pts.length && !sts.length;
  c.el.innerHTML = empty ? UI.chartCard(Object.assign({}, c, {points:[], states:[], sentence: c.sentence || '', foot:`No reading on or before ${fmtDate(asOf)} in this window.`})) : UI.chartCard(Object.assign({}, c, {points:pts, states:sts, asOf}));
  /* zoom controls next to the presets */
  const ctl = c.el.querySelector('.a-chartcard-ctl'); if(ctl){
    const extra = document.createElement('span'); extra.className='a-zoomctl';
    extra.innerHTML = (c.range==='custom' ? `<button class="chip small" onclick="UI._zoomOut('${id}')">Zoom out</button><button class="chip small" onclick="UI._resetZoom('${id}')">Reset</button>` : '') + `<span class="a-hover" id="${id}-hover">${c.range==='custom'?'':'drag on the chart to zoom'}</span>`;
    ctl.appendChild(extra);
    if(c.range==='custom'){ const on = ctl.querySelector('.a-period button.on'); if(on) on.classList.remove('on'); }
  }
  UI._wireZoom(id);
};
UI._wireZoom = function(id){
  const c = UI._cards[id]; const svg = c.el.querySelector('svg[data-zoom]'); if(!svg) return;
  const w=+svg.dataset.w, padL=+svg.dataset.padl, iw=+svg.dataset.iw, t0=+svg.dataset.t0, t1=+svg.dataset.t1;
  const vx = e => { const r=svg.getBoundingClientRect(); return (e.clientX-r.left)/r.width*w; };
  const tAt = x => t0 + (Math.max(padL, Math.min(padL+iw, x))-padL)/iw*(t1-t0);
  let x0=null, sel=null;
  svg.style.cursor='crosshair';
  svg.addEventListener('pointerdown', e=>{ x0=vx(e); svg.setPointerCapture(e.pointerId); sel=document.createElementNS('http://www.w3.org/2000/svg','rect'); sel.setAttribute('y',0); sel.setAttribute('height',svg.dataset.h); sel.setAttribute('fill','#0071E3'); sel.setAttribute('opacity','.12'); svg.appendChild(sel); e.preventDefault(); });
  svg.addEventListener('pointermove', e=>{
    const x=vx(e);
    if(x0!=null && sel){ sel.setAttribute('x',Math.min(x0,x)); sel.setAttribute('width',Math.abs(x-x0)); return; }
    const hov=document.getElementById(id+'-hover'); if(!hov) return;
    const pts = (c.points||[]).length ? UI.rangeFilter(c.points, c.range, c.custom) : UI.rangeFilter(c.states||[], c.range, c.custom);
    if(!pts.length) return; const t=tAt(x); let best=pts[0], bd=Infinity; pts.forEach(p=>{ const d=Math.abs(new Date(p.x+'T00:00:00Z').getTime()-t); if(d<bd){bd=d;best=p;} });
    hov.textContent = `${fmtDate(best.x)} · ${best.v!=null?UI.fmtNum(best.v)+' '+(c.unit||''):best.s}`;
  });
  const end = e=>{ if(x0==null) return; const x=vx(e); const a=Math.min(x0,x), b=Math.max(x0,x); if(sel) sel.remove(); sel=null;
    if(b-a>8){ c.presetRange = c.range==='custom'?c.presetRange:c.range; c.custom={from:tAt(a), to:tAt(b)}; c.range='custom'; UI._renderCard(id); }
    x0=null; };
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', ()=>{ if(sel) sel.remove(); sel=null; x0=null; });
  svg.addEventListener('dblclick', ()=>UI._resetZoom(id));
};
UI._zoomOut = function(id){ const c=UI._cards[id]; if(!c||!c.custom) return; const mid=(c.custom.from+c.custom.to)/2, half=(c.custom.to-c.custom.from); c.custom={from:mid-half, to:mid+half}; UI._renderCard(id); };
UI._resetZoom = function(id){ const c=UI._cards[id]; if(!c) return; c.custom=null; c.range=c.presetRange||'all'; UI._renderCard(id); };
const _origSetRange = UI._setRange;
UI._setRange = function(id,key){ const c=UI._cards[id]; if(c){ c.custom=null; } _origSetRange(id,key); };

/* =====================================================================
   Date selection (item 1): a strip of recent checks + an Apple-style
   date picker for anything older. dates: [{x:'YYYY-MM-DD', tier, analysed}]
   ===================================================================== */
UI.MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
/** {dates, selected, onclick:'fn' (fn(iso)), onMore:'js', limit} */
UI.dateStrip = function({dates=[], selected, onclick='', onMore='', limit=60}={}){
  const show = dates.slice(-limit); let lastM='';
  const pills = show.map(d=>{ const m=d.x.slice(0,7); const first = m!==lastM; lastM=m;
    const dot = d.analysed ? `<span class="dot" style="background:${colorForTier(d.tier)}"></span>` : '';
    return `<button class="dp${d.x===selected?' sel':''}${first?' first':''}${d.analysed?' an':''}" data-x="${d.x}"${onclick?` onclick="${onclick}('${d.x}')"`:''} title="${fmtDate(d.x)}${d.analysed?' · analysed':''}"><span class="m">${first?UI.MONTHS[+d.x.slice(5,7)-1]+(d.x.slice(0,4)!==(show[0].x.slice(0,4))?' '+d.x.slice(2,4):''):'&nbsp;'}</span><span class="d">${d.x.slice(8,10)}</span>${dot}</button>`; }).join('');
  return `<div class="a-dates"><button class="chip small" onclick="${onMore}">All dates ▾</button><div class="a-dates-track" id="datesTrack">${pills}</div><span class="a-dates-n">${dates.length.toLocaleString()} checks · ${dates.filter(d=>d.analysed).length} analysed</span></div>`;
};
/** {dates, selected, year, month(0-11), onclick:'fn', onNav:'fn' (fn('prev'|'next'|'y:2025'))} */
UI.datePicker = function({dates=[], selected, year, month, onclick='', onNav=''}={}){
  const byDay = {}; dates.forEach(d=>byDay[d.x]=d);
  const years = [...new Set(dates.map(d=>+d.x.slice(0,4)))];
  const first = new Date(Date.UTC(year, month, 1)); const startDow = (first.getUTCDay()+6)%7; const dim = new Date(Date.UTC(year, month+1, 0)).getUTCDate();
  let cells = ['Mo','Tu','We','Th','Fr','Sa','Su'].map(w=>`<div class="wd">${w}</div>`).join('');
  for(let i=0;i<startDow;i++) cells += '<div></div>';
  for(let d=1; d<=dim; d++){ const iso=`${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; const has=byDay[iso];
    cells += has ? `<button class="day has${iso===selected?' sel':''}" onclick="${onclick}('${iso}')" title="${fmtDate(iso)}${has.analysed?' · analysed':''}">${d}<span class="dot" style="background:${has.analysed?colorForTier(has.tier):'#C7C7CC'}"></span></button>` : `<div class="day no">${d}</div>`; }
  const inMonth = dates.filter(d=>d.x.startsWith(`${year}-${String(month+1).padStart(2,'0')}`));
  return `<div class="a-cal">
    <div class="a-cal-years">${years.map(y=>`<button class="chip small${y===year?' active':''}" onclick="${onNav}('y:${y}')">${y}</button>`).join('')}</div>
    <div class="a-cal-h"><button class="hamb" onclick="${onNav}('prev')">‹</button><span>${UI.MONTHS[month]} ${year}</span><button class="hamb" onclick="${onNav}('next')">›</button></div>
    <div class="a-cal-grid">${cells}</div>
    <div class="a-foot" style="margin-top:8px">${inMonth.length} check${inMonth.length===1?'':'s'} this month · coloured dot = analysed, grey dot = readings only</div>
  </div>`;
};


/* =====================================================================
   Map / globe (item 5 + "Google Earth view"): offline, SVG only.
   UI.globe({coast, track, mode:'globe'|'flat', center:[lon,lat], w, h,
             colorBy:'year', selected}) — track = [[date,lat,lon,status,sog],...]
   Orthographic globe (drag to rotate via UI.mountGlobe) or equirectangular flat map.
   ===================================================================== */
UI.YEAR_COLORS = ['#0071E3','#1DA100','#FE9413','#E30019','#6D28D9','#0E7490','#B85D00','#8E8E93','#1D3C67','#C2410C'];
UI.yearColor = y => UI.YEAR_COLORS[(+y - 2017) % UI.YEAR_COLORS.length];
UI.globe = function({coast=[], track=[], mode='globe', center=[20,0], w=632, h=420, selected=null, years=null, maxJump=15, tip=null, weather=[]}={}){
  /* maxJump: degrees of great-circle travel per day above which the line is broken (a ship makes < 12°/day at 25 kn).
     The dot for the odd row is still drawn — a bad coordinate stays visible, it just doesn't draw a line across a continent. */
  const gc = (a,b)=>{ const r=Math.PI/180, f1=a[1]*r, f2=b[1]*r, dl=(b[2]-a[2])*r; return Math.acos(Math.max(-1,Math.min(1, Math.sin(f1)*Math.sin(f2)+Math.cos(f1)*Math.cos(f2)*Math.cos(dl))))/r; };
  const days = (a,b)=>Math.max(1, (Date.parse(b[0])-Date.parse(a[0]))/86400000);
  const R = Math.min(w,h)/2 - 8, cx=w/2, cy=h/2; const rad = Math.PI/180;
  const [lon0, lat0] = center; const sl0=Math.sin(lat0*rad), cl0=Math.cos(lat0*rad);
  const proj = mode==='globe'
    ? ((lon,lat)=>{ const l=(lon-lon0)*rad, f=lat*rad; const cosc = sl0*Math.sin(f)+cl0*Math.cos(f)*Math.cos(l); if(cosc<0) return null; return [cx + R*Math.cos(f)*Math.sin(l), cy - R*(cl0*Math.sin(f)-sl0*Math.cos(f)*Math.cos(l))]; })
    : ((lon,lat)=>{ let L=lon-lon0; L=((L+540)%360)-180; return [cx + L/180*(w/2-8), cy - lat/90*(h/2-8)]; });
  let s = mode==='globe' ? `<circle cx="${cx}" cy="${cy}" r="${R}" fill="#EAF2FB" stroke="#D2D2D7"/>` : `<rect x="8" y="8" width="${w-16}" height="${h-16}" rx="10" fill="#EAF2FB" stroke="#D2D2D7"/>`;
  const seg = (pts, close) => { let d='', pen=false; pts.forEach(p=>{ const q=proj(p[0],p[1]); if(!q){ pen=false; return; } d += (pen?'L':'M')+q[0].toFixed(1)+' '+q[1].toFixed(1); pen=true; }); return d; };
  coast.forEach(poly=>{ if(mode==='flat'){ let d='', pen=false, prev=null; poly.forEach(p=>{ const q=proj(p[0],p[1]); if(prev && Math.abs(q[0]-prev[0])>w/2){ pen=false; } d += (pen?'L':'M')+q[0].toFixed(1)+' '+q[1].toFixed(1); pen=true; prev=q; }); s += `<path d="${d}" fill="#F4F4F6" stroke="#B8BCC4" stroke-width=".8"/>`; } else { const d=seg(poly); if(d) s += `<path d="${d}" fill="#F4F4F6" stroke="#B8BCC4" stroke-width=".8"/>`; } });
  if(mode==='globe'){ for(let la=-60; la<=60; la+=30){ const pts=[]; for(let lo=-180; lo<=180; lo+=5) pts.push([lo,la]); const d=seg(pts); if(d) s+=`<path d="${d}" fill="none" stroke="#D9DEE6" stroke-width=".5"/>`; } for(let lo=-180; lo<180; lo+=30){ const pts=[]; for(let la=-85; la<=85; la+=5) pts.push([lo,la]); const d=seg(pts); if(d) s+=`<path d="${d}" fill="none" stroke="#D9DEE6" stroke-width=".5"/>`; } }
  const tr = years ? track.filter(t=>years.includes(t[0].slice(0,4))) : track;
  let d='', pen=false, prev=null, prevYear=null, paths=[], prevT=null;
  tr.forEach(t=>{ const q=proj(t[2],t[1]); const yr=t[0].slice(0,4); const jump = prevT && maxJump && gc(prevT,t) > maxJump*days(prevT,t); if(!q || jump || (prev && mode==='flat' && Math.abs(q[0]-prev[0])>w/2) || yr!==prevYear){ if(d) paths.push([prevYear,d]); d=''; pen=false; } if(q){ d += (pen?'L':'M')+q[0].toFixed(1)+' '+q[1].toFixed(1); pen=true; } prev=q; prevYear=yr; prevT=t; });
  if(d) paths.push([prevYear,d]);
  paths.forEach(([yr,pd])=> s += `<path d="${pd}" fill="none" stroke="${UI.yearColor(yr)}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>`);
  /* hover dots: data-i indexes into `track` so UI.mountGlobe can show the caller's `tip(row)` overlay (noon report data etc.) */
  if(tr.length<=3000) tr.forEach((t,i)=>{ const q=proj(t[2],t[1]); if(q) s+=`<circle class="tp" data-i="${track.indexOf(t)}" cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="${tr.length<=400?2.4:1.4}" fill="${UI.yearColor(t[0].slice(0,4))}">${tip?'':`<title>${esc(fmtDate(t[0]))} · ${esc(t[3]||'')}${t[4]!=null?' · '+t[4]+' kn':''} · ${t[1]}, ${t[2]}</title>`}</circle>`; });
  /* weather layer — PROVISION: [[lat, lon, dir_deg (from), speed_kn, wave_m], ...]; arrows point downwind, colour by speed. Empty until a weather pull exists (see WEATHER-SOURCES.md). */
  (weather||[]).forEach(wv=>{ const q=proj(wv[1],wv[0]); if(!q) return; const a=(wv[2]+180)*Math.PI/180, L=Math.min(22, 6+wv[3]*0.6); const dx=Math.sin(a)*L, dy=-Math.cos(a)*L; const c = wv[3]>=34?'#E30019':wv[3]>=22?'#FE9413':'#5A7FA8';
    s += `<g class="wx" opacity=".85"><line x1="${(q[0]-dx/2).toFixed(1)}" y1="${(q[1]-dy/2).toFixed(1)}" x2="${(q[0]+dx/2).toFixed(1)}" y2="${(q[1]+dy/2).toFixed(1)}" stroke="${c}" stroke-width="1.4"/><circle cx="${(q[0]+dx/2).toFixed(1)}" cy="${(q[1]+dy/2).toFixed(1)}" r="1.8" fill="${c}"/><title>wind ${wv[3]} kn from ${wv[2]}°${wv[4]!=null?' · wave '+wv[4]+' m':''}</title></g>`; });
  const last = selected || tr[tr.length-1]; if(last){ const q=proj(last[2],last[1]); if(q) s += `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="7" fill="#0071E3" opacity=".25"/><circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="4" fill="#0071E3" stroke="#fff" stroke-width="1.5"><title>${esc(fmtDate(last[0]))} · ${esc(last[3]||'')}</title></circle>`; }
  const ys = [...new Set(tr.map(t=>t[0].slice(0,4)))];
  s += ys.map((y,i)=>`<rect x="${12+i*52}" y="${h-22}" width="9" height="9" rx="2" fill="${UI.yearColor(y)}"/><text x="${25+i*52}" y="${h-14}" font-size="11" fill="#6E6E73" font-family="-apple-system">${y}</text>`).join('');
  return `<svg class="a-globe" viewBox="0 0 ${w} ${h}" data-mode="${mode}" data-lon="${lon0}" data-lat="${lat0}">${s}</svg>`;
};
/* stateful: rotate by dragging (globe) or panning (flat); keeps state per id */
UI._globes = {};
UI.mountGlobe = function(el, spec){
  if(!el) return; const id = spec.id || 'globe'; const st = UI._globes[id] = Object.assign({center:[20,0], mode:'globe'}, UI._globes[id]||{}, spec, {el});
  el.innerHTML = UI.globe(st); if(el._tipbox) el.appendChild(el._tipbox);
  /* listeners live on the container (it persists); the SVG inside is replaced on every frame of the drag,
     so it must not carry the listeners or the pointer capture (that was the "can't move the earth" bug). */
  if(!el._globeWired){
    el._globeWired = true; el.style.cursor='grab'; el.style.touchAction='none';
    let drag=null, raf=0;
    const cur = () => UI._globes[el._globeId];
    el.addEventListener('pointerdown', e=>{ const g=cur(); if(!g) return; drag={x:e.clientX,y:e.clientY,c:[...g.center]}; try{ el.setPointerCapture(e.pointerId); }catch(_){} el.style.cursor='grabbing'; e.preventDefault(); });
    el.addEventListener('pointermove', e=>{ const g=cur(); if(!drag || !g) return; const r=el.getBoundingClientRect(); const k = 180/Math.max(1,r.width)*1.6;
      let lon = drag.c[0]-(e.clientX-drag.x)*k; let lat = g.mode==='globe' ? Math.max(-85, Math.min(85, drag.c[1]+(e.clientY-drag.y)*k)) : 0;
      g.center=[lon, lat]; if(!raf) raf=requestAnimationFrame(()=>{ raf=0; el.innerHTML = UI.globe(g); if(el._tipbox) el.appendChild(el._tipbox); }); });
    const end = e=>{ if(!drag) return; drag=null; el.style.cursor='grab'; try{ el.releasePointerCapture(e.pointerId); }catch(_){} const g=cur(); if(g){ el.innerHTML = UI.globe(g); if(el._tipbox) el.appendChild(el._tipbox); } };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('lostpointercapture', ()=>{ if(drag){ drag=null; el.style.cursor='grab'; } });
    el.addEventListener('dragstart', e=>e.preventDefault());
    /* hover overlay on track points: the caller's tip(row) → HTML (e.g. the whole noon report for that day) */
    el.style.position = el.style.position || 'relative';
    const box = document.createElement('div'); box.className='a-tipbox'; box.style.display='none'; el.appendChild(box); el._tipbox = box;
    el.addEventListener('pointermove', e=>{ if(drag) return; const g=cur(); const c = e.target.closest && e.target.closest('circle.tp'); const b = el._tipbox;
      if(!c || !g || !g.tip){ b.style.display='none'; return; } const row = g.track[+c.dataset.i]; if(!row){ b.style.display='none'; return; }
      b.innerHTML = g.tip(row); b.style.display='block'; const r = el.getBoundingClientRect(); let x = e.clientX - r.left + 14, y = e.clientY - r.top + 14; if(x + 260 > r.width) x = e.clientX - r.left - 270; if(y + 180 > r.height) y = Math.max(0, e.clientY - r.top - 190); b.style.left = x+'px'; b.style.top = y+'px'; });
    el.addEventListener('pointerleave', ()=>{ if(el._tipbox) el._tipbox.style.display='none'; });
  }
  if(el._tipbox && !el.contains(el._tipbox)) el.appendChild(el._tipbox);
  el._globeId = id;
};
UI._globeSet = function(id, patch){ const st=UI._globes[id]; if(!st) return; Object.assign(st, patch); UI.mountGlobe(st.el, st); };


/* =====================================================================
   Play + timeline: step the selected date forward so every component that
   reads it (map, charts, tabs, fleet list) moves day by day.
   UI.player({playing, speed, scope, scopes, onToggle, onStep, onSpeed, onScope, label})
   UI.timeline({dates:[{x, analysed, tier}], selected, future, w, h}) + UI.mountTimeline(el, spec)
   The timeline keeps a grey zone on the right (future, default 1/3 of the span) as the
   provision for projections; nothing is drawn there yet by design.
   ===================================================================== */
UI.player = function({playing=false, speed=1, scope='', scopes=[], onToggle='', onStep='', onSpeed='', onScope='', label='', extra=''}={}){
  const sp = [1,2,4]; const h = (name, args) => name ? ` onclick="${name}(${args})"` : '';
  return `<div class="a-player">
    <button class="a-play${playing?' on':''}" data-act="toggle"${h(onToggle,'')} aria-label="${playing?'Pause':'Play'}" title="${playing?'Pause':'Play'} (space)">${playing?'❚❚':'▶'}</button>
    <button class="a-step" data-act="step" data-v="-1"${h(onStep,'-1')} title="Previous">‹</button><button class="a-step" data-act="step" data-v="1"${h(onStep,'1')} title="Next">›</button>
    <div class="a-period small">${sp.map(x=>`<button class="${x===speed?'on':''}" data-act="speed" data-v="${x}"${h(onSpeed,x)}>${x}×</button>`).join('')}</div>
    ${scopes.length>1?`<div class="a-period small scope">${scopes.map(o=>`<button class="${o.key===scope?'on':''}" data-act="scope" data-v="${o.key}"${h(onScope,`'${o.key}'`)} title="what play and the arrows step through">${esc(o.label)}</button>`).join('')}</div>`:''}
    ${extra}${label?`<span class="a-player-lbl">${esc(label)}</span>`:''}
  </div>`;
};
UI.timeline = function({dates=[], selected, future=0.33, w=1100, h=56, span:fixed=null, empty='no data yet'}={}){
  const padL=6, padR=6, iw=w-padL-padR; const T = x => new Date(x+'T00:00:00Z').getTime();
  /* span: [from, to] fixes the x-domain so every timeline (fleet, each vessel) lines up; dates outside stay grey */
  const t0 = fixed ? T(fixed[0]) : (dates.length ? T(dates[0].x) : Date.now()-86400000*365), tl = fixed ? T(fixed[1]) : (dates.length ? T(dates[dates.length-1].x) : Date.now());
  const dspan=(tl-t0)||86400000*30; const t1 = tl + dspan*future; const span=t1-t0;
  const X = x => padL + (T(x)-t0)/span*iw; const xl = padL + (tl-t0)/span*iw;
  const yMid = h/2 - 4;
  let s = `<line x1="${padL}" x2="${padL+iw}" y1="${yMid}" y2="${yMid}" stroke="#D2D2D7" stroke-width="2"/>`;
  /* year ticks, so a long span is readable at a glance */
  { const y0 = new Date(t0).getUTCFullYear(), y1 = new Date(tl).getUTCFullYear();
    const every = (y1-y0) > 8 ? 2 : 1;
    for(let y=y0+1; y<=y1; y++){ if((y-y0)%every) continue; const xt = padL + (Date.UTC(y,0,1)-t0)/span*iw; if(xt<padL||xt>padL+iw) continue;
      s += `<line x1="${xt.toFixed(1)}" x2="${xt.toFixed(1)}" y1="${yMid-9}" y2="${yMid+9}" stroke="#E5E5EA" stroke-width="1"/><text x="${xt.toFixed(1)}" y="${h-3}" text-anchor="middle" font-size="9.5" fill="#C7C7CC" font-family="-apple-system">${y}</text>`; } }
  /* data coverage: a tinted band from the first to the last date with data; the grey line outside it means 'no data' */
  if(dates.length){ const a=X(dates[0].x), b=X(dates[dates.length-1].x); s += `<rect x="${a.toFixed(1)}" y="${yMid-8}" width="${Math.max(3,b-a).toFixed(1)}" height="16" rx="8" fill="#0071E3" opacity=".08"/>`; }
  else s += `<text x="${(padL+xl)/2}" y="${h/2-8}" text-anchor="middle" font-size="10" fill="#AEAEB2" font-family="-apple-system">${esc(empty)}</text>`;
  s += `<rect x="${xl.toFixed(1)}" y="4" width="${(padL+iw-xl).toFixed(1)}" height="${h-16}" rx="4" fill="#8E8E93" opacity=".07"/><text x="${((xl+padL+iw)/2).toFixed(1)}" y="${yMid-10}" text-anchor="middle" font-size="10" fill="#AEAEB2" font-family="-apple-system">next · provision</text>`;
  const step = dates.length>400 ? Math.ceil(dates.length/400) : 1;
  dates.forEach((d,i)=>{ if(!d.analysed && i%step) return; const x=X(d.x).toFixed(1); s += d.analysed ? `<circle cx="${x}" cy="${yMid}" r="4" fill="${colorForTier(d.tier)}"/>` : `<line x1="${x}" x2="${x}" y1="${yMid-5}" y2="${yMid+5}" stroke="#C7C7CC" stroke-width="1.25"/>`; });
  const sel = dates.find(d=>d.x===selected); if(sel){ const x=X(sel.x).toFixed(1); s += `<line x1="${x}" x2="${x}" y1="${yMid-16}" y2="${yMid+16}" stroke="#1D3C67" stroke-width="1.5"/><circle cx="${x}" cy="${yMid}" r="7" fill="#1D3C67" stroke="#fff" stroke-width="2.5"/>`; }
  const iso = t => new Date(t).toISOString().slice(0,10);
  s += `<text x="${padL}" y="12" font-size="10.5" fill="#AEAEB2" font-family="-apple-system">${esc(fmtDate(iso(t0)))}</text><text x="${xl.toFixed(1)}" y="12" text-anchor="end" font-size="10.5" fill="#AEAEB2" font-family="-apple-system">${esc(fmtDate(iso(tl)))}</text>`;
  return `<svg class="a-timeline" viewBox="0 0 ${w} ${h}" data-t0="${t0}" data-t1="${t1}" data-padl="${padL}" data-iw="${iw}" data-w="${w}">${s}</svg>`;
};
/* click or drag on the timeline → spec.onchange(iso of the nearest date) */
UI.mountTimeline = function(el, spec){
  if(!el) return; el.innerHTML = UI.timeline(spec); el._tl = spec;
  if(el._tlWired) return; el._tlWired = true; el.style.touchAction='none'; el.style.cursor='pointer';
  let down=false;
  const pick = e => { const svg = el.querySelector('svg'); if(!svg) return; const r=svg.getBoundingClientRect(); const px = (e.clientX-r.left)/r.width*(+svg.dataset.w); const t = +svg.dataset.t0 + (px-(+svg.dataset.padl))/(+svg.dataset.iw)*((+svg.dataset.t1)-(+svg.dataset.t0));
    const ds = el._tl.dates; if(!ds.length) return; let best=ds[0], bd=Infinity; ds.forEach(d=>{ const dd=Math.abs(new Date(d.x+'T00:00:00Z').getTime()-t); if(dd<bd){ bd=dd; best=d; } }); if(best && best.x!==el._tl.selected && el._tl.onchange) el._tl.onchange(best.x); };
  el.addEventListener('pointerdown', e=>{ down=true; try{ el.setPointerCapture(e.pointerId); }catch(_){} pick(e); e.preventDefault(); });
  el.addEventListener('pointermove', e=>{ if(down) pick(e); });
  const up = ()=>{ down=false; }; el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
};


/* =====================================================================
   Looks: data-look on <html>. UI.look.set('float') · UI.look.get() · UI.lookSwitch({active, onclick})
   Read once at load: ?look= in the URL, else localStorage, else 'float'. CSS only — see the LOOKS block in components.css.
   ===================================================================== */
UI.LOOKS = [{key:'lined', label:'Lined'},{key:'float', label:'Float'},{key:'glass', label:'Glass'}];
UI.look = {
  get(){ return document.documentElement.dataset.look || 'float'; },
  set(k){ if(!UI.LOOKS.some(l=>l.key===k)) k='float'; document.documentElement.dataset.look = k; try{ localStorage.setItem('ui.look', k); }catch(_){} document.querySelectorAll('.a-look').forEach(el=>{ el.innerHTML = UI.lookSwitch({active:k}).replace(/^<span class="a-look">|<\/span>$/g,''); }); },
  init(){ let k = null; try{ k = new URLSearchParams(location.search).get('look') || localStorage.getItem('ui.look'); }catch(_){} document.documentElement.dataset.look = (k && UI.LOOKS.some(l=>l.key===k)) ? k : 'float'; }
};
UI.lookSwitch = function({active, onclick='UI.look.set'}={}){ active = active || UI.look.get(); return `<span class="a-look">${UI.period({options:UI.LOOKS, active, onclick})}</span>`; };
UI.look.init();


/* =====================================================================
   DateModel — the one selected date, shared by every date control (item 14, 23-Sep-2026).
     const m = new UI.DateModel({dates:[{x, analysed, tier}], selected, span, scopes:[{key,label,dates,interval}], scope, speed})
     m.on('change', fn)        fn(m) after selected / playing / speed / scope changed
     m.set({selected})         no-op when nothing changes; play(), pause(), toggle(), step(±1), setSpeed(x), setScope(k)
   Mounts (each independent, put them anywhere, as many as you like):
     UI.mountPlayer(el, m, {label, extra})   UI.mountTimeline(el, m, {w, h, future})   UI.mountDateStrip(el, m, {onMore, limit})
     UI.mountDateBar(el, m, opts)            = player + timeline in one row (the default layout)
   The app only listens: m.on('change', m => setCheckDate(m.selected)).
   ===================================================================== */
UI.DateModel = class {
  constructor(spec={}){ Object.assign(this, {dates:[], selected:null, span:null, scopes:[], scope:null, speed:1, playing:false, _timer:null, _subs:[], _mounts:[]}, spec); if(!this.scope && this.scopes.length) this.scope = this.scopes[0].key; }
  on(evt, fn){ this._subs.push({evt, fn}); return this; }
  emit(evt){ this._subs.filter(s=>s.evt===evt).forEach(s=>s.fn(this)); this._mounts.forEach(r=>r()); }
  set(patch={}){ let changed=false; for(const k of Object.keys(patch)){ if(this[k]!==patch[k]){ this[k]=patch[k]; changed=true; } } if(changed) this.emit('change'); return changed; }
  list(){ const sc = this.scopes.find(s=>s.key===this.scope); return sc && sc.dates ? sc.dates : this.dates.map(d=>d.x); }
  interval(){ const sc = this.scopes.find(s=>s.key===this.scope); return ((sc && sc.interval) || 1000) / this.speed; }
  next(dir){ const L = this.list(), cur = this.selected; if(!L.length) return null; let i = L.findIndex(x=>x>=cur); if(i<0) i = L.length-1; if(dir>0){ if(L[i]===cur) i++; } else i--; return L[i] || null; }
  step(dir){ const nx = this.next(dir); if(nx) this.set({selected:nx}); }
  play(){ if(this.playing) return; const L = this.list(); if(L.length<2) return; this.pause(); this.playing = true; if(this.selected >= L[L.length-1]) this.selected = L[0]; this.emit('change');
    const tick = () => { if(!this.playing) return; const nx = this.next(1); if(!nx){ this.pause(); return; } this.set({selected:nx}); this._timer = setTimeout(tick, this.interval()); };
    this._timer = setTimeout(tick, 60); }
  pause(){ if(this._timer){ clearTimeout(this._timer); this._timer=null; } if(this.playing){ this.playing=false; this.emit('change'); } }
  toggle(){ this.playing ? this.pause() : this.play(); }
  setSpeed(x){ this.set({speed:+x}); }
  setScope(k){ this.set({scope:k}); }
  setSelected(x){ this.set({selected:x}); }
};
UI._mount = function(el, model, render){ if(!el) return; if(el._dm && el._dm.model===model){ el._dm.render(); return; } const r = () => { if(!el.isConnected){ model._mounts = model._mounts.filter(x=>x!==r); return; } render(); }; el._dm = {model, render:r}; model._mounts.push(r); r(); };
UI.mountPlayer = function(el, model, {label='', extra=''}={}){
  UI._mount(el, model, () => { el.innerHTML = UI.player({playing:model.playing, speed:model.speed, scope:model.scope,
    scopes: model.scopes.length>1 ? model.scopes.map(s=>({key:s.key, label:`${s.label}${s.dates&&s.dates.length?` ${s.dates.length.toLocaleString()}`:''}`})) : [],
    label: typeof label==='function' ? label(model) : label, extra}); });
  if(!el._wired){ el._wired = true; el.addEventListener('click', e=>{ const b = e.target.closest('[data-act]'); if(!b || !el._dm) return; const m = el._dm.model; const v = b.dataset.v; if(b.dataset.act==='toggle') m.toggle(); else if(b.dataset.act==='step') m.step(+v); else if(b.dataset.act==='speed') m.setSpeed(+v); else if(b.dataset.act==='scope') m.setScope(v); }); }
};
UI.mountTimeline = function(el, spec){
  /* two call shapes: (el, DateModel, opts) — bound; (el, {dates, selected, onchange, …}) — the original one-shot */
  if(spec instanceof UI.DateModel){ const m = spec, opts = arguments[2] || {}; UI._mount(el, m, () => UI._mountTimelineOnce(el, Object.assign({dates:m.dates, selected:m.selected, span:m.span, onchange:x=>m.setSelected(x)}, opts))); return; }
  UI._mountTimelineOnce(el, spec);
};
UI._mountTimelineOnce = function(el, spec){
  if(!el) return; el.innerHTML = UI.timeline(spec); el._tl = spec;
  if(el._tlWired) return; el._tlWired = true; el.style.touchAction='none'; el.style.cursor='pointer';
  let down=false;
  const pick = e => { const svg = el.querySelector('svg'); if(!svg) return; const r=svg.getBoundingClientRect(); const px = (e.clientX-r.left)/r.width*(+svg.dataset.w); const t = +svg.dataset.t0 + (px-(+svg.dataset.padl))/(+svg.dataset.iw)*((+svg.dataset.t1)-(+svg.dataset.t0));
    const ds = el._tl.dates; if(!ds.length) return; let best=ds[0], bd=Infinity; ds.forEach(d=>{ const dd=Math.abs(new Date(d.x+'T00:00:00Z').getTime()-t); if(dd<bd){ bd=dd; best=d; } }); if(best && best.x!==el._tl.selected && el._tl.onchange) el._tl.onchange(best.x); };
  el.addEventListener('pointerdown', e=>{ down=true; try{ el.setPointerCapture(e.pointerId); }catch(_){} pick(e); e.preventDefault(); });
  el.addEventListener('pointermove', e=>{ if(down){ pick(e); return; } UI._tlHover(el, e); });
  el.addEventListener('pointerleave', ()=>{ const t=el.querySelector('.a-tl-hov'); if(t) t.style.display='none'; });
  const up = ()=>{ down=false; }; el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
};
/* a small readout that follows the pointer: the nearest check's date and whether it is analysed */
UI._tlHover = function(el, e){
  const svg = el.querySelector('svg'); const ds = el._tl && el._tl.dates; if(!svg || !ds || !ds.length) return;
  let tip = el.querySelector('.a-tl-hov');
  if(!tip){ tip = document.createElement('span'); tip.className = 'a-tl-hov'; el.style.position = el.style.position || 'relative'; el.appendChild(tip); }
  const r = svg.getBoundingClientRect(); const px = (e.clientX-r.left)/r.width*(+svg.dataset.w);
  const t = +svg.dataset.t0 + (px-(+svg.dataset.padl))/(+svg.dataset.iw)*((+svg.dataset.t1)-(+svg.dataset.t0));
  let best=ds[0], bd=Infinity; ds.forEach(d=>{ const dd=Math.abs(new Date(d.x+'T00:00:00Z').getTime()-t); if(dd<bd){ bd=dd; best=d; } });
  if(bd > 20*86400000){ tip.style.display='none'; return; }
  tip.innerHTML = `<b>${esc(fmtDate(best.x))}</b>${best.analysed?`<i style="background:${colorForTier(best.tier)}"></i>analysed`:'<span>readings only</span>'}`;
  tip.style.display='block'; tip.style.left = Math.max(0, Math.min(r.width-120, e.clientX-r.left-60)) + 'px';
};
UI.mountDateStrip = function(el, model, {onMore='', limit=60}={}){
  UI._mount(el, model, () => { el.innerHTML = UI.dateStrip({dates:model.dates, selected:model.selected, onclick:'', onMore, limit}); el.querySelectorAll('.dp').forEach(b=>{ b.removeAttribute('onclick'); }); const track = el.querySelector('#datesTrack'), sel = el.querySelector('.dp.sel'); if(track && sel) track.scrollLeft = sel.offsetLeft - track.clientWidth/2 + 22; });
  if(!el._wired){ el._wired = true; el.addEventListener('click', e=>{ const b = e.target.closest('.dp'); if(!b || !el._dm) return; const m = /title="([0-9]{2} \w{3} [0-9]{4})/.exec(b.outerHTML); const x = b.dataset.x || (el._dm.model.dates.find(d=>fmtDate(d.x)===(m&&m[1]))||{}).x; if(x) el._dm.model.setSelected(x); }); }
};
/* the date selector: the selected date as a button (opens the strip + calendar the app provides via onMore), with the
   counts underneath. Its own mount, its own block — separate from the player and the timeline. */
UI.dateSelector = function({selected, dates=[], onMore='', open=false}={}){
  const n = dates.length, an = dates.filter(d=>d.analysed).length; const cur = dates.find(d=>d.x===selected);
  return `<button class="a-dsel${open?' open':''}"${onMore?` onclick="${onMore}"`:''} title="Pick a date"><span class="a-dsel-ic">☷</span><span class="a-dsel-d">${selected?esc(fmtDate(selected)):'—'}</span>${onMore?'<span class="a-dsel-c">▾</span>':''}</button>
    <span class="a-dsel-n">${cur && cur.analysed ? `<span class="dot" style="background:${colorForTier(cur.tier)};width:7px;height:7px"></span> analysed · ` : (cur ? 'readings only · ' : '')}${n.toLocaleString()} checks · ${an} analysed</span>`;
};
UI.mountDateSelector = function(el, model, {onMore='', open=()=>false}={}){
  UI._mount(el, model, () => { el.innerHTML = UI.dateSelector({selected:model.selected, dates:model.dates, onMore, open: typeof open==='function' ? open() : !!open}); });
};
UI.mountDateBar = function(el, model, {label='', extra='', w=1100, h=56, onMore='', selector=true, open}={}){
  if(!el) return;
  if(!el.querySelector('.a-datebar') || !el.querySelector('.a-db-top')){
    /* rebuilding into the two-row layout must keep any ids the page put on the parts */
    const keep = sel => { const n = el.querySelector(sel); return n && n.id ? ` id="${n.id}"` : ''; };
    const dsId = keep('.a-ds'), plId = keep('.a-pl'), tlId = keep('.a-tl');
    el.innerHTML = `<div class="a-datebar"><div class="a-db-top">${selector?`<div class="a-ds"${dsId}></div>`:''}<div class="a-pl"${plId}></div></div><div class="a-tl"${tlId}></div></div>`;
  }
  const bar = el.querySelector('.a-datebar'); const top = bar.querySelector('.a-db-top') || bar;
  if(selector && !bar.querySelector('.a-ds')){ const d = document.createElement('div'); d.className='a-ds'; top.insertBefore(d, top.firstChild); }
  if(selector) UI.mountDateSelector(bar.querySelector('.a-ds'), model, {onMore, open});
  UI.mountPlayer(el.querySelector('.a-pl'), model, {label, extra}); UI.mountTimeline(el.querySelector('.a-tl'), model, {w, h});
};


/* =====================================================================
   Reading row — one tag on one check (checklist rows, the Systems tag list). 23-Sep-2026.
   UI.readingRow({id, name, time, system, value, num, unit, band:{lo,hi}, expected, oor, cited, spark:[{x,v}] | states:n,
                  onclick, highlight})
   Shows the reading the way the DB judged it: the value bold with its unit; underneath, the band it was judged
   against ("band 37,170–48,724") or the expected state ("expected Auto") — or "no band" when neither exists;
   a 90-day sparkline on the right; OUT OF RANGE / CITED badges. "-" (not read) renders as an em dash.
   ===================================================================== */
/* UMS-critical shield — inline SVG so it renders on every host (the ⛨ glyph does not) */
UI.shield = (color='currentColor', size=12) => `<svg class="a-shield" width="${size}" height="${size}" viewBox="0 0 12 12" aria-label="UMS-critical"><path d="M6 .8 1.6 2.4v3.2c0 2.6 1.9 4.6 4.4 5.6 2.5-1 4.4-3 4.4-5.6V2.4Z" fill="${color}"/><path d="M4 6.1l1.4 1.4L8.2 4.7" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
UI.fmtRead = function(value, num, unit){
  if(value==null || value==='' || value==='-') return {v:'—', u:''};
  /* a unit is a unit when it is a known symbol or is not a plain word; a plain word next to a number ("On", "Auto") is an expected state, not a unit; a bare number is no unit at all */
  const isUnit = u => !!u && !/^\d+(\.\d+)?$/.test(u) && (/^(kn|kW|kPa|MPa|bar|hrs?|rpm|℃|°C|%|mm|m|t\/day|g\/PSh|V|A|Hz|\/10|notch|KPS|kg|l|L|ppm|sec|min|deg|°|mbar|psi|ton|t|nm|m3|m³|mA|mV|kgf\/cm2|kgf\/cm²)$/i.test(u) || !/^[A-Za-z]+$/.test(u));
  if(num!=null && Number.isFinite(num)) return {v: UI.fmtNum(num), u: isUnit(unit) ? unit : ''};
  return {v: String(value), u: ''};
};
UI.readingRow = function({id='', idx=null, name='', time='', system='', equipment='', value='', num=null, unit='', band=null, bandName='', stateBands=null, expected='', states=[], review=false, prev=null, oor=false, judged=true, cited=false, spark=[], statesN=0, onclick='', highlight=false, loading=false, critical=false}={}){
  /* one tag on one check, laid out like MTI's cleanup viewer: #, TAG under the name, VALUE + unit, PREVIOUS with a
     "changed" pill, the RANGE it was judged against with its name (acceptable / expected / run·stop / reading), the
     STATES chips (expected bold, seen-counts on hover, amber = not yet reviewed), SYSTEM › EQUIPMENT, READ AT. */
  const r = UI.fmtRead(value, num, unit);
  if(num!=null && Number.isFinite(num)){ expected = expected || ((!r.u && unit && /^[A-Za-z][A-Za-z /-]*$/.test(unit)) ? unit : ''); if(r.u) expected = ''; }
  if(band){ const lo = band.lo!=null && band.lo!=='' ? +band.lo : null, hi = band.hi!=null && band.hi!=='' ? +band.hi : null; band = (Number.isFinite(lo) && Number.isFinite(hi)) ? {lo, hi} : null; }
  const isState = num==null && value!=null && value!=='' && value!=='-';
  const notRead = value==null || value==='' || value==='-';
  let under = '';
  if(stateBands && (stateBands.running || stateBands.stopped)){ const f = b => b ? `${UI.fmtNum(b.min)}–${UI.fmtNum(b.max)}` : '—'; under = `run ${f(stateBands.running)} · stop ${f(stateBands.stopped)}${r.u?' '+esc(r.u):''}`; }
  else if(band) under = `${esc(bandName||'band')} ${UI.fmtNum(band.lo)}–${UI.fmtNum(band.hi)}${r.u?' '+esc(r.u):''}`;
  else if(expected) under = `expected ${esc(expected)}`;
  else if(isState && !states.length) under = (unit && unit!==value) ? `states ${esc(unit)}` : '';
  else if(!notRead && !states.length) under = 'no band';
  if(review && !notRead) under = (under ? under + ' · ' : '') + `<span class="a-rr-tbc">not yet reviewed</span>`;
  const color = oor ? '#E30019' : cited ? '#B85D00' : '#0071E3';
  const viz = loading ? `<span class="a-rr-none">…</span>` : spark.length>1 ? sparkSvg(spark.map(q=>({health:q.v})), 64, 22, color) : statesN>0 ? `<span class="a-rr-none">state ×${statesN}</span>` : `<span class="a-rr-none">—</span>`;
  const norm = x => String(x==null?'':x).trim().toLowerCase().replace(/[.\s\-_/]+/g,'');
  const nv = parseFloat(value), np = prev ? parseFloat(prev.v) : NaN;
  const changed = prev && prev.v!=null && prev.v!=='' && !(notRead && (prev.v==='-'||prev.v==='')) && ((Number.isFinite(nv) && Number.isFinite(np) && /^[-+]?\d/.test(String(value)) && /^[-+]?\d/.test(String(prev.v))) ? nv!==np : norm(prev.v)!==norm(value));
  const prevHtml = prev && prev.v!=null ? `<span class="a-rr-prev" title="previous walkaround${prev.d?' · '+esc(fmtDate(prev.d)):''}">prev ${esc(prev.v==='-'?'—':prev.v)}${changed?`<i class="a-rr-chg">changed</i>`:''}</span>` : '';
  const chips = states.length ? `<span class="a-rr-states">${states.map(st=>`<span class="a-rr-st${st.expected?' exp':''}${st.review==='TBD'?' tbd':''}${st.review==='abnormal'?' abn':''}${norm(st.s)===norm(value)?' cur':''}" title="${esc(st.s)} · ${st.review==='normal'?'normal':st.review==='abnormal'?'abnormal':'not yet reviewed'}${st.seen!=null?` · seen ${st.seen.toLocaleString()}${st.pct!=null?' ('+st.pct+'%)':''}`:''}${st.undeclared?' · not in the declared set':''}">${esc(st.s)}</span>`).join('')}</span>` : '';
  return `<div class="crow a-rr${highlight?' hl':''}${critical?' crit':''}"${onclick?` onclick="${onclick}"`:''}>
    ${idx!=null?`<span class="a-rr-idx">${idx}</span>`:''}<span class="cdot" style="background:${oor?'#E30019':cited?'#FE9413':(judged?'#D2D2D7':'#EDEDF0')}"></span>
    <div class="a-rr-name"><b>${critical?`<span class="a-rr-shield" title="UMS-critical">${UI.shield('#1D3C67')}</span> `:''}${esc(name)}</b><span class="a-rr-meta">${id?`<code>${esc(id)}</code> · `:''}${esc(time)}${time&&(system||equipment)?' · ':''}${esc(system)}${equipment?' › '+esc(equipment):''}</span></div>
    <div class="a-rr-viz">${viz}</div>
    <div class="a-rr-val"><span class="a-rr-vrow"><b class="${oor?'oor':''}">${esc(r.v)}${r.u?`<em>${esc(r.u)}</em>`:''}</b>${prevHtml}</span><span class="a-rr-under">${under}</span>${chips}</div>
    <div class="a-rr-badges">${oor?`<span class="oor">OUT OF RANGE</span>`:''}${cited?`<span class="cited">CITED</span>`:''}</div>
    ${onclick?`<span class="chev">›</span>`:'<span style="width:10px"></span>'}
  </div>`;
};
/* the RANGE chain of the cleanup viewer, from a tag_thresholds row (parsed) + the reading's own band:
   acceptable_min/max → expected_min/max → state_bands (context-split) → check_readable.min_val/max_val */
UI.rangeChain = function(th, mn, mx){
  if(th){
    if(th.amin!=null && th.amax!=null) return {band:{lo:th.amin, hi:th.amax}, bandName:'acceptable'};
    if(th.emin!=null && th.emax!=null) return {band:{lo:th.emin, hi:th.emax}, bandName:'expected'};
    if(th.bands && (th.bands.running || th.bands.stopped)) return {stateBands: th.bands};
  }
  if(mn!=null && mx!=null) return {band:{lo:mn, hi:mx}, bandName:'reading band'};
  return {};
};

/* =====================================================================
   UMS verdict card — UI.verdictCard (24-Sep-2026, chain Phase 6.3)
   Renders the object UMS.evaluate() returns (ums.js): the verdict pill + risk ring + valid-until on top, then one
   disclosure row per Skill-2 cluster (its decision question, status, n of m met), inside it every criterion as a
   line (✓ / ✗ / ? + what it required + weight + HARD STOP) and, for the ones not met, the reading row(s) exactly
   as on the Checklist (rowFor(tagId, member) → html — the app/reference supply it so PREVIOUS/RANGE/STATES come
   from the same place). Then the conditions to confirm and the C/E confirm box (disabled until the task loop).
   Pure: no state; clusters that are not GO come open (native <details>).
   ===================================================================== */
UI.riskRing = function(risk, color, size=64){
  const r = (size/2)-5, c = 2*Math.PI*r, k = Math.max(0, Math.min(100, +risk||0))/100;
  return `<svg class="a-vd-ringsvg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="var(--base-2, #E5E5EA)" stroke-width="6"/><circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${(c*k).toFixed(1)} ${(c*(1-k)).toFixed(1)}" transform="rotate(-90 ${size/2} ${size/2})"/><text x="50%" y="50%" dy=".36em" text-anchor="middle" font-size="${size*0.32}" font-weight="700" fill="${color}">${Math.round(+risk||0)}</text></svg>`;
};
UI._vdStatus = s => s==='pass' ? {g:'✓', cls:'ok', t:'met'} : s==='fail' ? {g:'✕', cls:'fail', t:'not met'} : s==='review' ? {g:'?', cls:'review', t:'not yet reviewed'} : s==='unjudged' ? {g:'?', cls:'review', t:'cannot judge'} : s==='notread' ? {g:'–', cls:'none', t:'not read'} : {g:'·', cls:'none', t:s};
UI._vdReq = c => {
  const q = c.required || {}; const n = (c.tag_ids||[]).length;
  const num = v => v==null ? '…' : UI.fmtNum(v);
  const what = q.read_pct!=null ? `≥ ${q.read_pct} % of ${n} tags read`
    : q.hours_of_burn!=null ? `enough for ${q.hours_of_burn} h at today's burn${q.margin&&q.margin!==1?` × ${q.margin} margin`:''} (from the noon report)`
    : q.one_running_one_standby ? `of the ${n}: one running, one on standby`
    : q.state ? `${c.kind==='group'?`at least ${q.min_count||n} of ${n} read `:'must read '}${q.state}`
    : (q.min!=null && q.max!=null) ? `within ${num(q.min)}–${num(q.max)}`
    : q.min!=null ? `at least ${num(q.min)}${c.kind==='group'?` on all ${n}`:''}`
    : q.max!=null ? `at most ${num(q.max)}`
    : q.read ? 'was read'
    : c.kind==='group' ? `all ${n}${q.min_count&&q.min_count<n?` (at least ${q.min_count})`:''} within their thresholds` : 'within its threshold';
  return [what, c.condition && c.condition!=='any' ? c.condition.toLowerCase() : '', c.weight ? `weight ${c.weight}` : ''].filter(Boolean).join(' · ');
};
UI.verdictCard = function({v, title='UMS readiness', dateLabel='', timeLabel='', source='', rowFor=null, analysisFor=null, onOther=null, reviewFor=null, onTag='', showConfirm=true, noteStatus='', foot='', id='umsVerdict', note='', healthRows=null}={}){
  if(!v) return `<div class="a-card a-verdict${note?' empty':''}" id="${id}"><div class="a-head"><div class="t"><span class="a-ic" style="background:#8E8E9322">${UI.shield('#8E8E93', 13)}</span>${esc(title)}${source?UI.info(source):''}</div>${dateLabel?`<div class="d">${esc(dateLabel)}</div>`:''}</div><p class="a-vd-p" style="margin:8px 0 0;font-size:13.5px;color:var(--ink-2)">${esc(note || 'Computing the verdict for the selected date…')}</p></div>`;
  const col = v.color, tone = v.tone;
  const until = v.horizon_until ? new Date(v.horizon_until) : null;
  const untilTxt = until ? `valid until ${String(until.getUTCHours()).padStart(2,'0')}:${String(until.getUTCMinutes()).padStart(2,'0')} UTC${v.expired?' · expired — shown as at the walkaround':''}` : 'walkaround times not loaded — horizon unknown';
  const cov = v.coverage ? `${v.coverage.met} of ${v.coverage.need} critical tags read` : '';
  const stats = [`${v.criteria_total} criteria`, `${v.criteria_total - v.criteria_failed} met`, v.criteria_failed ? `${v.criteria_failed} to confirm` : '', v.hard_stops ? `${v.hard_stops} hard stop${v.hard_stops>1?'s':''}` : 'no hard stop', cov].filter(Boolean);
  const named = v.clusters.filter(c=>c.total>0), unnamed = v.clusters.filter(c=>!c.total);
  const clusterHtml = named.map(c => {
    const st = c.status, sc = UMS.VERDICTS[st] ? UMS.VERDICTS[st].color : '#8E8E93';
    const critHtml = cr => {
      const s = UI._vdStatus(cr.status);
      const m0 = cr.members[0]; const inline = cr.members.length===1 ? (m0.status==='notread' ? 'not read' : `reads <b>${esc(m0.value||'—')}</b>${m0.expected?` · expected ${esc(m0.expected)}`:(m0.status==='unjudged'||m0.status==='review')&&m0.why?` · ${esc(m0.why)}`:''}`) : `${cr.met} of ${cr.members.length} ok`;
      const openRows = cr.status!=='pass';
      const rows = rowFor ? `<div class="a-vd-rows${openRows?'':' hidden'}">${cr.members.map(m=>rowFor(m.tag, m, cr)).join('')}</div>` : '';
      const act = cr.status!=='pass' && cr.action ? `<div class="a-vd-action"><b>Do</b> ${esc(cr.action)}</div>` : '';
      const rv = cr.status!=='pass' ? (reviewFor ? reviewFor(cr) : null) : undefined;
      const review = cr.status!=='pass' ? (rv ? `<div class="a-vd-review done"><b>Confirmed</b> by ${esc(rv.by||'—')}${rv.at?` · ${esc(rv.at)}`:''} · <b>${esc(rv.decision||'')}</b>${rv.note?` — ${esc(rv.note)}`:''}</div>` : `<div class="a-vd-review"><b>Admin confirmation</b> · not yet confirmed by a person · the Chief's or the office's decision lands here (daily task, chain Phase 5)</div>`) : '';
      return `<div class="a-vd-crit ${s.cls}${cr.status==='fail' && (cr.tier==='hard'||cr.hard_stop)?' blocked':''}"><div class="a-vd-ch${openRows?' open':''}" onclick="UI._vdToggle(this)" title="show the reading${cr.members.length>1?'s':''} — each row opens the tag"><span class="a-vd-mark ${s.cls}" title="${esc(s.t)}">${s.g}</span><div class="a-vd-ct"><b>${esc(cr.criterion)}</b><span class="a-vd-req">${esc(UI._vdReq(cr))}${cr.hard_stop?' · <i class="a-vd-hard">hard stop</i>':''}${cr.source && /confirm/i.test(cr.source)?' · <i class="a-vd-tbc">admin confirmation</i>':''}${cr.limit_source?` · <i class="a-vd-tbc" title="${esc(cr.limit_source)}">limit needed</i>`:''}</span></div><span class="a-vd-inl">${inline}</span><span class="a-vd-open">›</span></div>${rows}${act}${review}</div>`;
    };
    const hard = c.hard || c.criteria.filter(x=>x.hard_stop), cond = c.cond || c.criteria.filter(x=>!x.hard_stop);
    const grp = (lbl, list, cls) => list.length ? `<div class="a-vd-tier ${cls}"><div class="a-vd-tierh">${lbl} <span>${list.filter(x=>x.status==='pass').length} of ${list.length} met</span></div>${list.map(critHtml).join('')}</div>` : '';
    const blocked = hard.filter(x=>x.status==='fail');
    const block = blocked.length ? `<div class="a-vd-blockband">${UI.shield('#fff', 14)} <b>BLOCKED</b> — ${blocked.map(x=>`${esc(x.criterion)}: ${x.members.filter(m=>m.status!=='pass').map(m=>`${esc(m.name.trim())} reads ${esc(m.value||'—')}${m.expected?` (must be ${esc(m.expected)})`:''}`).join('; ')}`).join(' · ')} — a failed hard stop alone makes NO-GO</div>` : '';
    const info = c.info;
    const other = `<div class="a-vd-other"><span class="a-vd-tierh" style="margin:0">Other readings</span><span>${info ? `${(info.n||0).toLocaleString()} in this system · <b class="${info.oor?'oor':''}">${info.oor||0} out of range</b>${info.notread?` · ${info.notread} not read`:''}` : 'counting…'} — judged one by one in the Systems tab, not UMS rules</span>${onOther?`<a class="a-link" onclick="${onOther(c.key)}">open in Systems</a>`:''}</div>`;
    const crit = block + grp('Hard stops — any one failed forbids UMS', hard, 'hard') + grp('Conditions & watch — confirm or watch during the watch', cond, 'cond') + other;
    const an = analysisFor ? analysisFor(c.key) : null;
    const anChip = an ? UI.scoreChip({score:an.score, status:an.status, onclick:an.onclick||'', label:'analysis', small:true}) : '';
    const why = `<div class="a-vd-logic"><div class="a-vd-must"><b>For this system to be left unmanned:</b> ${esc(c.must||'—')}.</div><div class="a-vd-why"><span class="a-vd-cnt">${hard.length} hard stop${hard.length===1?'':'s'} · ${cond.length} condition${cond.length===1?'':'s'} · ${c.info?`${(c.info.n||0).toLocaleString()} other readings`:'other readings'}</span><b>→ ${esc(st)}</b><span>because ${esc(c.why)}</span>${an?`<span>· the analyst's report on this system scored <b>${an.score!=null?an.score:'—'}</b> ${esc(an.status||'')}${an.onclick?` — <a class="a-link" onclick="${an.onclick}">read it</a>`:''}</span>`:''}</div></div>`;
    return `<details class="a-vd-cl${blocked.length?' blocked':''}" data-cluster="${c.key}"${c.open?' open':''}><summary><span class="a-vd-dot" style="background:${sc}"></span>${blocked.length?`<span class="a-vd-blockpill">${UI.shield('#fff', 11)} BLOCKED</span>`:''}<span class="a-vd-cll"><b>${esc(c.label)}</b><span class="a-vd-q">${esc(c.question)}</span></span>${anChip}<span class="a-vd-n">${c.met} of ${c.total} met</span><span class="a-vd-pill" style="color:${sc};background:${sc}14">${esc(st)}</span><span class="a-vd-chev">›</span></summary><div class="a-vd-body">${why}${crit}</div></details>`;
  }).join('');
  const conds = v.conditions.length ? `<div class="a-vd-conds"><div class="a-vd-h">Conditions to confirm before going UMS</div><ol>${v.conditions.map(c=>`<li${c.hard_stop?' class="hard"':''}>${esc(c.text)}${c.hard_stop?' <i class="a-vd-hard">hard stop</i>':''}</li>`).join('')}</ol></div>` : (v.verdict==='GO' ? `<div class="a-vd-conds"><div class="a-vd-h">Conditions</div><p class="a-vd-p">None — every UMS-critical criterion is met.</p></div>` : '');
  const confirm = showConfirm ? `<div class="a-vd-confirm"><div class="a-vd-h">Confirmation — Chief Engineer or admin</div><div class="a-vd-cf"><input type="text" placeholder="Name" disabled><input type="text" placeholder="Comment (why you agree or override)" disabled><button class="a-btn" disabled>Confirm ${esc(v.verdict)}</button></div><p class="a-vd-p">Arrives with the daily Living Office task (chain Phase 5): the confirmation is written to the task and to <code>ums_verdict.confirmed_*</code>, never computed here.</p></div>` : '';
  return `<div class="a-card a-verdict tone-${tone}" id="${id}" data-verdict="${esc(v.verdict)}" data-risk="${v.risk}">
    <div class="a-head"><div class="t"><span class="a-ic" style="background:${col}22;color:${col}">${UI.shield(col, 13)}</span>${esc(title)}${source?UI.info(source):''}</div><div class="d">${esc([dateLabel, v.condition && v.condition!=='any' ? v.condition : '', timeLabel].filter(Boolean).join(' · '))}</div></div>
    <div class="a-vd-hero">
      <div class="a-vd-main">
        <div class="a-vd-verdict" style="color:${col}"><span class="a-vd-bigdot" style="background:${col}"></span>${esc(v.verdict)}</div>
        <div class="a-vd-line">${esc(v.line)}</div>
        <div class="a-vd-sub">${esc(untilTxt)}${noteStatus?` · agent's UMS-readiness note: ${esc(noteStatus)}`:''}</div>
      </div>
      <div class="a-vd-ring">${UI.riskRing(v.risk, col)}<span class="a-vd-ringlbl">risk 0–100</span></div>
      <div class="a-vd-stats">${stats.map(s=>`<span>${esc(s)}</span>`).join('')}</div>
    </div>
    <div class="a-vd-clusters">${clusterHtml}${unnamed.length?`<p class="a-vd-none">No UMS rules for ${unnamed.map(c=>esc(c.label)).join(' · ')} yet — an admin adds them as rows, no release needed.</p>`:''}</div>
    ${conds}
    ${UI.explain({title:'How this verdict is computed', rows:[
      {k:'Verdict', v:`<b>${esc(v.verdict)}</b> — ${esc(v.why||'')}`},
      {k:'Risk', v:`${esc(String(v.weights.risk_points))} risk points ÷ ${v.weights.sum} total weight × 100 = <b>${v.risk}</b>`},
      {k:'Risk points', v:`Σ weight × severity over the ${v.weights.scored} applicable criteria · severity: not met 1 · threshold not yet reviewed ½ · cannot judge ½ · not read 0.3 · met 0 → ${v.counts.pass} met, ${v.counts.fail} not met, ${v.counts.review} to review, ${v.counts.unjudged} cannot judge, ${v.counts.notread} not read`},
      {k:'Rules', v:`NO-GO if any hard-stop criterion fails or risk > ${UMS.RULES.nogo_above} · GO only if nothing is left to confirm and risk < ${UMS.RULES.go_below} · otherwise GO WITH CONDITIONS · CANNOT JUDGE below ${v.coverage?v.coverage.required:90} % of critical tags read · NOT FILED when no checklist exists for the day`},
      {k:'Applicable', v:`criteria whose condition is <b>any</b> or <b>${esc(v.condition)}</b> (the noon report status on the check date) — ${v.criteria_total} of the rules apply today`},
      {k:'Horizon', v:v.horizon_until ? `walkaround end + ${UMS.RULES.horizon_h} h = ${esc(v.horizon_until.slice(11,16))} UTC` : 'walkaround times not loaded'},
      {k:'Where from', v:`each criterion names its tag(s); the reading, PREVIOUS, band and states come from check_readable + tag_thresholds — open any row to see the tag's history`}
    ]})}${confirm}
    <div class="a-foot">${esc(foot || `Rules ${v.rule_version} · weights and hard stops await admin confirmation · computed in the browser from this walkaround's readings and tag_thresholds; nothing is stored yet.`)}</div>
  </div>`;
};
/* verdict pill — the same colours as the card, for the fleet column, timeline hover and list rows */
UI.verdictPill = function(verdict, {small=false, risk=null}={}){
  const d = (typeof UMS!=='undefined' && UMS.VERDICTS[verdict]) || {color:'#8E8E93'};
  return `<span class="a-vpill${small?' small':''}" style="color:${d.color};background:${d.color}14"><i style="background:${d.color}"></i>${esc(verdict||'—')}${risk!=null?`<em>${Math.round(risk)}</em>`:''}</span>`;
};

/* =====================================================================
   Self-explaining numbers (24-Sep-2026, step 6.3b) — UI.explain, UI.scoreChip
   Every big number gets a "How is this computed" disclosure under it: the formula in words + the real inputs.
   ===================================================================== */
UI.explain = function({title='How is this computed', rows=[], text='', open=false, id=''}={}){
  return `<details class="a-explain"${open?' open':''}${id?` id="${id}"`:''}><summary><span class="a-explain-ic">?</span>${esc(title)}<span class="a-vd-chev">›</span></summary><div class="a-explain-b">${text?`<p>${text}</p>`:''}${rows.length?`<div class="a-explain-rows">${rows.map(r=>`<div class="a-explain-r"><b>${esc(r.k)}</b><span>${r.v}</span></div>`).join('')}</div>`:''}</div></details>`;
};
/* the Skill-2 analysis score of one cluster on one check: "82 SATISFACTORY ›" in the status colour */
UI.SCORE_COLORS = {GOOD:'#1DA100', SATISFACTORY:'#B85D00', POOR:'#E30019'};
UI.scoreChip = function({score=null, status='', onclick='', label='analysis', small=false}={}){
  const c = UI.SCORE_COLORS[status] || '#8E8E93';
  return `<span class="a-schip${small?' small':''}${onclick?' clickable':''}" style="color:${c};background:${c}14"${onclick?` onclick="event.stopPropagation();event.preventDefault();${onclick}"`:''}>${label?`<i>${esc(label)}</i>`:''}<b>${score!=null?score:'—'}</b>${status?`<em>${esc(status)}</em>`:''}${onclick?'<span class="a-schip-chev">›</span>':''}</span>`;
};
UI._vdToggle = function(el){ const rows = el.parentElement.querySelector('.a-vd-rows'); if(rows){ rows.classList.toggle('hidden'); el.classList.toggle('open', !rows.classList.contains('hidden')); } };

/* the tag_thresholds row of one tag, in one line — what MTI cleans by hand, shown at the last step of every drill-down (24-Sep-2026) */
UI.thresholdLine = function(th, {value=null, mn=null, mx=null, unit=''}={}){
  if(!th) return `<span class="a-th-none">No threshold row for this tag yet${mn!=null&&mx!=null?` · reading band ${UI.fmtNum(mn)}–${UI.fmtNum(mx)}${unit?' '+esc(unit):''}`:''}</span>`;
  const norm = x => String(x==null?'':x).trim().toLowerCase().replace(/[.\s\-_/]+/g,'');
  const parts = [];
  if(th.amin!=null && th.amax!=null) parts.push(`acceptable <b>${UI.fmtNum(th.amin)}–${UI.fmtNum(th.amax)}</b>${unit?' '+esc(unit):''}`);
  if(th.emin!=null && th.emax!=null) parts.push(`expected <b>${UI.fmtNum(th.emin)}–${UI.fmtNum(th.emax)}</b>`);
  if(th.bands && (th.bands.running||th.bands.stopped)){ const f=b=>b?`${UI.fmtNum(b.min)}–${UI.fmtNum(b.max)}`:'—'; parts.push(`running <b>${f(th.bands.running)}</b> · stopped <b>${f(th.bands.stopped)}</b>${th.ctx?` (by <code>${esc(th.ctx)}</code>)`:''}`); }
  if(th.exp) parts.push(`expected state <b>${esc(th.exp)}</b>`);
  if(th.standby) parts.push(`standby marker <code>${esc(th.standby)}</code>`);
  const chips = (th.states||[]).length ? `<span class="a-rr-states" style="justify-content:flex-start;margin:4px 0 0">${th.states.map(st=>`<span class="a-rr-st${th.exp && norm(st.s)===norm(th.exp)?' exp':''}${st.review==='TBD'?' tbd':''}${st.review==='abnormal'?' abn':''}${value!=null && norm(st.s)===norm(value)?' cur':''}" title="${esc(st.s)} · ${st.review==='normal'?'normal':st.review==='abnormal'?'abnormal':'not yet reviewed'}">${esc(st.s)}${st.pct!=null?` <i>${st.pct} %</i>`:''}</span>`).join('')}</span>` : '';
  const src = [th.source?esc(th.source):'', th.conf && th.conf!=='n/a' ? `${esc(th.conf)} confidence` : ''].filter(Boolean).join(' · ');
  return `<span class="a-th-k">Threshold</span> ${parts.length?parts.join(' · '):'<span class="a-th-none">no band, no expected state</span>'}${th.review?` · <span class="a-rr-tbc">not yet reviewed</span>`:''}${src?` <span class="a-th-src">${src}</span>`:''}${chips}`;
};

/* =====================================================================
   Analysis card — one cluster on one check: the analyst's question, score and narrative next to the UMS outcome
   for the same system (condition and permission side by side), the readings the analyst cited, the post-its. Used by
   the Analysis tab in the reference and the app (24-Sep-2026).
   ===================================================================== */
UI.analysisCard = function({key='', label='', question='', must='', score=null, status='', confidence='', lead='', evidence=[], postits=[], ums=null, onOpen='', onTag=null, source='', onOther=null}={}){
  const c = UI.SCORE_COLORS[status] || '#8E8E93';
  const chip = e => `<span class="chip small" style="display:inline-flex;margin:4px 6px 0 0"${onTag?` onclick="event.stopPropagation();${onTag(e.tag_id)}"`:''}>${esc(e.label||e.tag_id)} · ${esc(e.value||'')} ›</span>`;
  const u = ums;
  const umsHtml = u ? `<div class="a-an-ums"><div class="a-an-h">UMS outcome for this system</div><div class="a-an-umsrow">${UI.verdictPill(u.status,{small:true})}<span>${u.hard.length} hard stop${u.hard.length===1?'':'s'} (${u.hard.filter(x=>x.status==='pass').length} met) · ${u.cond.length} condition${u.cond.length===1?'':'s'} (${u.cond.filter(x=>x.status==='pass').length} met)${u.info?` · ${(u.info.n||0).toLocaleString()} other readings, ${u.info.oor||0} out of range`:''}</span></div>${u.blocked?`<div class="a-vd-blockband small">${UI.shield('#fff', 12)} BLOCKED — ${u.hard.filter(x=>x.status==='fail').map(x=>esc(x.criterion)).join(' · ')}</div>`:''}${u.criteria.filter(x=>x.status!=='pass').length?`<ul class="a-an-list">${u.criteria.filter(x=>x.status!=='pass').map(x=>`<li><span class="a-vd-mark ${UI._vdStatus(x.status).cls}">${UI._vdStatus(x.status).g}</span>${esc(x.criterion)} — ${x.members.filter(m=>m.status!=='pass').map(m=>`${esc(m.name.trim())} ${m.status==='notread'?'not read':`reads <b>${esc(m.value||'—')}</b>${m.expected?` (expected ${esc(m.expected)})`:''}`}`).join('; ')}</li>`).join('')}</ul>`:`<p class="a-vd-p" style="margin:4px 0 0">Every UMS rule of this system is met.</p>`}<div class="a-an-must"><b>For this system to be left unmanned:</b> ${esc(must||'—')}.</div></div>` : `<div class="a-an-ums"><div class="a-an-h">UMS outcome for this system</div><p class="a-vd-p" style="margin:4px 0 0">No UMS rules named for this system yet.</p></div>`;
  return `<div class="a-card a-an" data-cluster="${esc(key)}">
    <div class="a-head"><div class="t">${UI.icon({glyph:'≡', color:c})}${esc(label)}${source?UI.info(source):''}</div><div class="d">${confidence?esc(confidence)+' confidence':''}</div></div>
    <div class="a-an-q">${esc(question)}</div>
    <div class="a-an-grid">
      <div class="a-an-left">
        <div class="a-an-score"><span class="sc" style="color:${c}">${score!=null?score:'—'}</span><span class="st" style="color:${c}">${esc(status||'')}</span><span class="a-an-what">the analyst's score — condition, not permission</span></div>
        <div class="md a-an-lead">${lead||'<p class="a-vd-p">No written analysis for this system on this check.</p>'}</div>
        ${evidence.length?`<div class="a-an-h" style="margin-top:10px">Readings the analyst cited <span>${evidence.length}</span></div><div>${evidence.map(chip).join('')}</div>`:''}
        ${postits.length?`<div class="a-an-h" style="margin-top:12px">Post-its <span>${postits.length}</span></div>${postits.slice(0,3).map(q=>`<div class="a-an-post"><span class="dot" style="background:${q.severity==='high'?'var(--alarm)':q.severity==='medium'?'var(--warning)':'var(--ink-3)'}"></span><span>${esc((q.body||'').slice(0,220))}${(q.body||'').length>220?'…':''}</span></div>`).join('')}`:''}
        ${onOpen?`<div style="margin-top:10px"><span class="a-link" onclick="${onOpen}">Read the full analysis</span></div>`:''}
      </div>
      <div class="a-an-right">${umsHtml}${onOther?`<div style="margin-top:8px"><a class="a-link" onclick="${onOther(key)}">All readings of this system</a></div>`:''}</div>
    </div>
  </div>`;
};
/* the first real paragraph of an analyst's note (skips the title, the IMO/Period/Status line, rules and headings) */
UI.analysisLead = function(md, max=900){
  const paras = String(md||'').replace(/\r/g,'').split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean);
  const good = paras.filter(x => !/^#/.test(x) && !/^---/.test(x) && !/^\*\*(IMO|Period|Status|Vessel|Check)/i.test(x) && !/^(IMO|Period|Status):/i.test(x) && x.replace(/[*_`]/g,'').length >= 60);
  const pick = good.length ? good.slice(0,2).join('\n\n') : (paras.find(x=>!/^#/.test(x)) || '');
  return pick.slice(0, max);
};

/* =====================================================================
   "How it works" page — UI.aboutPage(ABOUT) (24-Sep-2026). The philosophy, the Chief's matrix, the verdict logic,
   the skills, the data, the coverage and the road ahead, rendered Apple-style from data/about.js. Pure; the page
   supplies links (openTag, openVessel) if it wants them.
   ===================================================================== */
UI.TIER_COLORS = {hard:'#E30019', condition:'#FE9413', coverage:'#6D28D9', info:'#8E8E93'};
UI.tierPill = t => { const k = String(t||'').split(/[\s/]/)[0]; const c = UI.TIER_COLORS[k] || '#8E8E93'; return `<span class="a-tier" style="color:${c};background:${c}14">${esc(t)}</span>`; };
/* the matrix table, built from the live rules (ums-criteria.js) so the page can never drift from what runs:
   one line per criterion, its conditions merged into the AT SEA / IN PORT / IN HARBOUR columns */
UI.matrixFromRules = function(rules){
  if(!rules || !rules.length) return null;
  const byName = new Map();
  rules.forEach(r => {
    const k = r.criterion.replace(/\s*\(.*?in port.*?\)\s*/i,'').trim();
    if(!byName.has(k)) byName.set(k, {n:byName.size+1, cluster:(UMS.cluster(r.grp)||{}).short || (r.grp==='coverage'?'Coverage':r.grp), check:k, tags:(r.tag_ids||[]).map(t=>t.split('_')[1]), sea:'—', port:'—', harbor:'—', tiers:new Set(), weights:new Set(), action:r.action||'', source:r.source||'', limit:r.limit_source||'', notes:r.notes||''});
    const m = byName.get(k); const req = () => r.tier==='hard' ? 'required' : 'required';
    if(r.condition==='any'){ m.sea=req(); m.port=req(); m.harbor=req(); }
    else if(/SEA/i.test(r.condition)) m.sea=req();
    else if(/PORT/i.test(r.condition)) m.port=req();
    else if(/HARBOR|HARBOUR/i.test(r.condition)) m.harbor=req();
    m.tiers.add(r.tier || (r.hard_stop?'hard':'condition')); if(r.weight) m.weights.add(r.weight);
    if(r.limit_source) m.limit = r.limit_source;
    if(/draft|confirm/i.test(r.source||'')) m.source = r.source;
  });
  return [...byName.values()].map(m => Object.assign(m, {tier:[...m.tiers].join(' / '), weight:[...m.weights].join(' / ') || '—'}));
};
UI.aboutPage = function(A, {onTag=null, onVessel='', rules=null}={}){
  if(!A) return '';
  const sec = (id, kicker, title, lead, body) => `<section class="a-ab-sec" id="ab-${id}"><div class="a-ab-kicker">${esc(kicker)}</div><h2 class="a-ab-h2">${esc(title)}</h2>${lead?`<p class="a-ab-lead">${lead}</p>`:''}${body}</section>`;
  const answers = `<div class="a-ab-answers">${A.answers.map(x=>`<div class="a-card a-ab-answer"><div class="a-ab-kicker" style="color:${x.color}">${esc(x.title)}</div><div class="a-ab-big" style="color:${x.color}">${esc(x.big)}</div><div class="a-ab-sub">${esc(x.sub)}</div><p>${esc(x.text)}</p><div class="a-ab-src">${esc(x.source)}</div></div>`).join('')}</div>`;
  const phil = `<div class="a-ab-steps">${A.philosophy.map(s=>`<div class="a-card a-ab-step"><div class="a-ab-n">${s.n}</div><div class="a-ab-stepb"><div class="a-ab-q">${esc(s.q)}</div><p>${esc(s.text)}</p>${UI.tierPill(s.tier)}</div></div>`).join('')}</div>
    <div class="a-ab-principles">${A.principles.map(p=>`<div class="a-card a-ab-principle"><b>${esc(p.title)}</b><p>${esc(p.text)}</p></div>`).join('')}</div>`;
  const MX = (rules && UI.matrixFromRules(rules)) || A.matrix;
  const matrix = `<div class="a-card a-ab-matrixcard"><div class="a-ab-tablewrap"><table class="a-ab-matrix"><thead><tr><th>#</th><th>System</th><th>The check, in the Chief's words</th><th>Tags</th><th>At sea</th><th>In port</th><th>In harbour</th><th>Tier</th><th>Weight</th><th>If not met</th><th>Source</th></tr></thead><tbody>${MX.map(r=>`<tr class="${/draft/.test(r.source)?'draft':''}"><td>${r.n}</td><td>${esc(r.cluster)}</td><td class="chk">${esc(r.check)}</td><td class="tags">${r.tags.map(t=>/^\d+$/.test(t)&&onTag?`<code onclick="${onTag('9531739_'+t)}">${esc(t)}</code>`:`<code>${esc(t)}</code>`).join(' ')}</td><td>${esc(r.sea)}</td><td>${esc(r.port)}</td><td>${esc(r.harbor)}</td><td>${UI.tierPill(r.tier)}</td><td class="w">${esc(String(r.weight))}</td><td>${esc(r.action)}</td><td class="src ${/draft/.test(r.source)?'todo':/confirm/.test(r.source)?'tbc':''}">${esc(r.source)}${r.limit?`<i class="a-ab-limit" title="${esc(r.limit)}">limit needed</i>`:''}</td></tr>`).join('')}</tbody></table></div><div class="a-foot">${MX.length} checks, drafted by hand against this vessel's real tag list. One row becomes one rule row per condition where it is required. "Limit needed" marks a check whose true hard limit (an alarm setpoint) is not in the checklist and must come from the engine manual or the ship's SMS — until then it runs as a condition, never as a hard stop. Weights and hard stops stay proposed until an admin confirms them.</div></div>`;
  const logic = `<div class="a-ab-2col"><div class="a-card"><div class="a-ab-kicker">The six answers</div>${A.verdicts.map(v=>`<div class="a-ab-vrow">${UI.verdictPill(v.v)}<span>${esc(v.text)}</span></div>`).join('')}</div><div class="a-card"><div class="a-ab-kicker">The arithmetic</div><div class="a-explain-rows">${A.risk.map(r=>`<div class="a-explain-r"><b>${esc(r.k)}</b><span>${esc(r.v)}</span></div>`).join('')}</div><div class="a-foot">The same rules live in one file (ums.js) today and in the verdict script tomorrow — a unit test on the real 07 Jul 2026 walkaround keeps them identical.</div></div></div>`;
  const proc = A.process ? `<div class="a-ab-proc">${A.process.map(x=>`<div class="a-card a-ab-pstep"><div class="a-ab-pn">${x.n}</div><div class="a-ab-pb"><div class="a-ab-pt">${esc(x.t)}<span class="a-ab-pwho ${/code/i.test(x.who)?'code':/LLM/.test(x.who)?'llm':'human'}">${esc(x.who)}</span></div><p>${esc(x.what)}</p><div class="a-ab-pw">${esc(x.where)}</div></div></div>`).join('')}</div>` : '';
  const split = A.split ? `<div class="a-ab-split">
      <div class="a-card a-ab-sp code"><div class="a-ab-kicker">Code decides</div><ul>${A.split.code.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>
      <div class="a-card a-ab-sp llm"><div class="a-ab-kicker">The model reads and writes</div><ul>${A.split.llm.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>
      <div class="a-card a-ab-sp human"><div class="a-ab-kicker">A person decides</div><ul>${A.split.human.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>
    </div>${A.splitNote?`<p class="a-ab-note" style="text-align:center;max-width:820px;margin:14px auto 0">${esc(A.splitNote)}</p>`:''}` : '';
  const flow = `<div class="a-ab-flow">${A.flow.map((f,i)=>`<div class="a-ab-flowstep"><span>${esc(f)}</span></div>${i<A.flow.length-1?'<div class="a-ab-arrow">›</div>':''}`).join('')}</div>`;
  const skills = `<div class="a-ab-skills">${A.skills.map(s=>`<div class="a-card a-ab-skill" style="--sk:${s.color}"><div class="a-ab-skhead"><span class="a-ab-skdot"></span><b>${esc(s.name)}</b><span class="a-ab-skshort">${esc(s.short)}</span></div><p>${esc(s.does)}</p><div class="a-ab-skmeta"><span><i>owns</i> ${esc(s.owns)}</span><span><i>path</i> <code>${esc(s.path)}</code></span></div></div>`).join('')}</div>`;
  const tables = `<div class="a-card"><div class="a-explain-rows">${A.tables.map(t=>`<div class="a-explain-r"><b><code>${esc(t.t)}</code></b><span>${esc(t.r)}</span></div>`).join('')}</div><div class="a-foot">Live nyk_mti on Cloud SQL, read-only. Every card's ⓘ names its table, columns and filter.</div></div>`;
  const maxT = Math.max(...A.coverage.map(c=>c.tags));
  const cov = `<div class="a-card"><div class="a-ab-cov">${A.coverage.map(c=>`<div class="a-ab-covrow"><span class="l">${esc(c.cluster)}</span><span class="bar"><i style="width:${(c.tags/maxT*100).toFixed(1)}%"></i><b style="width:${(c.rules/maxT*100).toFixed(1)}%"></b></span><span class="n">${c.rules} of ${c.tags} tags in rules · ${c.review} thresholds to review</span></div>`).join('')}</div><div class="a-ab-covleg"><span><i style="background:var(--base-2)"></i>readings in the checklist</span><span><i style="background:#1D3C67"></i>in the UMS rules</span></div><p class="a-ab-note">${esc(A.coverageNote)}</p></div>`;
  const plan = `<div class="a-ab-plan">${A.plan.map(p=>`<div class="a-card a-ab-planstep ${p.state}"><div class="a-ab-kicker">${esc(p.step)}</div><b>${esc(p.title)}</b><p>${esc(p.text)}</p></div>`).join('')}</div>`;
  return `<div class="a-about">
    <div class="a-ab-hero"><div class="a-ab-kicker">How it works</div><h1 class="a-ab-h1">${esc(A.question)}</h1><p class="a-ab-lead">${esc(A.intro)}</p></div>
    ${sec('answers', 'Two answers, never confused', 'Condition is not permission', 'The health score says how the machinery is. The verdict says whether the Chief may leave. They sit side by side everywhere in this app.', answers)}
    ${sec('philosophy', 'The Chief Engineer\'s logic', 'Seven questions, in this order', 'A Chief does not add up scores. Before leaving the engine room unmanned he walks one mental list. The rules follow it.', phil)}
    ${sec('matrix', 'The matrix', 'One row per check, one column per condition', 'Each row is one rule in the Chief\'s words. The noon report status decides which column applies today. Click a tag id to open it.', matrix)}
    ${sec('logic', 'The verdict', 'How the answer is computed', '', logic)}
    ${sec('process', 'One day, end to end', 'What happens between the walkaround and the decision', 'Eight steps. Four are code, two are the model, two are people. Every step names where its output is written.', proc)}
    ${sec('split', 'Who does what', 'Code, model, person', 'The line is drawn by consequence, not by convenience.', split)}
    ${sec('flow', 'From a checklist to a decision', 'The chain of skills', '', flow + skills)}
    ${sec('data', 'Where the numbers come from', 'The tables', '', tables)}
    ${sec('coverage', 'Honest coverage', 'What is checked today', '', cov)}
    ${sec('plan', 'The road ahead', 'Manual first, then a skill', '', plan)}
  </div>`;
};

/* =====================================================================
   Rules (Settings) — UI.rulesPage (24-Sep-2026). One section per system: every UMS rule of this vessel with the
   controls that will edit it, and where each limit came from. Read-only until m0_check_reports.ums_criteria exists;
   the controls render with their current value so the design is visible and honest.
   Design: ../UMS-SETTINGS-DESIGN.md
   ===================================================================== */
UI.SHAPES = [
  {key:'threshold', label:'Within its threshold',            match:r=>!r.required||!Object.keys(r.required).length},
  {key:'range',     label:'Within the declared range',       match:r=>r.required&&r.required.min!=null&&r.required.max!=null},
  {key:'atleast',   label:'At least',                        match:r=>r.required&&r.required.min!=null&&r.required.max==null},
  {key:'atmost',    label:'At most',                         match:r=>r.required&&r.required.max!=null&&r.required.min==null},
  {key:'state',     label:'Must read state',                 match:r=>r.required&&r.required.state&&r.kind!=='group'},
  {key:'nstate',    label:'At least N of these read…',       match:r=>r.required&&r.required.state&&r.kind==='group'},
  {key:'inrange',   label:'All within their thresholds',     match:r=>r.required&&r.required.in_range},
  {key:'pair',      label:'One running, one on standby',     match:r=>r.required&&r.required.one_running_one_standby},
  {key:'spread',    label:'Spread across units',             match:r=>r.required&&r.required.spread_pct!=null},
  {key:'burn',      label:'Enough for the watch',            match:r=>r.required&&r.required.hours_of_burn!=null},
  {key:'coverage',  label:'At least X % read',               match:r=>r.required&&r.required.read_pct!=null},
];
UI.shapeOf = r => (UI.SHAPES.find(s=>{ try { return s.match(r); } catch(e){ return false; } }) || UI.SHAPES[0]);
UI._sel = (options, active, {wide=false, disabled=true}={}) =>
  `<span class="a-set-sel${wide?' wide':''}${disabled?' ro':''}">${esc(options.find(o=>o.key===active)?.label ?? active ?? '—')}<i>⌄</i></span>`;
UI._limitChip = r => {
  const src = r.limit_source ? 'needs a setpoint' : (r.required&&(r.required.min!=null||r.required.max!=null)) ? 'M0 master' :
              (r.required&&r.required.state) ? 'stated in the rule' : 'threshold table';
  const cls = r.limit_source ? 'warn' : src==='M0 master' ? 'ok' : '';
  return `<span class="a-set-src ${cls}" ${r.limit_source?`title="${esc(r.limit_source)}"`:''}>${esc(src)}</span>`;
};
UI.rulesPage = function({rules=[], vessel='', imo='', version='', tagName=null, onTag=null, candidates={}, editable=false, note=''}={}){
  const byGrp = {};
  rules.forEach(r => (byGrp[r.grp] = byGrp[r.grp] || []).push(r));
  const order = UMS.CLUSTERS.map(c=>c.key).concat(['coverage']);
  const TIERS = [{key:'hard',label:'Hard stop'},{key:'condition',label:'Condition'},{key:'coverage',label:'Coverage'},{key:'info',label:'Information'}];
  const CONDS = [{key:'any',label:'Always'},{key:'AT SEA',label:'At sea'},{key:'IN PORT',label:'In port'},{key:'IN HARBOR',label:'In harbour'}];
  const row = r => {
    const sh = UI.shapeOf(r);
    const tags = (r.tag_ids||[]).map(t => onTag ? `<code onclick="${onTag(t)}">${esc(t.split('_')[1])}</code>` : `<code>${esc(t.split('_')[1])}</code>`).join(' ');
    const detail = r.required && r.required.min!=null ? `${UI.fmtNum(r.required.min)}${r.required.max!=null?' – '+UI.fmtNum(r.required.max):' +'}`
                 : r.required && r.required.state ? esc(r.required.state) + (r.required.min_count?` × ${r.required.min_count}`:'')
                 : r.required && r.required.hours_of_burn!=null ? `${r.required.hours_of_burn} h × ${r.required.margin||1}`
                 : r.required && r.required.read_pct!=null ? `${r.required.read_pct} %` : '';
    const confirmed = /confirm/i.test(r.source||'') ? `<span class="a-set-state prop">Proposed</span>` : `<span class="a-set-state">Seeded</span>`;
    return `<div class="a-set-row" data-id="${r.id}">
      <div class="a-set-main">
        <div class="a-set-crit"><b>${esc(r.criterion)}</b>${r.limit_source?`<i class="a-vd-tbc" title="${esc(r.limit_source)}">limit needed</i>`:''}</div>
        <div class="a-set-tags">${tags}${(r.tag_ids||[]).length>1?`<span class="a-set-n">${r.tag_ids.length} tags</span>`:''}${r.notes?`<span class="a-set-note" title="${esc(r.notes)}">note</span>`:''}</div>
      </div>
      <div class="a-set-f"><label>Requires</label>${UI._sel(UI.SHAPES, sh.key, {wide:true})}${detail?`<span class="a-set-val">${detail}</span>`:''}</div>
      <div class="a-set-f"><label>Applies</label>${UI._sel(CONDS, r.condition)}</div>
      <div class="a-set-f"><label>Tier</label>${UI._sel(TIERS, r.tier || (r.hard_stop?'hard':'condition'))}</div>
      <div class="a-set-f"><label>Weight</label><span class="a-set-w">${r.weight!=null?r.weight:'—'}</span></div>
      <div class="a-set-f"><label>Limit from</label>${UI._limitChip(r)}</div>
      <div class="a-set-f"><label>Status</label>${confirmed}</div>
      <div class="a-set-act"><label>If not met</label><span>${esc(r.action||'—')}</span></div>
    </div>`;
  };
  const sections = order.filter(k=>byGrp[k]).map(k => {
    const cl = UMS.cluster(k) || {label:'Coverage', question:'Was enough of the checklist actually filled in?'};
    const rs = byGrp[k].slice().sort((a,b)=>(a.tier==='hard'?0:1)-(b.tier==='hard'?0:1) || a.id-b.id);
    const cand = candidates[k];
    return `<details class="a-card a-set-sec" open><summary><b>${esc(cl.label)}</b><span class="a-set-q">${esc(cl.question)}</span>
        <span class="a-set-count">${rs.filter(r=>r.tier==='hard').length} hard · ${rs.filter(r=>r.tier!=='hard').length} other</span><span class="a-vd-chev">›</span></summary>
      <div class="a-set-rows">${rs.map(row).join('')}</div>
      <div class="a-set-foot">
        <button class="chip small" ${editable?'':'disabled'}>+ Add a check</button>
        <button class="chip small" ${editable?'':'disabled'}>Propose checks${cand?` (${cand} ranked)`:''}</button>
        <button class="chip small" ${editable?'':'disabled'}>Test on a date</button>
        ${cand?`<span class="a-set-cand">${cand} candidates ranked by the algorithm for this system — open to review</span>`:''}
      </div></details>`;
  }).join('');
  const missing = UMS.CLUSTERS.filter(c=>!byGrp[c.key]);
  return `<div class="a-settings">
    <div class="a-set-head">
      <div><div class="a-ab-kicker">Rules</div><h2 class="a-ab-h2">What this ship must satisfy to go unmanned</h2>
        <p class="a-ab-lead" style="margin:0">${esc(rules.length)} checks over ${new Set(rules.flatMap(r=>r.tag_ids||[])).size} readings, for ${esc(vessel)} (imo ${esc(imo)}), master version <code>${esc(version)}</code>. Every check is a row of data — an admin edits it here, nothing is released.</p></div>
    </div>
    ${note?`<div class="a-set-banner">${note}</div>`:''}
    ${sections}
    ${missing.length?`<p class="a-vd-none">No checks yet for: ${missing.map(c=>esc(c.label)).join(' · ')} — use <b>Propose checks</b> in each section.</p>`:''}
  </div>`;
};

/* =====================================================================
   Long-form project page — UI.storyPage(STORY.problem | STORY.built) (24-Sep-2026)
   Apple product-page shape: hero, a stat row, then sections of kicker + heading + lead, with optional card grids
   or numbered steps. Content lives in data/story.js; this file only lays it out.
   ===================================================================== */
UI._md = t => esc(String(t||'')).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<code>$1</code>');
UI.storyPage = function(S){
  if(!S) return '';
  const stats = S.stats ? `<div class="a-st-stats">${S.stats.map(x=>`<div class="a-st-stat"><div class="n">${esc(x.n)}</div><div class="l">${esc(x.l)}</div>${x.s?`<div class="s">${esc(x.s)}</div>`:''}</div>`).join('')}</div>` : '';
  const sec = x => {
    const cards = x.cards ? `<div class="a-st-cards">${x.cards.map(c=>`<div class="a-card a-st-card"><b>${esc(c.h)}</b><p>${UI._md(c.p)}</p></div>`).join('')}</div>` : '';
    const table = x.table ? `<div class="a-card a-st-tablecard"><div class="a-ab-tablewrap"><table class="a-st-table"><thead><tr>${x.table.head.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${x.table.rows.map(r=>`<tr>${r.map((c,i)=>`<td${i===0?' class="k"':''}>${UI._md(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>` : '';
    const steps = x.steps ? `<div class="a-st-steps">${x.steps.map(s=>`<div class="a-card a-st-step"><div class="a-ab-pn">${s.n}</div><div><b>${esc(s.h)}</b><p>${UI._md(s.p)}</p></div></div>`).join('')}</div>` : '';
    return `<section class="a-st-sec">${x.kicker?`<div class="a-ab-kicker">${esc(x.kicker)}</div>`:''}
      <h2 class="a-ab-h2">${esc(x.h)}</h2>${x.body?`<p class="a-ab-lead">${UI._md(x.body)}</p>`:''}${table}${cards}${steps}</section>`;
  };
  return `<div class="a-story">
    <div class="a-st-hero"><div class="a-ab-kicker">${esc(S.kicker)}</div><h1 class="a-ab-h1">${esc(S.title)}</h1><p class="a-ab-lead">${UI._md(S.lead)}</p></div>
    ${stats}${(S.sections||[]).map(sec).join('')}</div>`;
};

/* =====================================================================
   "How the data becomes an answer" — UI.processPage(PROCESS) (24-Sep-2026)
   Apple's explanation rhythm: one idea, one visual, scroll, next. Text and art alternate sides; each step carries
   who does it (program · the model proposes · a person decides). Art is inline SVG built from the real shape of the
   data — diagrams, not decoration. Content: data/process.js
   ===================================================================== */
UI.WHO = {
  received: {label:'what we received', cls:'rec'},
  program:  {label:'a program does this', cls:'prog'},
  ai:       {label:'the model proposes · a person verifies', cls:'ai'},
  person:   {label:'a person decides', cls:'per'},
};
UI.ART = {
  files: () => `<svg viewBox="0 0 340 210" class="a-art">${
    Array.from({length:24},(_,i)=>{const x=20+(i%8)*38, y=34+Math.floor(i/8)*48; const master = i===3||i===11;
      return `<rect x="${x}" y="${y}" width="28" height="36" rx="4" fill="${master?'#EAF0F9':'#fff'}" stroke="${master?'#1D3C67':'#D2D2D7'}"/>`+
        [9,15,21].map(dy=>`<line x1="${x+5}" x2="${x+(dy===15?18:23)}" y1="${y+dy}" y2="${y+dy}" stroke="${master?'#B9C9E2':'#E5E5EA'}" stroke-width="2"/>`).join('')}).join('')
    }<rect x="14" y="26" width="312" height="152" rx="14" fill="none" stroke="#0071E3" stroke-width="2" stroke-dasharray="7 5" opacity=".5"/>
    <text x="20" y="20" font-size="11" fill="#1D3C67" font-family="-apple-system">ATLAS LEADER.zip</text>
    <text x="20" y="198" font-size="11" fill="#8E8E93" font-family="-apple-system">1,820 checks</text>
    <text x="150" y="198" font-size="11" fill="#1D3C67" font-family="-apple-system">8 masters</text>
    <text x="238" y="198" font-size="11" fill="#8E8E93" font-family="-apple-system">2 noon reports</text></svg>`,

  master: () => `<svg viewBox="0 0 340 210" class="a-art"><rect x="16" y="14" width="308" height="182" rx="12" fill="#fff" stroke="#D2D2D7"/>
    <rect x="16" y="14" width="308" height="28" rx="12" fill="#1D3C67"/><rect x="16" y="32" width="308" height="10" fill="#1D3C67"/>
    <text x="28" y="33" font-size="10.5" fill="#fff" font-family="-apple-system">M0Master_9531739_202604111901 · 1,267 tags</text>
    ${['id','name','unit / state','min','max'].map((h,i)=>`<text x="${[26,92,196,254,292][i]}" y="58" font-size="9" fill="#8E8E93" font-family="-apple-system">${h}</text>`).join('')}
    ${[['9531739_972','Fire Alarm Panel Power lamp','On'],['9531739_827','F.O Service Tank Level','m³'],['9531739_1160','No.1 D/G Man/Auto switch','Auto'],['9531739_552','No.1 Main LO Pump Del. press','MPa']].map((r,i)=>{const y=78+i*26;
      return `<line x1="24" x2="316" y1="${y+9}" y2="${y+9}" stroke="#F2F2F7"/>
        <text x="26" y="${y}" font-size="8.5" fill="#0071E3" font-family="ui-monospace,Menlo,monospace">${r[0]}</text>
        <text x="92" y="${y}" font-size="9" fill="#1D1D1F" font-family="-apple-system">${r[1].slice(0,26)}</text>
        <text x="196" y="${y}" font-size="9" fill="#6E6E73" font-family="-apple-system">${r[2]}</text>
        <rect x="252" y="${y-8}" width="28" height="11" rx="3" fill="#FFF1E0"/><rect x="290" y="${y-8}" width="28" height="11" rx="3" fill="#FFF1E0"/>`}).join('')}
    <text x="170" y="190" text-anchor="middle" font-size="10.5" fill="#B85D00" font-family="-apple-system">min and max blank on 1,247 of 1,267 rows</text></svg>`,

  check: () => `<svg viewBox="0 0 340 210" class="a-art"><rect x="40" y="14" width="260" height="170" rx="12" fill="#fff" stroke="#D2D2D7"/>
    <rect x="40" y="14" width="260" height="28" rx="12" fill="#0071E3"/><rect x="40" y="32" width="260" height="10" fill="#0071E3"/>
    <text x="52" y="33" font-size="10" fill="#fff" font-family="-apple-system">M0Check_9531739_202607071859</text>
    <text x="52" y="58" font-size="9" fill="#8E8E93" font-family="-apple-system">tag id</text><text x="176" y="58" font-size="9" fill="#8E8E93" font-family="-apple-system">value</text><text x="238" y="58" font-size="9" fill="#8E8E93" font-family="-apple-system">timestamp</text>
    ${[['9531739_972','ON','090312'],['9531739_827','26','094401'],['9531739_1160','0','093208'],['9531739_552','0.32','085417']].map((r,i)=>{const y=80+i*25;
      return `<text x="52" y="${y}" font-size="8.5" fill="#0071E3" font-family="ui-monospace,Menlo,monospace">${r[0]}</text>
        <text x="176" y="${y}" font-size="10" fill="#1D1D1F" font-family="-apple-system" font-weight="600">${r[1]}</text>
        <text x="238" y="${y}" font-size="8.5" fill="#AEAEB2" font-family="ui-monospace,Menlo,monospace">${r[2]}</text>`}).join('')}
    <text x="170" y="200" text-anchor="middle" font-size="10.5" fill="#8E8E93" font-family="-apple-system">no name · no unit · no range</text></svg>`,

  join: () => `<svg viewBox="0 0 340 210" class="a-art">
    <rect x="12" y="26" width="132" height="54" rx="8" fill="#fff" stroke="#1D3C67"/>
    <text x="20" y="20" font-size="9.5" fill="#1D3C67" font-family="-apple-system">master</text>
    <text x="20" y="44" font-size="8.5" fill="#0071E3" font-family="ui-monospace,Menlo,monospace">9531739_1160</text>
    <text x="20" y="58" font-size="9" fill="#1D1D1F" font-family="-apple-system">No.1 D/G Man/Auto</text>
    <text x="20" y="71" font-size="9" fill="#6E6E73" font-family="-apple-system">expected: Auto</text>
    <rect x="196" y="26" width="132" height="54" rx="8" fill="#fff" stroke="#0071E3"/>
    <text x="204" y="20" font-size="9.5" fill="#0071E3" font-family="-apple-system">check · 07 Jul 2026</text>
    <text x="204" y="44" font-size="8.5" fill="#0071E3" font-family="ui-monospace,Menlo,monospace">9531739_1160</text>
    <text x="204" y="60" font-size="13" fill="#E30019" font-family="-apple-system" font-weight="700">0</text>
    <text x="222" y="60" font-size="9" fill="#6E6E73" font-family="-apple-system">at 09:32</text>
    <path d="M144 53 L196 53" stroke="#C7C7CC" stroke-width="1.5" stroke-dasharray="4 3"/>
    <path d="M78 80 L78 104 L262 104 L262 80" stroke="#C7C7CC" stroke-width="1.5" fill="none"/>
    <rect x="66" y="118" width="208" height="62" rx="10" fill="#FDF4F5" stroke="#E30019"/>
    <text x="170" y="138" text-anchor="middle" font-size="10" fill="#8E8E93" font-family="-apple-system">one reading</text>
    <text x="170" y="156" text-anchor="middle" font-size="11.5" fill="#1D1D1F" font-family="-apple-system">No.1 D/G Man/Auto reads <tspan font-weight="700" fill="#E30019">0</tspan></text>
    <text x="170" y="172" text-anchor="middle" font-size="10.5" fill="#6E6E73" font-family="-apple-system">expected Auto → out of range</text></svg>`,

  versions: () => { const v=[[0,'Oct 2020'],[1.5,''],[47,'Jul 2023'],[62,'Apr 2024'],[64.5,''],[96,'Apr 2026'],[97.5,'']];
    return `<svg viewBox="0 0 340 210" class="a-art"><line x1="24" x2="316" y1="112" y2="112" stroke="#D2D2D7" stroke-width="2"/>
    ${v.map(([pc,l])=>{const x=24+pc/100*292; return `<line x1="${x}" x2="${x}" y1="96" y2="128" stroke="#1D3C67" stroke-width="2.5"/>${l?`<text x="${x}" y="148" text-anchor="middle" font-size="9" fill="#8E8E93" font-family="-apple-system">${l}</text>`:''}`}).join('')}
    <path d="M32 84 L164 84" stroke="#B85D00" stroke-width="1" stroke-dasharray="3 3"/>
    <text x="98" y="78" text-anchor="middle" font-size="9.5" fill="#B85D00" font-family="-apple-system">33 months, no change</text>
    <text x="30" y="172" font-size="9.5" fill="#8E8E93" font-family="-apple-system">2 versions a day apart</text>
    <text x="310" y="172" text-anchor="end" font-size="9.5" fill="#8E8E93" font-family="-apple-system">2 more, a day apart</text>
    <text x="170" y="196" text-anchor="middle" font-size="10.5" fill="#8E8E93" font-family="-apple-system">8 master versions in 5.7 years</text></svg>`},

  range: () => `<svg viewBox="0 0 340 210" class="a-art">
    ${[['band','9531739_827','16–28 m³',0],['one state','9531739_972','On',1],['classified set','9531739_1160','Auto | 0 | MANU',2],['run / stop','9531739_593','320–380 | idle',3],['mixed + idle','9531739_553','0.33–0.42 | STBY',4]].map(([l,tag,val,i])=>{const y=26+i*38;
      return `<text x="16" y="${y}" font-size="9.5" fill="#1D1D1F" font-family="-apple-system">${l}</text>
        <text x="16" y="${y+13}" font-size="8" fill="#0071E3" font-family="ui-monospace,Menlo,monospace">${tag}</text>
        <rect x="150" y="${y-8}" width="174" height="12" rx="6" fill="#F2F2F7"/>
        ${i===0?`<rect x="178" y="${y-8}" width="96" height="12" rx="6" fill="#1DA100" opacity=".45"/>`:''}
        ${i===1?`<circle cx="176" cy="${y-2}" r="6" fill="#1DA100"/>`:''}
        ${i===2?[['#1DA100',176],['#FE9413',212],['#FE9413',248]].map(([c,x])=>`<circle cx="${x}" cy="${y-2}" r="6" fill="${c}"/>`).join(''):''}
        ${i===3?`<rect x="160" y="${y-8}" width="70" height="12" rx="6" fill="#1DA100" opacity=".45"/><rect x="250" y="${y-8}" width="60" height="12" rx="6" fill="#8E8E93" opacity=".3"/>`:''}
        ${i===4?`<rect x="160" y="${y-8}" width="84" height="12" rx="6" fill="#1DA100" opacity=".45"/><text x="262" y="${y+2}" font-size="9" fill="#8E8E93" font-family="-apple-system">STBY</text>`:''}
        <text x="150" y="${y+15}" font-size="8.5" fill="#8E8E93" font-family="-apple-system">${val}</text>`}).join('')}
    <text x="170" y="204" text-anchor="middle" font-size="10.5" fill="#8E8E93" font-family="-apple-system">five shapes a normal can take</text></svg>`,

  validate: () => `<svg viewBox="0 0 340 210" class="a-art">
    ${[['9531739_814','98','MPa','a pressure gauge cannot read 98 MPa','#E30019'],
       ['9531739_552','34.0','MPa','the decimal point moved: always 0.34','#E30019'],
       ['9531739_576','–','℃','blank — not read, or idle?','#FE9413'],
       ['9531739_1160','0','Auto','a number where a word belongs','#FE9413']].map((r,i)=>{const y=26+i*44;
      return `<rect x="14" y="${y}" width="312" height="34" rx="8" fill="#fff" stroke="#E5E5EA"/>
        <rect x="14" y="${y}" width="4" height="34" rx="2" fill="${r[4]}"/>
        <text x="28" y="${y+15}" font-size="8.5" fill="#0071E3" font-family="ui-monospace,Menlo,monospace">${r[0]}</text>
        <text x="110" y="${y+16}" font-size="13" font-weight="700" fill="${r[4]}" font-family="-apple-system">${r[1]}</text>
        <text x="${110+String(r[1]).length*8+4}" y="${y+16}" font-size="9" fill="#8E8E93" font-family="-apple-system">${r[2]}</text>
        <text x="28" y="${y+28}" font-size="9" fill="#6E6E73" font-family="-apple-system">${r[3]}</text>`}).join('')}
    <text x="170" y="204" text-anchor="middle" font-size="10.5" fill="#8E8E93" font-family="-apple-system">each needs a rule before anything is compared</text></svg>`,

  noonrule: () => `<svg viewBox="0 0 340 210" class="a-art">
    <text x="170" y="16" text-anchor="middle" font-size="10" fill="#8E8E93" font-family="-apple-system">one rule: at least one D/G selector in Auto</text>
    ${[['AT SEA','#0071E3','HARD STOP','#E30019','stay manned',16],['IN PORT','#1DA100','condition','#FE9413','note it',178]].map(([cond,cc,tier,tc,act,x])=>
      `<rect x="${x}" y="30" width="146" height="150" rx="12" fill="#fff" stroke="#E5E5EA"/>
       <rect x="${x}" y="30" width="146" height="26" rx="12" fill="${cc}"/><rect x="${x}" y="46" width="146" height="10" fill="${cc}"/>
       <text x="${x+73}" y="48" text-anchor="middle" font-size="10" fill="#fff" font-family="-apple-system">${cond}</text>
       <text x="${x+73}" y="76" text-anchor="middle" font-size="9" fill="#8E8E93" font-family="-apple-system">noon_report.status</text>
       <rect x="${x+30}" y="88" width="86" height="20" rx="10" fill="${tc}14"/>
       <text x="${x+73}" y="102" text-anchor="middle" font-size="9.5" font-weight="700" fill="${tc}" font-family="-apple-system">${tier}</text>
       <text x="${x+73}" y="128" text-anchor="middle" font-size="9.5" fill="#8E8E93" font-family="-apple-system">weight ${cond==='AT SEA'?'5':'2'}</text>
       <text x="${x+73}" y="150" text-anchor="middle" font-size="10" fill="#1D1D1F" font-family="-apple-system">if not met:</text>
       <text x="${x+73}" y="166" text-anchor="middle" font-size="10" fill="${tc}" font-family="-apple-system">${act}</text>`).join('')}
    <text x="170" y="200" text-anchor="middle" font-size="10.5" fill="#8E8E93" font-family="-apple-system">same reading, different standard</text></svg>`,

  fuelmath: () => `<svg viewBox="0 0 340 210" class="a-art">
    <text x="16" y="20" font-size="9.5" fill="#0071E3" font-family="ui-monospace,Menlo,monospace">9531739_827  F.O Service Tank</text>
    <rect x="16" y="32" width="120" height="120" rx="8" fill="#F2F2F7" stroke="#D2D2D7"/>
    <rect x="16" y="52" width="120" height="100" rx="8" fill="#1DA100" opacity=".25"/>
    <line x1="16" x2="136" y1="88" y2="88" stroke="#E30019" stroke-width="2" stroke-dasharray="4 3"/>
    <text x="76" y="46" text-anchor="middle" font-size="13" font-weight="700" fill="#1D1D1F" font-family="-apple-system">26.0 m³</text>
    <text x="142" y="92" font-size="9.5" fill="#E30019" font-family="-apple-system">22.3 m³ needed</text>
    <text x="142" y="104" font-size="9" fill="#8E8E93" font-family="-apple-system">8 h × 1.5 margin</text>
    <rect x="152" y="120" width="172" height="76" rx="10" fill="#F7F8FA" stroke="#E5E5EA"/>
    <text x="164" y="138" font-size="9.5" fill="#8E8E93" font-family="-apple-system">noon report burn</text>
    <text x="164" y="154" font-size="11" fill="#1D1D1F" font-family="ui-monospace,Menlo,monospace">43.8 t/day ÷ 24</text>
    <text x="164" y="170" font-size="11" fill="#1D1D1F" font-family="ui-monospace,Menlo,monospace">× 8 h × 1.5 ÷ 0.98</text>
    <line x1="164" x2="312" y1="176" y2="176" stroke="#D2D2D7"/>
    <text x="164" y="190" font-size="11.5" font-weight="700" fill="#1DA100" font-family="-apple-system">= 22.3 m³ → 26.0 passes (14 h)</text>
    <text x="16" y="172" font-size="9.5" fill="#8E8E93" font-family="-apple-system">a level alone</text>
    <text x="16" y="186" font-size="9.5" fill="#8E8E93" font-family="-apple-system">means nothing</text></svg>`,

  classify: () => `<svg viewBox="0 0 340 210" class="a-art">
    <text x="16" y="18" font-size="9" fill="#8E8E93" font-family="-apple-system">1,267 tags</text>
    ${Array.from({length:40},(_,i)=>{const x=18+(i%10)*20, y=30+Math.floor(i/10)*17;
      return `<circle cx="${x}" cy="${y}" r="4.5" fill="${['#1D3C67','#6D28D9','#0E7490','#1DA100','#B85D00'][i%5]}" opacity=".75"/>`}).join('')}
    <path d="M222 62 l 16 0" stroke="#C7C7CC" stroke-width="1.5"/><path d="M234 58 l 5 4 l -5 4" stroke="#C7C7CC" stroke-width="1.5" fill="none"/>
    ${[['Main engine','#1D3C67','402'],['Power gen','#6D28D9','268'],['Cooling','#0E7490','92'],['Safety','#1DA100','90'],['Boiler','#B85D00','60']].map(([l,c,n],i)=>
      `<rect x="16" y="${112+i*19}" width="9" height="9" rx="3" fill="${c}"/>
       <text x="32" y="${120+i*19}" font-size="9.5" fill="#1D1D1F" font-family="-apple-system">${l}</text>
       <text x="128" y="${120+i*19}" font-size="9.5" fill="#8E8E93" font-family="-apple-system" text-anchor="end">${n} tags</text>`).join('')}
    <text x="248" y="66" font-size="9.5" fill="#1D1D1F" font-family="-apple-system">system</text>
    <text x="248" y="80" font-size="9.5" fill="#8E8E93" font-family="-apple-system">› equipment</text>
    <text x="248" y="120" font-size="9" fill="#8E8E93" font-family="-apple-system">No.1 D/G</text>
    <text x="248" y="134" font-size="9" fill="#8E8E93" font-family="-apple-system">Fire Detection</text>
    <text x="248" y="148" font-size="9" fill="#8E8E93" font-family="-apple-system">Aux. Boiler</text></svg>`,

  matrix: () => `<svg viewBox="0 0 340 210" class="a-art">
    ${['at sea','in port'].map((l,c)=>`<text x="${228+c*54}" y="20" text-anchor="middle" font-size="9" fill="#8E8E93" font-family="-apple-system">${l}</text>`).join('')}
    ${[['Fire panel: no other lamp lit','hard','req','req'],
       ['Oil mist detector, no alarm','hard','req','req'],
       ['≥ 1 D/G selector in Auto','hard','req','cond'],
       ['Emergency generator ready','hard','req','req'],
       ['Steering panels powered','hard','req','—'],
       ['CO₂ room at 100 %','cond','req','req'],
       ['Funnel smoke clean','cond','req','req']].map((r,i)=>{const y=32+i*24; const hard=r[1]==='hard';
      return `<rect x="14" y="${y}" width="186" height="18" rx="4" fill="#F7F8FA"/>
        <rect x="14" y="${y}" width="3.5" height="18" rx="2" fill="${hard?'#E30019':'#FE9413'}"/>
        <text x="24" y="${y+12.5}" font-size="9" fill="#1D1D1F" font-family="-apple-system">${r[0]}</text>
        ${[2,3].map(k=>{const x=228+(k-2)*54; const v=r[k];
          const fill = v==='req' ? (hard?'#FDE7E9':'#FFF6E8') : v==='cond' ? '#FFF6E8' : '#F2F2F7';
          const txt  = v==='req' ? (hard?'hard':'cond') : v==='cond' ? 'cond' : '—';
          const col  = v==='req' ? (hard?'#E30019':'#B85D00') : v==='cond' ? '#B85D00' : '#C7C7CC';
          return `<rect x="${x-24}" y="${y}" width="48" height="18" rx="4" fill="${fill}"/><text x="${x}" y="${y+12.5}" text-anchor="middle" font-size="8.5" font-weight="600" fill="${col}" font-family="-apple-system">${txt}</text>`}).join('')}`}).join('')}
    <rect x="14" y="196" width="3.5" height="10" rx="2" fill="#E30019"/>
    <text x="26" y="205" font-size="9.5" fill="#8E8E93" font-family="-apple-system">hard stop — one failure forbids unmanned running</text></svg>`,

  math: () => `<svg viewBox="0 0 340 250" class="a-art">
    <text x="16" y="16" font-size="9.5" fill="#8E8E93" font-family="-apple-system">07 Jul 2026 · at sea · 40 rules applied</text>
    ${[['Fire panel (1): other lamp lit','ON','Off','review','½','5','2.5','#FE9413'],
       ['All 3 D/G selectors in Auto','0','Auto','not met','1','3','3.0','#E30019'],
       ['E/D/G standby lamp','ON','—','cannot judge','½','2','1.0','#FE9413'],
       ['M/E LO delivery pressure','0.32','≥ 0.34','not met','1','4','4.0','#E30019'],
       ['No.2 air reservoir','Not in service','Service','review','½','4','2.0','#FE9413']].map((r,i)=>{const y=34+i*26;
      return `<text x="16" y="${y+10}" font-size="9" fill="#1D1D1F" font-family="-apple-system">${r[0]}</text>
        <text x="182" y="${y+10}" font-size="9" font-weight="700" fill="${r[7]}" font-family="-apple-system" text-anchor="end">${r[1]}</text>
        <text x="188" y="${y+10}" font-size="8.5" fill="#8E8E93" font-family="-apple-system">vs ${r[2]}</text>
        <text x="262" y="${y+10}" font-size="8.5" fill="#8E8E93" font-family="-apple-system" text-anchor="end">${r[4]} × ${r[5]}</text>
        <text x="322" y="${y+10}" font-size="9.5" font-weight="700" fill="#1D1D1F" font-family="ui-monospace,Menlo,monospace" text-anchor="end">${r[6]}</text>
        <line x1="16" x2="322" y1="${y+16}" y2="${y+16}" stroke="#F2F2F7"/>`}).join('')}
    <text x="16" y="180" font-size="9.5" fill="#8E8E93" font-family="-apple-system">35 other rules met</text>
    <text x="322" y="180" font-size="9.5" fill="#8E8E93" font-family="ui-monospace,Menlo,monospace" text-anchor="end">0.0</text>
    <line x1="16" x2="322" y1="188" y2="188" stroke="#D2D2D7" stroke-width="1.5"/>
    <text x="16" y="204" font-size="10" fill="#1D1D1F" font-family="-apple-system">12.5 risk points ÷ 136 total weight × 100</text>
    <text x="322" y="204" font-size="12" font-weight="700" fill="#FE9413" font-family="-apple-system" text-anchor="end">= 9</text>
    <rect x="16" y="214" width="306" height="28" rx="8" fill="#FFF6E8"/>
    <circle cx="32" cy="228" r="5" fill="#FE9413"/>
    <text x="46" y="232" font-size="11.5" font-weight="700" fill="#B85D00" font-family="-apple-system">GO WITH CONDITIONS</text>
    <text x="312" y="232" text-anchor="end" font-size="9" fill="#8E8E93" font-family="-apple-system">no hard stop failed · 5 to confirm</text></svg>`,
};
UI.processPage = function(P){
  if(!P) return '';
  const step = s => {
    const who = UI.WHO[s.who] || UI.WHO.program;
    const art = (UI.ART[s.art] || (()=>''))();
    const stats = s.stats ? `<div class="a-pr-stats">${s.stats.map(([n,l])=>`<div><b>${esc(n)}</b><span>${esc(l)}</span></div>`).join('')}</div>` : '';
    const code = s.code ? `<pre class="a-pr-code">${esc(s.code)}</pre>` : '';
    return `<section class="a-pr-step" data-n="${s.n}">
      <div class="a-pr-txt">
        <div class="a-pr-who ${who.cls}">${esc(who.label)}</div>
        <div class="a-ab-kicker">${esc(s.kicker)}</div>
        <h2 class="a-pr-h">${esc(s.h)}</h2>
        <p class="a-pr-p">${UI._md(s.p)}</p>
        ${stats}${code}
        ${s.note?`<p class="a-pr-note">${UI._md(s.note)}</p>`:''}
      </div>
      <div class="a-pr-art"><div class="a-pr-artbox">${art}</div><span class="a-pr-n">${s.n}</span></div>
    </section>`;
  };
  const close = P.close ? `<section class="a-pr-close"><div class="a-ab-kicker">${esc(P.close.kicker)}</div><h2 class="a-ab-h2">${esc(P.close.h)}</h2><p class="a-ab-lead">${UI._md(P.close.p)}</p>
    <div class="a-pr-legend">${['program','ai','person'].map(k=>`<span class="a-pr-who ${UI.WHO[k].cls}">${esc(UI.WHO[k].label)}</span>`).join('')}</div></section>` : '';
  return `<div class="a-process">
    <div class="a-st-hero"><div class="a-ab-kicker">${esc(P.kicker)}</div><h1 class="a-ab-h1">${esc(P.title)}</h1><p class="a-ab-lead">${UI._md(P.lead)}</p></div>
    ${P.steps.map(step).join('')}${close}</div>`;
};

/* =====================================================================
   "The two skills" — UI.skillsPage(SKILLS) (24-Sep-2026)
   What a skill is made of (prompt · scripts · rules · references), then each skill laid out part by part with its
   real file names and line counts, its numbered steps, and the tables it writes. Content: data/skills.js
   ===================================================================== */
UI.PART = {
  prompt: {label:'the procedure', cls:'prompt', glyph:'M4 3h12v18H4z M7 7h6 M7 11h6 M7 15h4'},
  script: {label:'the scripts',   cls:'script', glyph:'M8 6l-5 6 5 6 M16 6l5 6-5 6'},
  rules:  {label:'the rules',     cls:'rules',  glyph:'M4 5h16 M4 12h16 M4 19h10'},
  ref:    {label:'the references',cls:'ref',    glyph:'M5 4h11l3 3v13H5z M16 4v4h3'},
};
UI._partIcon = k => `<svg class="a-sk-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${UI.PART[k].glyph}"/></svg>`;
UI.skillsPage = function(S){
  if(!S) return '';
  const anatomy = `<div class="a-sk-anat">${S.anatomy.map(a=>`<div class="a-card a-sk-anatc ${UI.PART[a.k].cls}">${UI._partIcon(a.k)}<b>${esc(a.h)}</b><p>${esc(a.p)}</p></div>`).join('')}</div>`;
  const skill = k => {
    const parts = k.parts.map(pt => {
      const P = UI.PART[pt.k];
      return `<div class="a-sk-part ${P.cls}">
        <div class="a-sk-parth">${UI._partIcon(pt.k)}<b>${esc(P.label)}</b><span>${pt.files.length} file${pt.files.length===1?'':'s'}</span></div>
        <ul class="a-sk-files">${pt.files.map(f=>`<li><code>${esc(f[0])}</code><em>${esc(f[1])}</em>${f[2]?`<span>${esc(f[2])}</span>`:''}</li>`).join('')}</ul></div>`;
    }).join('');
    return `<section class="a-sk-skill">
      <div class="a-sk-head"><span class="a-sk-n">${k.n}</span><div><b>${esc(k.name)}</b><span class="a-sk-tag">${esc(k.tag)}</span><div class="a-sk-path"><code>${esc(k.path)}</code></div></div></div>
      <p class="a-ab-lead" style="margin:6px 0 16px;max-width:760px">${esc(k.line)}</p>
      <div class="a-sk-parts">${parts}</div>
      <div class="a-sk-flow"><div class="a-ab-kicker">the procedure, in order</div><ol>${k.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol></div>
      <div class="a-sk-writes"><div class="a-ab-kicker">what it writes</div>${k.writes.map(w=>`<div class="a-sk-w"><code>${esc(w[0])}</code><span>${esc(w[1])}</span></div>`).join('')}</div>
    </section>`;
  };
  const change = S.change ? `<section class="a-st-sec"><div class="a-ab-kicker">${esc(S.change.kicker)}</div><h2 class="a-ab-h2">${esc(S.change.h)}</h2>
    <div class="a-card a-sk-ba"><table><thead><tr><th></th><th>before</th><th>after</th></tr></thead><tbody>
    ${S.change.rows.map(r=>`<tr><td class="k">${esc(r[0])}</td><td class="b">${esc(r[1])}</td><td class="a">${esc(r[2])}</td></tr>`).join('')}
    </tbody></table></div></section>` : '';
  const sec = x => x ? `<section class="a-st-sec"><div class="a-ab-kicker">${esc(x.kicker)}</div><h2 class="a-ab-h2">${esc(x.h)}</h2><p class="a-ab-lead">${UI._md(x.p)}</p></section>` : '';
  return `<div class="a-skills">
    <div class="a-st-hero"><div class="a-ab-kicker">${esc(S.kicker)}</div><h1 class="a-ab-h1">${esc(S.title)}</h1><p class="a-ab-lead">${UI._md(S.lead)}</p></div>
    ${anatomy}${S.skills.map(skill).join('')}${sec(S.split)}${change}${sec(S.next)}</div>`;
};

/* =====================================================================
   CINEMA — UI.cinemaPage(PROCESS) (24-Sep-2026)

   The same twelve steps as UI.processPage, told as a scroll story.
   One idea per screen, sticky visual, text scrolling past it.

   Three scene kinds:
     photo   a full-bleed frame. Until the image exists, UI.photoPlate
             draws a deliberate placeholder carrying its own brief, so
             the page can be reviewed and signed off with no photography.
     data    the existing real-data SVG from UI.ART, enlarged.
     motion  a data scene that also carries a Hyperframes slot.

   UI.processPage is untouched and still reads PROCESS.steps.
   ===================================================================== */

UI.photoPlate = function(ph, style){
  const ar = (ph.aspect||'16:9').split(':').map(Number);
  const pad = (ar[1]/ar[0]*100).toFixed(2);
  return `<figure class="a-cn-plate ${ph.tone==='light'?'lt':'dk'}" style="--ar:${pad}%">
    <div class="a-cn-plateinner">
      <svg class="a-cn-frameico" viewBox="0 0 48 34" fill="none" stroke="currentColor" stroke-width="1.4">
        <rect x="1" y="6" width="46" height="27" rx="4"/><path d="M14 6l3-5h14l3 5"/><circle cx="24" cy="20" r="8"/></svg>
      <div class="a-cn-platetag">photograph · to be generated · ${esc(ph.aspect||'16:9')}</div>
      <p class="a-cn-brief">${esc(ph.brief)}</p>
      ${style?`<p class="a-cn-style"><b>style line</b> ${esc(style)}</p>`:''}
    </div></figure>`;
};

UI.motionSlot = function(txt){
  return `<div class="a-cn-motion">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M5 3l14 9-14 9z"/></svg>
    <div><b>motion slot · Hyperframes</b><span>${esc(txt)}</span></div></div>`;
};

UI.cinemaPage = function(P){
  if(!P || !P.scenes) return '';

  let shownStyle = false;
  const photoScene = (key) => {
    const ph = P.photos[key]; if(!ph) return '';
    const st = shownStyle ? '' : (shownStyle = true, P.photoStyle);  // the style line is stated once, not five times
    return `<section class="a-cn-scene ph ${ph.fullbleed?'bleed':''}" data-rv>
      ${UI.photoPlate(ph, st)}
      <div class="a-cn-phtxt">
        <div class="a-cn-kicker">${esc(ph.kicker)}</div>
        <h2 class="a-cn-h">${esc(ph.h)}</h2>
        <p class="a-cn-lead">${UI._md(ph.p)}</p>
      </div></section>`;
  };

  const dataScene = (s, idx) => {
    const who  = UI.WHO[s.who] || UI.WHO.program;
    const art  = (UI.ART[s.art] || (()=>''))();
    const mo   = P.motion && P.motion[s.n];
    const stats = s.stats ? `<div class="a-cn-stats">${s.stats.map(([n,l])=>`<div><b>${esc(n)}</b><span>${esc(l)}</span></div>`).join('')}</div>` : '';
    const code  = s.code ? `<pre class="a-cn-code">${esc(s.code)}</pre>` : '';
    return `<section class="a-cn-scene dt ${idx%2?'flip':''}" data-rv>
      <div class="a-cn-txt">
        <div class="a-cn-who ${who.cls}">${esc(who.label)}</div>
        <div class="a-cn-kicker">${esc(s.kicker)}</div>
        <h2 class="a-cn-h">${esc(s.h)}</h2>
        <p class="a-cn-lead">${UI._md(s.p)}</p>
        ${stats}${code}
        ${s.note?`<p class="a-cn-note">${UI._md(s.note)}</p>`:''}
      </div>
      <div class="a-cn-media">
        <div class="a-cn-stick">
          <div class="a-cn-artbox">${art}<span class="a-cn-n">${s.n}</span></div>
          ${mo?UI.motionSlot(mo):''}
        </div>
      </div></section>`;
  };

  /* --- rails: the horizontal sliders, both built from real data --- */
  /* the card face is the visual — one dot per rule actually written.
     The question lives in the caption, once, not twice. */
  const sysCard = ([key, n, q]) => ({
    art: `<div class="a-rl-sys">
            <div class="a-rl-syst"><b>${n||'0'}</b><span>${n===1?'rule':'rules'}<br>written</span></div>
            <div class="a-rl-dots">${n ? Array.from({length:n},()=>'<i></i>').join('')
                                        : '<em>none yet</em>'}</div>
            <code>${esc(key)}</code></div>`,
    cap: [key.replace(/-/g,' ').replace(/^./,c=>c.toUpperCase())+'.', q],
  });
  const findCard = f => ({
    tone:'dark',
    art: `<div class="a-rl-find"><code>${esc(f.tag)}</code>
            <div class="a-rl-frs">${f.rows.map(r=>`<div class="a-rl-fr"><span>${esc(r[0])}</span><b>${esc(r[1])}</b></div>`).join('')}</div>
            <span class="a-rl-ff">${esc(f.foot)}</span></div>`,
    cap: f.cap,
  });
  const railScene = key => {
    const r = P.rails && P.rails[key]; if(!r) return '';
    const cards = key==='systems' ? r.cards.map(sysCard) : r.cards.map(findCard);
    return UI.rail({kicker:r.kicker, h:r.h, p:r.p, note:r.note, cards});
  };

  const byN = {}; P.steps.forEach(s => byN[s.n] = s);
  let di = 0;
  const body = P.scenes.map(sc => sc.photo ? photoScene(sc.photo)
                            : sc.rail  ? railScene(sc.rail)
                                       : dataScene(byN[sc.step], di++)).join('');

  const sheet = `<section class="a-cn-sheet" data-rv>
      <div class="a-cn-kicker">To generate</div>
      <h2 class="a-cn-h">${P.scenes.filter(x=>x.photo).length} frames, one style line.</h2>
      <p class="a-cn-lead">Hand this sheet to whoever generates the images. Nothing else on the page changes when they land.</p>
      <div class="a-cn-sheetstyle"><b>style line — goes in every prompt</b>${esc(P.photoStyle)}</div>
      <ol class="a-cn-sheetlist">${P.scenes.filter(x=>x.photo).map(x=>{const ph=P.photos[x.photo];
        return `<li><div class="a-cn-sheeth"><code>${esc(x.photo)}</code><span>${esc(ph.aspect)}</span><em>${esc(ph.h)}</em></div><p>${esc(ph.brief)}</p></li>`;}).join('')}</ol>
    </section>`;

  const close = P.close ? `<section class="a-cn-close" data-rv>
      <div class="a-cn-kicker">${esc(P.close.kicker)}</div>
      <h2 class="a-cn-h big">${esc(P.close.h)}</h2>
      <p class="a-cn-lead wide">${UI._md(P.close.p)}</p>
      <div class="a-cn-legend">${['program','ai','person'].map(k=>`<span class="a-cn-who ${UI.WHO[k].cls}">${esc(UI.WHO[k].label)}</span>`).join('')}</div>
    </section>` : '';

  return `<div class="a-cinema">
    <section class="a-cn-hero" data-rv>
      <div class="a-cn-kicker">${esc(P.kicker)}</div>
      <h1 class="a-cn-h1">${esc(P.title)}</h1>
      <p class="a-cn-lead wide">${UI._md(P.lead)}</p>
      <div class="a-cn-scroll"><span></span></div>
    </section>
    ${body}${sheet}${close}</div>`;
};

/* reveal on scroll — idempotent, safe to call after every render */
UI.cinemaInit = function(root){
  if(UI.railInit) UI.railInit(root);
  const els = (root||document).querySelectorAll('[data-rv]:not([data-rv-on])');
  if(!els.length) return;
  if(!('IntersectionObserver' in window)){ els.forEach(e=>e.setAttribute('data-rv-on','1')); return; }
  const io = new IntersectionObserver(es => es.forEach(e => {
    if(e.isIntersecting){ e.target.setAttribute('data-rv-on','1'); io.unobserve(e.target); }
  }), {rootMargin:'0px 0px -12% 0px', threshold:.08});
  els.forEach(e=>io.observe(e));
};

/* =====================================================================
   RAIL — UI.rail(cfg) (24-Sep-2026)

   The horizontal card slider: heading block, then a row of tall cards
   that scroll left to right, the next one always bleeding off the right
   edge so it is obvious there is more. Arrows, scroll-snap, keyboard,
   drag. Caption under each card is a bold lead-in then grey continuation.

   cfg = {kicker, h, p, note, cards:[{art|plate, cap:[lead, rest], tone}]}
   art   = an SVG/HTML string (real data)
   plate = {brief, aspect, tone} → a photo placeholder, same as the scenes
   ===================================================================== */
UI._railN = 0;
UI.rail = function(cfg){
  const id = 'rail'+(++UI._railN);
  const card = (c,i) => {
    const inner = c.plate ? UI.photoPlate(c.plate, null)
                          : `<div class="a-rl-art ${c.tone==='dark'?'dk':''}">${c.art||''}</div>`;
    return `<li class="a-rl-card" data-i="${i}">
      ${inner}
      <p class="a-rl-cap"><b>${esc(c.cap[0])}</b> ${esc(c.cap[1]||'')}</p>
    </li>`;
  };
  return `<section class="a-rl" id="${id}" data-rv>
    <div class="a-rl-head">
      <div>
        ${cfg.kicker?`<div class="a-cn-kicker">${esc(cfg.kicker)}</div>`:''}
        <h2 class="a-cn-h">${esc(cfg.h)}</h2>
        ${cfg.p?`<p class="a-cn-lead">${UI._md(cfg.p)}</p>`:''}
        ${cfg.note?`<p class="a-rl-note">${UI._md(cfg.note)}</p>`:''}
      </div>
      <div class="a-rl-arrows">
        <button class="a-rl-arw" data-d="-1" aria-label="Previous" disabled>${UI._chev(-1)}</button>
        <button class="a-rl-arw" data-d="1" aria-label="Next">${UI._chev(1)}</button>
      </div>
    </div>
    <ul class="a-rl-track" tabindex="0" aria-label="${esc(cfg.h)}">${cfg.cards.map(card).join('')}</ul>
  </section>`;
};
UI._chev = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="${d<0?'M15 5l-7 7 7 7':'M9 5l7 7-7 7'}"/></svg>`;

/* wiring — idempotent, safe after every render */
UI.railInit = function(root){
  (root||document).querySelectorAll('.a-rl:not([data-on])').forEach(rl => {
    rl.setAttribute('data-on','1');
    const track = rl.querySelector('.a-rl-track');
    const arws  = [...rl.querySelectorAll('.a-rl-arw')];
    const step  = () => { const c = track.querySelector('.a-rl-card'); if(!c) return track.clientWidth*.8;
                          const s = getComputedStyle(track); return c.getBoundingClientRect().width + parseFloat(s.columnGap||s.gap||0); };
    const sync  = () => { const max = track.scrollWidth - track.clientWidth - 2;
                          arws[0].disabled = track.scrollLeft <= 2;
                          arws[1].disabled = track.scrollLeft >= max; };
    arws.forEach(b => b.addEventListener('click', () => {
      track.scrollBy({left: step() * (+b.dataset.d), behavior:'smooth'});
    }));
    track.addEventListener('scroll', sync, {passive:true});
    track.addEventListener('keydown', e => {
      if(e.key==='ArrowRight'){ e.preventDefault(); track.scrollBy({left:step(), behavior:'smooth'}); }
      if(e.key==='ArrowLeft'){  e.preventDefault(); track.scrollBy({left:-step(),behavior:'smooth'}); }
    });
    /* drag to scroll — pointer events, so it works with a trackpad or a touch screen */
    let down=false, x0=0, l0=0;
    track.addEventListener('pointerdown', e => { if(e.pointerType==='mouse'&&e.button!==0) return;
      down=true; x0=e.clientX; l0=track.scrollLeft; track.classList.add('drag'); });
    track.addEventListener('pointermove', e => { if(!down) return;
      const dx=e.clientX-x0; if(Math.abs(dx)>3) track.scrollLeft = l0-dx; });
    const up = () => { down=false; track.classList.remove('drag'); };
    track.addEventListener('pointerup', up); track.addEventListener('pointerleave', up);
    sync(); requestAnimationFrame(sync); new ResizeObserver(sync).observe(track);
  });
};

/* =====================================================================
   TOP TABS — UI.topTabs(cfg) (24-Sep-2026)

   The project is ONE entry in the left rail. Everything inside it is
   reached from a centred selector bar at the top, not from a second
   list on the left. Two navigations for one thing is two places to be
   wrong; this removes one of them.

   cfg = {tabs:[{key,label,sub}], active, onclick}
   ===================================================================== */
UI.topTabs = function({tabs=[], active='', onclick='selectTab'}={}){
  return `<nav class="a-tt" aria-label="Project sections"><div class="a-tt-in">${
    tabs.map(t=>`<button class="a-tt-b${t.key===active?' on':''}" data-k="${esc(t.key)}"
      ${t.key===active?'aria-current="page"':''} onclick="${onclick}('${esc(t.key)}')">${esc(t.label)}</button>`).join('')
  }</div></nav>`;
};

/* =====================================================================
   NOW — UI.nowPage(N) (24-Sep-2026)
   Where the thing actually stands today. Every figure re-queried live,
   and anything not true yet says so rather than being left out.
   ===================================================================== */
UI.nowPage = function(N){
  if(!N) return '';
  const bar = r => {
    const pct = r.total ? Math.round(r.done/r.total*100) : 0;
    return `<div class="a-nw-row">
      <div class="a-nw-rh"><b>${esc(r.h)}</b><span>${esc(r.note||'')}</span></div>
      <div class="a-nw-track"><i style="width:${pct}%" class="${r.state||''}"></i></div>
      <div class="a-nw-rn"><b>${esc(r.label)}</b><span>${pct}%</span></div>
    </div>`;
  };
  return `<div class="a-cinema a-nowpg">
    <section class="a-cn-hero" data-rv>
      <div class="a-cn-kicker">${esc(N.kicker)}</div>
      <h1 class="a-cn-h1">${esc(N.title)}</h1>
      <p class="a-cn-lead wide">${UI._md(N.lead)}</p>
    </section>
    <section class="a-nw" data-rv>
      <div class="a-nw-stats">${N.stats.map(s=>`<div><b>${esc(s.n)}</b><span>${esc(s.l)}</span><em>${esc(s.s||'')}</em></div>`).join('')}</div>
      <div class="a-nw-bars">${N.progress.map(bar).join('')}</div>
    </section>
    <section class="a-nw-open" data-rv>
      <div class="a-cn-kicker">${esc(N.open.kicker)}</div>
      <h2 class="a-cn-h">${esc(N.open.h)}</h2>
      <ol class="a-nw-list">${N.open.items.map(i=>`<li class="${i.blocked?'bl':''}">
        <b>${esc(i.h)}</b><p>${UI._md(i.p)}</p>${i.blocked?`<span class="a-nw-bl">blocked</span>`:''}</li>`).join('')}</ol>
    </section>
  </div>`;
};

/* =====================================================================
   SCENES — UI.scenesPage(cfg) (24-Sep-2026)

   The general form of the scroll cut. UI.cinemaPage is the hand-built
   version for "Step by step"; this one takes a plain list of scenes and
   is what the other pages use, so all of them read as one document.

   scene = {kicker, h, p, note, who}
     + at most one visual:  art (a UI.ART key) · plate (photo brief)
                            table {head, rows} · code · cards [{h,p}]
                            bars [{h, note, value, of, label, state}]
                            rail (a full UI.rail config)
     + stats [[n, label]]      shown under the text either way
     + kind:'lead'             a centred full-width statement, no visual
     + kind:'quote'            a single sentence, large, nothing else
   ===================================================================== */
UI._sceneVisual = function(s){
  if(s.plate) return UI.photoPlate(s.plate, null);
  if(s.art)   return `<div class="a-cn-artbox">${(UI.ART[s.art]||(()=>''))()}</div>`;
  if(s.table) return `<div class="a-sc-table"><table><thead><tr>${
      s.table.head.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${
      s.table.rows.map(r=>`<tr>${r.map((c,i)=>`<td${i===0?' class="k"':''}>${UI._md(String(c))}</td>`).join('')}</tr>`).join('')
    }</tbody></table></div>`;
  if(s.bars)  return `<div class="a-sc-bars">${s.bars.map(b=>{
      const pct = b.of ? Math.max(0,Math.min(100,Math.round(b.value/b.of*100))) : b.value;
      return `<div class="a-sc-bar"><div class="a-sc-barh"><b>${esc(b.h)}</b><span>${esc(b.label||'')}</span></div>
        <div class="a-sc-bart"><i class="${b.state||''}" style="width:${pct}%"></i></div>
        ${b.note?`<em>${esc(b.note)}</em>`:''}</div>`;}).join('')}</div>`;
  if(s.code)  return `<pre class="a-sc-code">${esc(s.code)}</pre>`;
  if(s.cards) return `<div class="a-sc-cards">${s.cards.map(c=>
      `<div class="a-sc-card"><b>${esc(c.h)}</b><p>${UI._md(c.p)}</p></div>`).join('')}</div>`;
  return '';
};
UI.scenesPage = function(C){
  if(!C) return '';
  let di = 0;
  const one = s => {
    if(s.rail) return UI.rail(s.rail);
    const stats = s.stats ? `<div class="a-cn-stats">${s.stats.map(([n,l])=>
        `<div><b>${esc(n)}</b><span>${esc(l)}</span></div>`).join('')}</div>` : '';
    const who = s.who && UI.WHO[s.who] ? `<div class="a-cn-who ${UI.WHO[s.who].cls}">${esc(UI.WHO[s.who].label)}</div>` : '';
    const txt = `${who}${s.kicker?`<div class="a-cn-kicker">${esc(s.kicker)}</div>`:''}
        ${s.h?`<h2 class="a-cn-h">${esc(s.h)}</h2>`:''}
        ${s.p?`<p class="a-cn-lead">${UI._md(s.p)}</p>`:''}
        ${stats}${s.note?`<p class="a-cn-note">${UI._md(s.note)}</p>`:''}`;

    if(s.kind === 'quote')
      return `<section class="a-sc-quote" data-rv><p>${UI._md(s.p)}</p>${s.by?`<span>${esc(s.by)}</span>`:''}</section>`;

    const vis = UI._sceneVisual(s);
    if(!vis || s.kind === 'lead')
      return `<section class="a-sc-lead" data-rv>${txt}${vis?`<div class="a-sc-wide">${vis}</div>`:''}</section>`;

    /* code and wide tables need more of the row than a 50/50 split gives */
    const wide = (s.code || (s.table && s.table.head.length > 3)) ? ' wide' : '';
    return `<section class="a-cn-scene dt${wide} ${di++%2?'flip':''}" data-rv>
      <div class="a-cn-txt">${txt}</div>
      <div class="a-cn-media"><div class="a-cn-stick">${vis}</div></div>
    </section>`;
  };
  const hero = `<section class="a-cn-hero" data-rv>
      ${C.kicker?`<div class="a-cn-kicker">${esc(C.kicker)}</div>`:''}
      <h1 class="a-cn-h1">${esc(C.title)}</h1>
      ${C.lead?`<p class="a-cn-lead wide">${UI._md(C.lead)}</p>`:''}
      ${C.heroStats?`<div class="a-sc-herostats">${C.heroStats.map(([n,l,s])=>
        `<div><b>${esc(n)}</b><span>${esc(l)}</span>${s?`<em>${esc(s)}</em>`:''}</div>`).join('')}</div>`:''}
    </section>`;
  const close = C.close ? `<section class="a-cn-close" data-rv>
      ${C.close.kicker?`<div class="a-cn-kicker">${esc(C.close.kicker)}</div>`:''}
      <h2 class="a-cn-h big">${esc(C.close.h)}</h2>
      ${C.close.p?`<p class="a-cn-lead wide">${UI._md(C.close.p)}</p>`:''}
    </section>` : '';
  return `<div class="a-cinema a-scenes">${hero}${(C.scenes||[]).map(one).join('')}${close}</div>`;
};

/* =====================================================================
   STORY → SCENES — UI.storyScenes(S) (24-Sep-2026)

   The long-form pages (The problem · How it was built) re-cut as a
   scroll story WITHOUT copying their text into a second file. story.js
   stays the single source; this reads it and decides the form:

     section body            → a centred statement scene
     section.table           → a wide table scene
     section.cards (4+)      → a horizontal rail
     section.cards (2-3)     → a card grid under the statement
     section.steps           → numbered cards

   Change a word in story.js and both the old page and this one follow.
   ===================================================================== */
UI.storyScenes = function(S){
  if(!S) return null;
  const scenes = [];
  (S.sections||[]).forEach(sec => {
    const cards = sec.cards || null;
    const many  = cards && cards.length >= 4;
    const railOnly = many && !sec.table && !sec.steps;   // the rail can carry the heading itself

    if(!railOnly) scenes.push({
      kind:'lead', kicker:sec.kicker, h:sec.h, p:sec.body || '',
      cards: (cards && !many) ? cards : undefined,
    });

    if(sec.table) scenes.push({kicker:'The numbers', h:sec.tableH || 'Counted on the live database, not estimated.',
                               table:sec.table});

    if(sec.steps) scenes.push({kind:'lead', cards: sec.steps.map(t=>({h:`${t.n}. ${t.h}`, p:t.p}))});

    /* a heading appears once: on the rail when the rail is the whole section,
       on the statement above it when the section also carries a table or steps */
    if(many) scenes.push({rail:{
      kicker: railOnly ? sec.kicker : '',
      h:      railOnly ? sec.h : (sec.railH || 'In detail'),
      p:      railOnly ? (sec.body || '') : '',
      cards: cards.map(c => ({
        art: `<div class="a-rl-note"><b>${esc(c.h)}</b><p>${UI._md(c.p)}</p></div>`,
        cap: [c.h + '.', ''],
      })),
    }});
  });
  return {
    kicker: S.kicker, title: S.title, lead: S.lead,
    heroStats: (S.stats||[]).map(x => [x.n, x.l, x.s]),
    scenes,
  };
};

/* =====================================================================
   SKILLS → SCENES — UI.skillScenes(S) (24-Sep-2026)

   Same principle as UI.storyScenes: skills.js stays the one source, and
   this decides the form. The four anatomy parts become a rail; each
   skill gets a statement, a file rail, its numbered steps and a table
   of what it writes.
   ===================================================================== */
UI.skillScenes = function(S){
  if(!S) return null;
  const scenes = [];

  scenes.push({rail:{
    kicker:'What a skill is made of', h:'Four parts. Two are code, two are words.',
    p:'A skill is not a script and not a prompt. It is both, kept in one folder, so the thing that was learned lives next to the thing that runs.',
    cards: S.anatomy.map(a => ({
      art:`<div class="a-rl-note">${UI._partIcon(a.k)}<b>${esc(a.h)}</b><p>${UI._md(a.p)}</p></div>`,
      cap:[a.h+'.', ''],
    })),
  }});

  S.skills.forEach(k => {
    scenes.push({kind:'lead', kicker:`Skill ${k.n} · ${k.tag}`, h:k.name, p:k.line,
                 note:'`'+k.path+'`'});

    scenes.push({rail:{
      kicker:'What is in the folder', h:'Every file, and what it is for.',
      /* the file rows are [name, meta, what-it-does] for scripts and
         [name, what-it-does] for everything else — read them that way
         or a card ends up saying nothing but "282" */
      cards: k.parts.flatMap(pt => pt.files.map(f => {
        const body = f[2] || f[1], meta = f[2] ? f[1] : '';
        return {
          art:`<div class="a-rl-note"><span class="a-rl-kind ${UI.PART[pt.k].cls}">${esc(UI.PART[pt.k].label)}</span>
                <b><code>${esc(f[0])}</code></b><p>${esc(body)}</p>${meta?`<em>${esc(meta)}</em>`:''}</div>`,
          cap:[f[0], body],
        };
      })),
    }});

    scenes.push({kind:'lead', kicker:'The procedure, in order', h:`${k.steps.length} steps, every time.`,
                 cards: k.steps.map((t,i)=>({h:String(i+1), p:t}))});

    scenes.push({kicker:'What it writes', h:'Where the output lands.',
                 table:{head:['table','what goes in it'], rows:k.writes.map(w=>[ '`'+w[0]+'`', w[1] ])}});
  });

  if(S.split) scenes.push({kind:'lead', kicker:S.split.kicker, h:S.split.h, p:S.split.p});
  if(S.change) scenes.push({kicker:S.change.kicker, h:S.change.h,
    table:{head:['', 'before', 'after'], rows:S.change.rows}});
  if(S.next) scenes.push({kind:'lead', kicker:S.next.kicker, h:S.next.h, p:S.next.p});

  return {kicker:S.kicker, title:S.title, lead:S.lead, scenes};
};
