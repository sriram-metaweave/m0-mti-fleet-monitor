/* "One walkaround" — the whole chain on a single real check, in depth.
   Atlas Leader (9531739), 07-Jul-2026 18:59, at sea.
   Every number here is from that walkaround, its master version, its
   thresholds and its noon report. Source: UMS-GO-MATRIX.md part 2 —
   the by-hand pass over all 41 rules and what it found. */
const EXAMPLE = {
  kicker: 'One walkaround',
  title: 'One check, all the way down.',
  lead: 'Atlas Leader, 07 July 2026, at sea. 1,267 readings in, one sentence out — and every step in between, including the parts that went wrong.',
  heroStats: [
    ['1,267', 'readings taken', '07 Jul 2026 · 18:59'],
    ['40', 'rules applied', 'of 41 written'],
    ['35', 'met outright', '5 to confirm'],
    ['9', 'risk', 'GO WITH CONDITIONS'],
  ],

  scenes: [
    /* ---------- the input ---------- */
    {kind:'lead', kicker:'The input', h:'Two files and a noon report.',
     p:'The check names its own master version in its header, so it joins to the tag list that was in force that day — not to today’s.',
     stats:[['1,267','tags in the master'],['1,267','values in the check'],['1','noon report row']],
     code:'M0 Data, 9531739_202604111901, 9531739, 202607071859, 20260707, 1267\n"9531739_972","ON","20260707090312"\n"9531739_827","26","20260707094401"\n"9531739_552","0.32","20260707085417"'},

    {kicker:'What the noon report adds', h:'At sea, 43.8 tonnes a day.',
     p:'Speed, load and fuel burned. Without it a tank level is just a number; with it, the same number becomes hours of running.',
     who:'program',
     table:{head:['field','07 Jul 2026'], rows:[
       ['status','**AT SEA**'],['fuel oil consumption','43.8 t/day'],
       ['F.O service tank','26.0 m³'],['main engine','running']]},
     note:'A generator stopped in port is normal. The same reading at sea is not. The rule has to know which, and only this file knows.'},

    /* ---------- the rules ---------- */
    {kicker:'The rules', h:'40 of the 41 apply today.',
     p:'One is written `IN PORT` only, so it stands down. The rest are checked against this walkaround — 13 hard stops, 26 conditions, 1 coverage rule.',
     who:'person',
     bars:[
       {h:'Hard stops', label:'13 of 13 met', value:13, of:13, note:'Any one of these failing is a NO-GO on its own.'},
       {h:'Conditions', label:'21 of 26 met', value:21, of:26, state:'part', note:'Allowed, but someone has to look at the five.'},
       {h:'Coverage', label:'62 of 62 critical tags read', value:62, of:62, note:'100%. The answer is based on a complete walkaround.'},
     ]},

    /* ---------- the algorithm ---------- */
    {kicker:'The arithmetic', h:'Every rule scores, then the tiers decide.',
     p:'The number orders the work. It never overrules a tier — one hard stop failing is a NO-GO at any risk score, and a risk of 56 with no hard failure is not.',
     who:'program',
     code:'risk = Σ(weight × severity) ÷ Σ(weight) × 100\n\nseverity:   fail 1.0 · review 0.5 · unjudged 0.5 · not read 0.3\n\n  fire panel (1) other lamp   ON   vs Off       review   ½ × 5  =  2.5\n  all 3 D/G selectors Auto    0    vs Auto      not met  1  × 3  =  3.0\n  E/D/G standby lamp          ON   vs —         cannot   ½ × 2  =  1.0\n  M/E LO delivery pressure    0.32 vs ≥ 0.34    not met  1  × 4  =  4.0\n  No.2 air reservoir          Not in service    review   ½ × 4  =  2.0\n  ------------------------------------------------------------------\n  35 other rules met                                       =  0.0\n\n  12.5 risk points  ÷  136 total weight  × 100            =  9'},

    {kind:'quote', p:'**0.3 for a tag nobody read.** Scoring it zero would reward skipping the checklist. Scoring it 1.0 would make an incomplete walkaround look like a broken ship.'},

    /* ---------- the ROB rule ---------- */
    {kicker:'The one rule with real engineering in it', h:'Fuel on board is not a threshold. It is a calculation.',
     p:'A tank level alone means nothing. Measured against the day’s actual burn it becomes hours of running, and that can be compared to the eight hours the question asks about.',
     who:'person',
     code:'need = (rate ÷ 24) × hours_of_burn × margin ÷ density\n\n     = (43.8 ÷ 24) × 8 × 1.5 ÷ 0.98\n     = 22.3 m³  required\n\nhave = 26.0 m³   →  14.0 hours    PASS',
     note:'At the bottom of the observed band — 16.0 m³ — the same rule **fails**: that is only about 8.8 hours, less than the horizon plus margin, and yet it sits comfortably “in range”.'},

    /* ---------- where the bands disagree ---------- */
    {kicker:'The thing the by-hand pass existed to find', h:'“Unusual” and “unsafe” are not the same question.',
     p:'The derived bands answer *is this unusual*. A Chief Engineer asks *is this unsafe*. On this ship they disagree in three places, and for a hard stop the difference is the whole point.',
     table:{head:['check','observed band','engineering limit','why it matters'], rows:[
       ['F.O service tank','16.0–28.0 m³','≥ 22.3 m³ today','16.0 m³ is ~8.8 h of burn — under the horizon, yet “in range”'],
       ['Main air reservoirs','from 1.55 MPa','≥ 1.8 MPa','1.55 MPa is below what the required consecutive starts need'],
       ['M/E main LO pump','0.0–1.3 MPa','0.34 MPa (checklist’s own)','the band is widened by standby readings, so a real drop hides inside it']]}},

    /* ---------- the finding ---------- */
    {kicker:'What it caught', h:'0.32 MPa — the lowest of 592 readings.',
     p:'No.1 Main LO Pump delivery pressure, after a four-day decline. The analyst had scored Main Engine **82 SATISFACTORY** and never mentioned it.',
     who:'program',
     code:'30 Jun   0.34\n01 Jul   0.34\n04 Jul   0.33\n05 Jul   0.32\n06 Jul   0.32\n07 Jul   0.32   ← floor 0.34   lowest of 592 readings on file',
     note:'The matrix catches it because it holds one number against a floor. The analysis missed it because it was judging a system in general, and in general the main engine was fine.'},

    {kicker:'And a data fault inside the finding', h:'Two readings of 34.0 where 0.34 was meant.',
     p:'30 June and 01 July recorded **34.0** for the same tag — a lost decimal point, a hundred times the real value. Two readings out of 592.',
     who:'program',
     note:'Not a machinery fault. A loader note. Both kinds come out of the same pass, and both matter to somebody.'},

    /* ---------- the withdrawn hard stop ---------- */
    {kind:'lead', kicker:'The most important lesson', h:'The first NO-GO this system produced was wrong.',
     p:'That 0.34 was made a **hard stop**, and the verdict came out NO-GO. But 0.34 is the *normal operating range* printed on the checklist — not the low-pressure **alarm setpoint**. The alarm point lives in the engine manual and the ship’s SMS, and **it is not in this data at all**.',
     note:'The rule was re-tiered to a condition and marked `limit_source`. The card shows a small “limit needed” tag. The validator now **refuses any hard stop carrying a limit_source**, so the mistake cannot be made a second time.'},

    {kind:'quote', p:'Never invent a safety limit from a statistical band.', by:'the rule that came out of it'},

    /* ---------- reading conventions ---------- */
    {kicker:'Two conventions, both learned by getting them wrong', h:'Zero is not missing. A dash is not a gap.',
     p:'Both of these produced false findings in the first draft, and both are now written into the evaluator.',
     cards:[
       {h:'0 A on a pump means standby', p:'Not “broken”, not “not read”. The evaluator treats zero on a pair member as **idle**, which is what lets `one running, one standby` mean anything.'},
       {h:'“-” on a mixed tag means idle', p:'No.1 F.O purifier reads `-` while No.2 draws **11 A**. That is a correct running/standby pair. The first draft called it “not read” and scored it against the ship.'}]},

    /* ---------- the open question ---------- */
    {kicker:'One real question for the Chief', h:'No.2 Main Air Reservoir reads “Not in service”.',
     p:'One of two starting-air bottles is isolated, and that threshold row has never been reviewed by a person. This is exactly the kind of thing a Chief must know before going unmanned.',
     who:'person',
     table:{head:['','reading','rule'], rows:[
       ['No.1 main air reservoir','**in service**','≥ 1.8 MPa'],
       ['No.2 main air reservoir','**Not in service**','≥ 1.8 MPa'],
       ['threshold reviewed?','**no**','shows as a condition, never a fail']]},
     note:'It now shows as a condition with both bottles side by side, so the question is asked rather than averaged away.'},

    /* ---------- the result ---------- */
    {kind:'lead', kicker:'The answer', h:'GO WITH CONDITIONS · risk 9.',
     p:'No hard stop failed. Five things for a person to confirm, none of them a stay-manned order. That reads like a real Chief’s morning.',
     code:'ok   Navigation & steering          GO                   2/2\nok   Boiler & steam                 GO                   3/3\nok   Fuel & lube oil                GO                   5/5   ROB 26.0 m³ = 14.0 h ≥ 22.3 required\nok   Cooling & fresh water          GO                   3/3   one CFW pump running, one standby\nok   Hotel & auxiliary              GO                   1/1\n!!   Safety & environmental         GO WITH CONDITIONS   8/9   fire lamp (1) ON, threshold unreviewed\n!!   Power generation & electrical  GO WITH CONDITIONS   4/6   No.1 D/G selector 0 vs Auto\n!!   Main engine & propulsion       GO WITH CONDITIONS   4/5   LO delivery 0.32 — four-day decline\n!!   Compressed air                 GO WITH CONDITIONS   4/5   No.2 main air reservoir "Not in service"\n\n62 of 62 critical tags read · coverage 100 %'},

    /* ---------- honest assessment ---------- */
    {kind:'lead', kicker:'Honestly', h:'What is solid, and what is thin.',
     p:'Nine of the ten clusters carry rules. The three questions a Chief asks first — can I be told, will the lights stay on, can it steer and stop — are covered by named hard stops. Every rule opens its readings, and every reading opens its tag.'},

    {kicker:'What is thin', h:'Five gaps, stated plainly.',
     p:'None of these is hidden in the interface, and none of them is closed by more analysis.',
     cards:[
       {h:'Alarm setpoints are missing', p:'Until the engine manual and SMS numbers are on file, several checks that **should** be hard stops run as conditions. The single biggest gap — and it needs a document from the ship, not more code.'},
       {h:'Main engine is under-covered', p:'**402 tags, 5 rules.** Cylinder exhaust temperatures, turbocharger, jacket cooling and scavenge air are judged in the Systems tab but carry no UMS rule.'},
       {h:'In port is mostly unwritten', p:'**38 of 41** rules are `any` or `AT SEA`. In-port practice differs — shore power, boiler on, engine shut — and MTI has to say how.'},
       {h:'One vessel only', p:'The other four have no thresholds, so they honestly answer `NO RULES` rather than guessing a GO.'},
       {h:'Weights are judgement', p:'They order the conditions. They are **not** defensible as numbers yet. That is exactly what the confirmation loop is for.'}]},

    {kind:'quote',
     p:'A skill would have produced the 22 easy rules quickly — and would have made all three of the mistakes above.',
     by:'why the first pass was done by hand'},

    {kind:'lead', kicker:'The conclusion that shaped everything after it', h:'The skill drafts. It never decides.',
     p:'Propose rows with tiers and tag ids. Mark every safety limit it cannot source. Leave the confirmation to a person. All three of the errors found here — inventing a hard limit from a band, mis-reading a standby pump, mis-reading a mixed tag — are now written down as rules for the skill to follow.'},
  ],

  close: {
    kicker: 'One walkaround',
    h: '1,267 readings. 40 rules. One sentence.',
    p: 'And five things a person still has to look at — which is the honest shape of the answer, not a limitation of it.',
  },
};
