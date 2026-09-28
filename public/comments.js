/* =====================================================================
   COMMENTS — the words on the cards. Text is data: edit here, never in code.
   Key = card id (see the list below). An empty or missing key means the
   card falls back to its generated sentence. Write plain sentences; one
   or two lines; say what the reader should do or watch.

   Keys the app looks up today:
     overview.openItems.<YYYY-MM-DD>   Overview "Open items" card, per analysed check
     noon.<YYYY-MM-DD>                 "Position & voyage" strip, per noon report date
     tag.<tag_id>                      the tag's History card (tag detail) and, by default, its finding cards
     finding.<period>|<index>.<tag_id> a finding's supporting card for one tag (overrides tag.<id>)
     vessel.<slug>.health              the health card on the other four vessels
   Started 23-Sep-2026 for the 07 Jul 2026 check (202607071859). The three
   below are drafts written from facts already in the analysis — replace freely.
   ===================================================================== */
const COMMENTS = {
  "overview.openItems.2026-07-07": "One item needs a physical check this week: No.1 D/G is not confirmed auto-standby-ready. The other five open items are data-quality or recurring reads, not new faults.",
  "tag.9531739_999": "Draft — the lamp has read ON on every check since April against a recorded Off state; the analysis now treats it as ambiguous, not a confirmed defect. A five-minute look at the panel settles it.",
  "tag.9531739_236": "Draft — cylinder #3 has sat at 0.85 g/PSh since early May while the other seven sit at 0.65–0.70. Consistent with a post-overhaul dosing taper; worth confirming with the ECL setting, not the sensor.",
  "tag.9531739_1160": "",
  "noon.2026-07-07": "",
  "vessel.altair-leader.health": "",
  "vessel.frontier-explorer.health": "",
  "vessel.tsugaru.health": "",
  "vessel.nyk-vega.health": ""
};
