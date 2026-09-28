/* "Now" — where the thing actually stands.
   Every figure below was re-queried live against nyk_mti on 24-Sep-2026.
   Anything that is not true yet says so here rather than being left out. */
const NOW = {
  kicker: 'Now',
  title: 'Where it stands, 24 September 2026.',
  lead: 'The chain runs end to end on real data. One ship can be judged. **Nothing is signed** — every rule and every range is proposed until a named person confirms it.',

  stats: [
    {n:'10,022,098', l:'readings loaded and judged', s:'m0_check_reports.check_readable'},
    {n:'7,623',      l:'walkarounds on file',        s:'5 vessels · 2017–2026'},
    {n:'58',         l:'master versions',            s:'8 to 20 per ship'},
    {n:'41',         l:'UMS rules written',          s:'62 tags · Atlas Leader'},
  ],

  progress: [
    {h:'Checklist data loaded',   note:'all five vessels',              done:7623,  total:7623,  label:'7,623 / 7,623'},
    {h:'Tags classified',         note:'into ten systems, per version', done:75928, total:75928, label:'75,928'},
    {h:'Ranges derived',          note:'2 of 5 ships have any',         done:2,     total:5,     label:'2 / 5 ships',  state:'part'},
    {h:'Ranges confirmed by a person', note:'1,109 still flagged for review', done:9763, total:10872, label:'9,763 / 10,872', state:'part'},
    {h:'UMS rules written',       note:'Atlas Leader only',             done:1,     total:5,     label:'1 / 5 ships',  state:'part'},
    {h:'Rules signed off',        note:'nobody has confirmed one yet',  done:0,     total:41,    label:'0 / 41',       state:'none'},
    {h:'Running on a schedule',   note:'13 agents exist, heartbeats off', done:0,   total:1,     label:'not running',  state:'none'},
  ],

  open: {
    kicker: 'What is left',
    h: 'Seven things, in the order they matter.',
    items: [
      {h:'A Chief Engineer signs the 13 hard stops.',
       p:'A hard stop is the only thing that can forbid unmanned running. Until each one carries a name and a date, the verdict is a strong opinion and not an answer.'},
      {h:'Four alarm setpoints.',
       p:'They cannot be derived. The ship never reaches an alarm value, so eight years of history cannot reveal it. These have to come from the machinery manuals or from the Chief.'},
      {h:'1,109 ranges reviewed.',
       p:'968 on Atlas Leader, 141 on Altair Leader. About a minute each for someone who knows the ship — three or four days of real work, and it cannot be delegated to the machine, because the machine is the thing being checked.'},
      {h:'Ranges derived for the other three ships.',
       p:'Frontier Explorer, NYK Vega and Tsugaru load and display perfectly and **cannot be judged**. They return `NO RULES`, which is honest and will look like a gap in a demonstration.'},
      {h:'The two tables created.',
       p:'`ums_criteria` and `ums_verdict` are written, reviewed and rolled back-able. The IAM user has USAGE and not CREATE on `m0_check_reports`, so the owner has to run the grant first.',
       blocked:true},
      {h:'A settings screen for ranges and rules.',
       p:'Today a correction means editing a file or a row, which means an engineer waits for someone with database access. For 60 ships that is the wrong shape — and MTI owning the rules is the whole point of the engagement.'},
      {h:'The weekly routine running again.',
       p:'The last clean run was 07-Sep and it found four real cross-date faults. The 21-Sep attempt was cancelled mid-run and the cause has not been identified. This is the single change that turns a demonstration into a service.'},
    ],
  },
};
