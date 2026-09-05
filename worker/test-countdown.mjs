/* The draft countdown's own arithmetic.
 *
 *   node worker/test-countdown.mjs
 *
 * Lives beside the worker's other offline suites rather than in tests/,
 * because it needs no browser: web/src/lib/countdown.js is a plain module
 * with no React in it, which is the whole reason the phase decision was put
 * there instead of inside the component.
 *
 * What this is really guarding is one mistake. Both platforms keep the
 * scheduled time after the draft has run — Sleeper leaves `start_time` on a
 * completed draft, ESPN leaves `draftSettings.date` behind `drafted: true` —
 * so a countdown built on the instant alone counts confidently down to a
 * draft that happened last month. Every "complete" case below is that bug.
 */

import { countdownParts, draftPhase } from "../web/src/lib/countdown.js";

let failures = 0;
function check(what, got, want) {
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a === b) {
    console.log("ok  " + what);
  } else {
    failures++;
    console.log("x   " + what + "\n      expected " + b + "\n      received " + a);
  }
}

const NOW = 1788900000000;               // a fixed instant, so nothing here is time-dependent
const MIN = 60000, HOUR = 60 * MIN, DAY = 24 * HOUR;

console.log("--- the strings ---");
check("days lead when there are any", countdownParts(4 * DAY + 6 * HOUR + 14 * MIN + 31000),
      { compact: "4D 06:14", full: "4D 06:14:31" });
check("and are dropped when there are none", countdownParts(6 * HOUR + 14 * MIN + 31000),
      { compact: "06:14", full: "06:14:31" });
check("under a minute still reads", countdownParts(9000), { compact: "00:00", full: "00:00:09" });
check("exactly zero is not a countdown", countdownParts(0), null);
check("nor is a negative one", countdownParts(-1000), null);
/* A missing draftAt arrives here as NaN through the subtraction. A frozen
   "NaND NaN:NaN" is the shape of bug this project's own sweep looks for. */
check("nor is NaN", countdownParts(NaN), null);

console.log("\n--- the phases ---");
check("a future draft counts down",
      draftPhase(NOW + 3 * DAY, "pre_draft", NOW).phase, "soon");
check("and carries the parts",
      draftPhase(NOW + 3 * DAY, "pre_draft", NOW).parts.compact, "3D 00:00");

check("a draft happening now does not count", draftPhase(NOW + DAY, "drafting", NOW),
      { phase: "drafting", parts: null });

/* The bug this file exists for, from both directions: a completed draft
   whose stored time is in the past, and one whose time is somehow ahead.
   Neither may produce a countdown. */
check("a completed draft with a past time is complete, not late",
      draftPhase(NOW - 30 * DAY, "complete", NOW), { phase: "complete", parts: null });
check("a completed draft with a FUTURE time is still complete",
      draftPhase(NOW + 30 * DAY, "complete", NOW), { phase: "complete", parts: null });

check("a scheduled time that has passed is late, not a negative countdown",
      draftPhase(NOW - HOUR, "pre_draft", NOW), { phase: "late", parts: null });
check("a league with no draft scheduled draws nothing",
      draftPhase(null, "pre_draft", NOW), { phase: "none", parts: null });
check("and neither does one with no status at all",
      draftPhase(null, null, NOW), { phase: "none", parts: null });

/* A time with an unknown status is still a time. Yahoo and CBS will arrive
   with their own vocabularies, and the failure mode to avoid is a countdown
   that silently stops working for a new provider rather than one that
   counts. */
check("an unrecognised status with a future time still counts",
      draftPhase(NOW + DAY, "whatever_yahoo_says", NOW).phase, "soon");

console.log("\n--- the boundary ---");
check("one second before the draft still counts",
      draftPhase(NOW + 1000, "pre_draft", NOW).phase, "soon");
check("on the instant itself it is late, not a frozen zero",
      draftPhase(NOW, "pre_draft", NOW).phase, "late");

console.log(failures ? `\nFAIL — ${failures} failing` : "\nOK — the draft countdown");
process.exit(failures ? 1 : 0);
