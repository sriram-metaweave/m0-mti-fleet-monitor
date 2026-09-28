/* "Step by step" — the chain, in short factual sentences with worked examples.
   Every number and every tag value below is real (Atlas Leader, 07-Jul-2026 walkaround, live database 24-Sep-2026). */
const PROCESS = {
  kicker: 'Step by step',
  title: 'From a folder of spreadsheets to one answer.',
  lead: 'Twelve steps, in the order an engineer would do them by hand. Each step says who does it. All numbers are from Atlas Leader.',
  steps: [
    {n:1, who:'received', kicker:'What arrives', h:'One zip. 1,830 files.',
     p:'1,820 filled checklists. 8 blank master forms. 2 noon-report exports. October 2020 to July 2026.',
     art:'files', stats:[['1,830','CSV files'],['5.7','years'],['19 MB','one archive']]},

    {n:2, who:'received', kicker:'File type 1', h:'The master: the blank form.',
     p:'One row per parameter: id, name, unit or expected state, minimum, maximum.',
     art:'master', code:'M0 Configuration Data, 9531739_202604111901, 9531739, 1267\n"9531739_972","Fire Alarm Panel Power lamp","On","",""\n"9531739_827","F.O Service Tank Level","m³","",""',
     note:'Minimum and maximum are blank on 1,247 of the 1,267 rows.'},

    {n:3, who:'received', kicker:'File type 2', h:'The check: id, value, time.',
     p:'Nothing else. No name, no unit, no range. The header names the master it belongs to.',
     art:'check', code:'M0 Data, 9531739_202604111901, 9531739, 202607071859, 20260707, 1267\n"9531739_972","ON","20260707090312"\n"9531739_827","26","20260707094401"'},

    {n:4, who:'program', kicker:'Step 1', h:'Join each check to its own master.',
     p:'Match on the version the check names. One tag id, two files, one reading.',
     art:'join', note:'Join to the wrong version and the values line up against the wrong machinery.'},

    {n:5, who:'program', kicker:'Step 2', h:'The master changes without a schedule.',
     p:'Eight versions in 5.7 years. Two a day apart, then 33 months, then three in 13 months.',
     art:'versions', note:'On three of the five ships a tag id is later reused for different machinery.'},

    {n:6, who:'ai', kicker:'Step 3', h:'Work out what normal is.',
     p:'The form has almost no ranges. A normal is derived per tag from what the ship has recorded. Five shapes.',
     art:'range',
     note:'A derived range says what is unusual. It does not say what is unsafe.'},

    {n:7, who:'program', kicker:'Step 4', h:'Check the readings first.',
     p:'Some values cannot be real. Some are blank. Many are words, not numbers.',
     art:'validate', stats:[['3,891','pressures above 50 MPa'],['19','empty checklists'],['630','days with two checklists']]},

    {n:8, who:'program', kicker:'Step 5', h:'Add the noon report.',
     p:'It says what the ship was doing: at sea, in port or in harbour, plus load, speed and fuel burned.',
     art:'noonrule',
     note:'The same reading is acceptable in port and not at sea. The rule needs to know which.'},

    {n:9, who:'program', kicker:'Step 6', h:'The noon report also sets the fuel limit.',
     p:'A tank level alone means nothing. Measured against the day’s burn it becomes hours of running.',
     art:'fuelmath'},

    {n:10, who:'ai', kicker:'Step 7', h:'Give every tag a system.',
     p:'System and equipment per tag. Ten systems. The model proposes from the name, a person corrects it.',
     art:'classify', stats:[['1,267','tags'],['10','systems'],['24','equipment groups']]},

    {n:11, who:'person', kicker:'Step 8', h:'Write the checks a Chief makes.',
     p:'Per system: which readings matter, what each must read, hard stop or confirm, and what to do if not met.',
     art:'matrix',
     note:'A hard stop alone forbids unmanned running. Everything else is weighted.'},

    {n:12, who:'program', kicker:'Step 9', h:'The arithmetic, on one walkaround.',
     p:'07 July 2026, at sea. 40 rules applied. 35 met. No hard stop failed.',
     art:'math',
     note:'Risk orders what is left to confirm. It never overrides a hard stop.'},
  ],
  close: {
    kicker:'Who does what',
    h:'Six steps are a program. Two the model proposes. Two a person decides.',
    p:'Joining, validating, classifying and computing are the same every time, so they are code. Deriving a normal and proposing a rule need judgement, so the model drafts and a person confirms. Setting a limit, choosing a hard stop and signing the answer are not automated.',
  },
};

/* =====================================================================
   CINEMA CUT (24-Sep-2026) — the same twelve steps, re-ordered as a
   scroll story: "the room that is trusted to be empty".

   Photography carries the place and the human stake. Graphics carry the
   answer. The reader alternates place → data → place → data.

   Nothing here replaces PROCESS.steps — UI.processPage still reads those.
   UI.cinemaPage reads PROCESS.scenes and pulls each step by its number.
   ===================================================================== */

/* One style line goes into EVERY image prompt. Without it twelve good
   images still read as a stock collage. */
PROCESS.photoStyle =
  'Documentary photograph, wide angle, available light only. Cool steel greys against warm sodium lamps. ' +
  'Slight grain, shallow contrast, no colour grading tricks. No text anywhere in frame — no signage, no hull ' +
  'markings, no funnel logo, no nameplates. No company livery. Faces away from camera or out of frame. Shot on 35mm.';

PROCESS.photos = {
  dawn: {
    kicker: '05:00',
    h: 'Every morning, someone walks the room.',
    p: 'About 1,300 readings, by hand, on one walkaround. Then the Chief Engineer decides whether the space can be left alone for the next eight hours.',
    brief: 'Wide interior of a large car-carrier machinery space at dawn. One figure in overalls walking away from camera, small in the frame, dwarfed by the main engine. Overhead sodium lamps, blue morning light from a skylight grating above.',
    aspect: '21:9', tone: 'dark', fullbleed: true,
  },
  gauge: {
    kicker: 'Where the numbers come from',
    h: 'A person, a gauge, a clipboard.',
    p: 'Every value in this system started as somebody reading a dial and writing it down. Nothing is telemetered.',
    brief: 'Close-ish but not macro: a gloved hand holding a clipboard beside a bank of analogue pressure gauges. Gauge faces deliberately out of focus so no numbers are legible. Warm lamp light from the left.',
    aspect: '16:9', tone: 'dark',
  },
  sea: {
    kicker: 'Context',
    h: 'The same reading means two different things.',
    p: 'At sea at fourteen knots, or alongside with the main engine cold. The noon report is the only thing that knows which.',
    brief: 'A large car carrier at sea from a low exterior angle, mid-afternoon, moderate swell. Plain hull, no markings, no funnel logo. Horizon low in frame, lots of sky.',
    aspect: '21:9', tone: 'light', fullbleed: true,
  },
  chief: {
    kicker: 'Judgement',
    h: 'A rule is written by someone who has been in the room.',
    p: 'The model can propose what normal looks like. It cannot decide what is unsafe. That signature stays human.',
    brief: 'An engine control room at night. A figure seen from behind at a console of mimic panels and indicator lamps. Screens glowing but unreadable. No text on any panel.',
    aspect: '16:9', tone: 'dark',
  },
  empty: {
    kicker: 'The answer',
    h: 'Nobody is in this room. That is the point.',
    p: 'Machinery running, lights on, the space trusted for eight hours. This is the only photograph in the project that nobody can actually take.',
    brief: 'The same machinery space as the opening frame, now completely empty of people. Lights on, machinery clearly running, steam visible. Identical camera position and lens to the dawn frame so the two read as a matched pair.',
    aspect: '21:9', tone: 'dark', fullbleed: true,
  },
};

/* Motion slots — where a still diagram is weaker than a five-second move.
   Rendered as a labelled placeholder until the Hyperframes composition
   is built; the real-data SVG shows underneath either way. */
PROCESS.motion = {
  2:  'The spreadsheet scrolling — 1,267 rows going past, then stopping on the two columns that are empty on 1,247 of them.',
  4:  'Two files sliding together from opposite sides. One tag id locking onto its twin. The value snapping into the named row.',
  5:  'The eight master versions landing on a timeline, uneven — two a day apart, then a 33-month gap, then three in 13 months.',
  12: 'The tally counting up rule by rule, weights accumulating, and the verdict resolving last.',
};

PROCESS.scenes = [
  {photo:'dawn'},
  {step:1},
  {step:2}, {step:3},
  {photo:'gauge'},
  {step:4}, {step:5},
  {step:6}, {step:7},
  {photo:'sea'},
  {step:8}, {step:9}, {step:10},
  {photo:'chief'},
  {step:11}, {step:12},
  {photo:'empty'},
];

/* =====================================================================
   RAILS — horizontal card sliders. Two of them, both real.

   systems  the ten clusters, with the question each one answers and the
            number of UMS rules actually written against it today
            (.claude/skills/mti-t1-data-pipeline/rules/ums/9531739.json, v2)
   findings what the chain has actually caught. Every value below appears
            in a real case file.
   ===================================================================== */
PROCESS.rails = {
  systems: {
    kicker: 'The ten systems',
    h: 'A walkaround is 1,267 readings. Nobody judges 1,267 things.',
    p: 'Every tag is put into one of ten systems, and each system answers one question. The same ten work on all five ships — the tag numbers differ, the question does not.',
    note: 'Rule counts are the UMS rules written for Atlas Leader so far. Nine of the ten have at least one.',
    cards: [
      ['safety-environmental',        9, 'Is the fire and bilge protection armed, and silent?'],
      ['power-generation-electrical', 7, 'If a generator drops, do the lights stay on?'],
      ['main-engine-propulsion',      5, 'Will the ship keep moving?'],
      ['compressed-air-system',       5, 'Can the engine be started and the controls hold?'],
      ['fuel-lube-oil',               5, 'Is there fuel and oil, at the right pressure and temperature?'],
      ['boiler-steam',                3, 'Is steam there, and is the boiler safe unattended?'],
      ['cooling-freshwater',          3, 'Is the heat going somewhere?'],
      ['navigation-steering',         2, 'Can the bridge steer?'],
      ['hotel-auxiliary',             1, 'Is anything else about to stop the ship?'],
      ['exhaust-gas-cleaning',        0, 'Is the scrubber compliant?'],
    ],
  },
  findings: {
    kicker: 'What it caught',
    h: 'Four things nobody was looking for.',
    p: 'None of these is a value outside a range. Each one is a **combination** that should not exist — which is why a min/max check would never have found it.',
    cards: [
      { tag:'9531739_972 · Atlas Leader', rows:[['panel lamp','ON'],['its own state','Off']],
        foot:'10+ dates', cap:['Fire alarm panel disagrees with itself.',
        'Both values are legal on their own. The disagreement is the fault — and it is the fire detection panel.'] },
      { tag:'cylinder #3 · Atlas Leader', rows:[['feed rate','0.85'],['and again','0.85']],
        foot:'7 consecutive dates', cap:['A number that never moves.',
        'Not out of range — too in range. May be a quantization artifact of the ECL TEN-KEY system, so it is filed as worth a physical check, not a root cause.'] },
      { tag:"Em'cy fire pump · Altair Leader", rows:[['pump','Ready'],['exhaust fan','Stop']],
        foot:'armed, unventilated', cap:['A pump ready to run in a space with the fan stopped.',
        'Somebody chose that, or forgot it. Either way it should be deliberate.'] },
      { tag:'No.1 D/G · Altair Leader', rows:[['looks','available'],['would start','no']],
        foot:'07 Sep 2026 run', cap:['A generator that only looks ready.',
        'Stuck in a non-auto-ready standby configuration. Found by comparing dates, not by reading one sheet.'] },
    ],
  },
};

/* the two rails take their place in the scroll order */
PROCESS.scenes = [
  {photo:'dawn'},
  {step:1}, {step:2}, {step:3},
  {photo:'gauge'},
  {step:4}, {step:5}, {step:6}, {step:7},
  {photo:'sea'},
  {step:8}, {step:9}, {step:10},
  {rail:'systems'},
  {photo:'chief'},
  {step:11}, {step:12},
  {rail:'findings'},
  {photo:'empty'},
];
