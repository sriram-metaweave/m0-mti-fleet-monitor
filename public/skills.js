/* "The two skills" — what each one is made of, and what it writes. File names, line counts and step lists are
   read from the real skills (24-Sep-2026): .claude/skills/mti-t1-data-pipeline and .../mti-t1-system-analysis */
const SKILLS = {
  kicker: 'The two skills',
  title: 'One skill loads and judges. One reads and writes. Both are a prompt plus scripts plus rules.',
  lead: 'A skill is not a model with a clever instruction. It is four things kept apart on purpose: a written procedure, scripts that never vary, rules a person owns, and reference notes. Here is exactly what is in each.',
  anatomy: [
    {k:'prompt',  h:'The procedure', p:'SKILL.md — numbered steps, what to do when something is missing, and how to report. This is what the model reads.', icon:'doc'},
    {k:'script',  h:'The scripts',   p:'Python. Deterministic, testable, and identical every run. The model calls them; it does not reimplement them.', icon:'code'},
    {k:'rules',   h:'The rules',     p:'Data, one file per vessel. Written by a person, validated by a script, never invented by the model.', icon:'rules'},
    {k:'ref',     h:'The references',p:'Why it was built this way, the patterns already discovered, and the filing contract. Read when something looks wrong.', icon:'ref'},
  ],
  skills: [
    {
      n:1, name:'mti-t1-data-pipeline', tag:'loads and judges',
      path:'.claude/skills/mti-t1-data-pipeline',
      line:'Turns a folder of spreadsheets into queryable, judged readings. Nothing here is an opinion.',
      parts:[
        {k:'prompt', files:[['SKILL.md','193 lines · 8 steps']]},
        {k:'script', files:[
          ['load_master_versions.py','282','reads each M0Master, one row per tag per version'],
          ['load_check_files.py','282','reads each M0Check, joins it to the version it declares'],
          ['load_noon_report.py','129','unpacks the daily noon report into rows'],
          ['classify_engine.py','106','applies a vessel rules list — never invents a rule'],
          ['threshold_lookup.py','211','the single judge of in_range, five threshold shapes'],
          ['backfill_in_range.py','114','re-judges every reading after a threshold changes'],
          ['ums_rules.py','133','loads, validates and exports the UMS rules'],
          ['verify_load.py','150','checks the load before anything is marked done'],
          ['check_progress.py','369','what is loaded, what is next'],
        ]},
        {k:'rules', files:[
          ['rules/9531739.py','192','tag classification, Atlas Leader'],
          ['rules/9454498.py','502','tag classification, Tsugaru'],
          ['rules/TEMPLATE.py','50','the contract for a new ship'],
          ['rules/ums/9531739.json','41 rules','the UMS checks, per vessel'],
          ['rules/ums/TEMPLATE.json','—','the contract for a new ship'],
        ]},
        {k:'ref', files:[['references/DESIGN-AND-HISTORY.md','61','why it is built this way'],['evals/trigger-eval.json','22','when this skill should fire']]},
      ],
      steps:['Resolve the vessel','Check what is already loaded','Run whatever is missing','Classify tags, per version','Write the case folder on disk','Verify before marking done','Log the run','Report plainly'],
      writes:[['m0_check_reports.check_raw','one row per filed checklist'],['m0_check_reports.check_readable','one row per reading, with in_range'],['m0_check_reports.master_tags','the tag list per version'],['m0_check_reports.tag_classification','system and equipment per tag'],['noon_report.readable','the voyage context']],
    },
    {
      n:2, name:'mti-t1-system-analysis', tag:'reads and writes',
      path:'.claude/skills/mti-t1-system-analysis',
      line:'Reads one walkaround system by system and writes what a Technical Superintendent needs to read.',
      parts:[
        {k:'prompt', files:[['SKILL.md','301 lines · 11 steps'],['story.md','74','the synthesis step, once per case']]},
        {k:'script', files:[
          ['office_filing.py','254','writes notes into the case file, the only supported path'],
          ['ensure_case_shell.py','121','makes sure the vessel-year case exists first'],
          ['write_analysis.py','183','one graded report per system'],
          ['write_postit.py','149','one post-it per distinct finding'],
          ['verify_analysis.py','134','groundedness — every claim tied to a reading'],
        ]},
        {k:'rules', files:[
          ['clusters/power-generation-electrical.md','63','is generator redundancy intact?'],
          ['clusters/main-engine-propulsion.md','80','is propulsion healthy and under remote control?'],
          ['clusters/safety-environmental.md','34','ready for a fire or pollution event?'],
          ['clusters/… 7 more','30–47','one file per system, each with the decision it answers'],
        ]},
        {k:'ref', files:[['references/living-office-case-filing.md','112','the filing contract'],['references/DESIGN-AND-HISTORY.md','30','why it is built this way']]},
      ],
      steps:['Ensure the case shell exists','Pick the cluster and pull its data','Pull the voyage context','Reason over it — what is not expected','Grade it: status and score','Write it, with evidence','Write one post-it per finding','Write the story, once per case','Verify groundedness','Log the run','Report plainly'],
      writes:[['living_office.note (report)','a graded analysis per system'],['living_office.note (postit)','one per finding, with the readings it cites'],['living_office.dossier','the vessel-year case and its narrative']],
    },
  ],
  split: {
    kicker:'Where the line falls inside a skill',
    h:'The prompt decides what to look at. The script decides the answer.',
    p:'Skill 1 has almost no judgement in it: joining, classifying and judging a reading are scripts, and the prompt only orders them and refuses to mark work done before verification passes. Skill 2 is the opposite: the scripts only write and verify, and the judgement — what is unexpected, what it means, how serious it is — is the model reading one system with the cluster question in front of it.',
  },
  change: {
    kicker:'What the two change',
    h:'Before and after, on the same walkaround.',
    rows:[
      ['A reading', '0.32 in a spreadsheet cell', 'No.1 Main LO Pump delivery, 0.32 MPa, below its 0.34 floor, fourth day falling, lowest of 592'],
      ['A system', 'a column of numbers to scan', 'Main engine: analyst score 82, UMS status GO WITH CONDITIONS, one rule not met, the reading behind it'],
      ['A day', 'a filed form', 'GO WITH CONDITIONS, risk 9, five things to confirm, no hard stop failed'],
      ['A year', '1,820 files in a folder', '1,820 verdicts you can scrub through, with the trend and the findings attached'],
    ],
  },
  next: {
    kicker:'What is still missing',
    h:'A third piece, or a step inside the first.',
    p:'Deriving a normal for every tag on a new vessel is the one part still done by hand. It is the natural next skill — or a step inside the loader — because it is the same work every time: sample a tag’s history, pick the shape, propose a band or a state set, and hand it to a person to confirm. Two of five ships have thresholds today.',
  },
};
