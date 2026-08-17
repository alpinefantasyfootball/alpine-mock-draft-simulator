# Design direction

Where Juke's design should go over the next year, and why. This is direction
rather than schedule — `BUSINESS-PLAN.md` and the MVP roadmap hold sequencing,
and `CLAUDE.md` holds the rules. Nothing here overrides either.

Rewritten August 2026. The version this replaces was a Sleeper review written
before anyone had an account there, and it opened by saying so: *"the interior
of the draft room is not reviewed here."* That caveat is now closed — both
products have been walked end to end, with a completed mock drafted on each,
and Sleeper's marketing site reviewed frame by frame from a screen recording.
It also still called the product Alpine.

---

## What has changed since the last version

Almost everything it recommended has shipped, which is the main reason it
needed replacing rather than amending.

| Recommended then | Now |
|---|---|
| A 16px base, to stop iOS zooming a focused field | Shipped, and the rule is a floor the whole type scale meets |
| Blue-tinted neutrals | Shipped, and the ramp is set from the worst surface upward rather than by eye |
| Dark mode via `prefers-color-scheme` | Shipped as two full themes with an explicit toggle |
| Pill radii on chips only | Shipped as five radii, divided by job |
| Scoring rules moved into the browser | Shipped — 38 rules, live rescoring of projections, history and the grade |
| Position-run detection on the board | Shipped — the ticker says "3 of the last 5 were running backs" |

Two claims in it are now simply wrong. It said `CLAUDE.md` ruled out live
multi-user drafting; that decision was reversed and shared rooms shipped. And
its feature-parity arithmetic ("six of eleven") counted a product that no
longer exists.

---

## Where Juke stands, measured

| | Sleeper | Juke today |
|---|---|---|
| Page background | `#05091D` | `#0E151E` dark · `#F5F7FA` light |
| Surfaces | `#131E2C`, `#192533` | `#18212D` dark · `#FFFFFF` light |
| Secondary text | blue-tinted | `#A2B0BE` / `#4C5763`, blue-tinted, contrast-derived |
| Display / body font | Poppins / Inter | Poppins / Inter |
| Base size | 16px | 16px |
| Type scale | not published | eight steps: 10 · 12 · 14 · 16 · 19 · 23 · 32 · 42 |
| Radii | pills plus 20–32px cards | five: 4 · 8 · 12 · 16 · pill |
| Themes | dark only | two, both designed |

**The typography was independently identical and still is** — Poppins over
Inter, the same pairing. That remains a signal that the type foundation is
sound and does not need touching.

The gap that closed is cohesion. The old note said Juke rendered 26 font sizes
and 15 radii, each chosen per element; the scales replaced them, and the audit
that proves it is one line in the console.

---

## What the comparison actually established

**Sleeper is a league platform that happens to have a good draft room.** It
competes with ESPN and Yahoo, it customises everything, and its draft room is
one surface of a much larger product. **Juke is a draft analyst** — a narrower
room wrapped around a grading model and a published method that Sleeper does
not have at all.

That framing is the most useful thing to come out of the review, because it
settles what parity is worth: almost nothing. The gaps that matter are the ones
that stop somebody drafting, not the ones that make a feature grid even.

### The correction worth recording

An earlier draft of this analysis led with **editable scoring** as Juke's
biggest advantage, on the evidence that Sleeper's mock-draft setup offers nine
ranking presets with no editable values.

That is true of the *mock flow* and false of the platform. A real Sleeper
league has full per-stat custom scoring, commissioner-editable across every
category including rare plays, with a forced recalculation of played weeks.
**Custom scoring is table stakes, not a moat.** What survives is narrow: Juke
lets you mock-draft against your exact rules without creating a league first.

It is recorded here because the failure is instructive rather than
embarrassing: one screen was generalised into a claim about a company, and it
flattered us. The differentiators that held up under first-hand review are all
in the layer *above* the draft.

---

## Four threads for the next year

These are open questions, not tasks. Each is worth a year of small decisions
pointing the same way.

### 01. Flat, or with depth — pick one

Juke is one plane. Cards on a background, everywhere. The Rooms door is the
first element in the product with any dimensionality, and that currently makes
it an outlier rather than a language.

Over a year this resolves in one of two directions, and it should be chosen
rather than arrived at: depth becomes a system, or the door is the exception
that proves the page is flat.

A depth system needs no photography. It needs the unglamorous parts — one
light source, agreed rules for what is near and what is far, and shadows that
share a direction. Juke's shadows were each picked locally: the door casts one
way, the cards another, the player sheet a third. Nobody notices any single one
of them, and the sum is what "designed" means.

**The spatial metaphor is already in the product's own vocabulary.** It is
called The Rooms. That is the argument for depth, and it is the kind of reason
that outlasts a trend.

### 02. There is no colour language for time

The palette encodes two things. **Position** — six solids, darkened until white
clears 4.5:1 on each. **Intent** — orange acts, blue states, one primary action
per screen.

Nothing encodes *when*. Juke is a seasonal product with six rooms strung across
pre-season, in-season and post-season, and the interface has no idea what time
of year it is. A season axis would be a genuine system-level addition: the door
placards already carry the phase as text, the header could know it, the rooms
list already groups by it.

The constraint is that the palette is close to full. A third axis has to be
carried by something other than hue — value, temperature, or a treatment rather
than a colour. That is a real design problem and a year is the right amount of
time for it.

### 03. Atmosphere is the honest gap

Juke's design is **clean and atmosphere-free**. That is an accurate description
rather than a criticism of any one decision: every rule in `CLAUDE.md` about
contrast, scales and tokens has made the product more legible, and none of them
has made it feel like a place.

Competitors solve this with stadium photography, chrome and neon. Those are
wrong for Juke — a turf-and-crowd backdrop is the most generic visual in fantasy
sports, it puts a busy photo behind text, and the landing page currently loads
no third-party image at all with a test asserting it.

**But "that's generic" is not an answer.** It is a test for filtering ideas, not
a substitute for having one. The version of this worth building reaches for
atmosphere through the one thing only Juke has: **the name is a football move.**
A juke is a feint, a cut, a change of direction, and it is already in the mark
as the swoosh. Motion that cuts rather than fades, direction changes, a beat of
misdirection before a reveal — that is a language available to Juke and to
nobody else in this market.

### 04. What the homepage becomes when the product remembers you

Today the landing page is a pitch, and it can afford to be, because there is
nothing to come back to. One `localStorage` slot, no account, no history.

The moment accounts and draft history exist, the homepage forks: a pitch for
strangers, something closer to a dashboard for people returning. That is a
design problem worth thinking about well before the accounts land, because it
changes what the page is *for* — and the answer determines whether the door and
the product shot stay above the fold or move below a "your leagues" surface.

---

## What to adopt from Sleeper's marketing site

Reviewed frame by frame. Every content section is **a claim paired with a moving
proof of that claim**, four times down the page. Juke's landing page is a hero,
the rooms, and a footer.

**Stage and list.** A persistent visual beside three or four labels, the
highlighted one advancing on a timer, the stage re-rendering to illustrate
whichever is current. The Rooms door is Juke's first instance of this shape.

**The stage should teach, not decorate.** Their best section shows a `'25
roster` beside a `'26 roster` and redraws per league type: redraft replaces
everyone, keeper carries two across wearing a `KEPT` badge, dynasty keeps all
five and adds a rookie pick. It explains what a keeper league *is* in two
seconds, to somebody who did not know. **That is the thing worth stealing** —
and Juke's equivalent question is "what is a Juke score and why is Gibbs 100",
which is exactly the confusion that started this work.

**Juke's stages can be the real component.** Theirs are illustrations. Every
claim Juke wants to make is already rendered by working code — `renderHeroShot()`
draws a real board, `analyseDraft()` a real grade, `suggestions()` a real tier
callout, `projectionRecord()` a real forecast against a real season. Nothing to
keep in sync, which is the same principle the product shot already follows.

**And their board drafts itself**, clock counting down on the live cell, rebuilt
per draft type. That is the current bar, not a differentiator.

---

## What to reject

Carried forward from the previous version, all still true:

- **Their information density.** A calm, one-thing-per-panel layout is a
  genuine advantage for a first-time drafter.
- **`user-scalable=no`.** Sleeper ships it; it breaks pinch-zoom. Juke's
  viewport tag is correct and the 16px field floor solves the same problem
  honestly.
- **Uppercase button labels.**
- **Chasing AI positioning.** Their "powerful A.I." is ADP plus tendencies.
  Explaining every number is more durable, and it is what timeless actually
  looks like.

Added:

- **Stadium photography, chrome and neon.** Covered above. Generic in a market
  where everyone already uses it, and structurally wrong for a page whose
  argument is legibility.
- **Ambient decoration with no job.** Their homepage has a scrolling
  `FANTASY FOOTBALL` marquee, bobbing footballs and robot mascots. Those work
  for a consumer social product with a mascot. The version of playfulness Juke
  should buy is derived from its own subject, not borrowed from theirs.
- **An invented social-proof number.** "Trusted by 13+ million players" sits in
  their hero. When Juke has an honest number — drafts completed, boards graded
  — it belongs there. Until then the hero's proof is the board itself.

---

## Where Juke is genuinely ahead

Worth naming, because it should be protected in any redesign. All four are
now better evidenced than when they were first written.

- **Every number is explained.** The method notes, the four grade bars and
  `docs/draft-room-how-it-works.html` mean nothing is a black box. Confirmed
  first-hand: Sleeper's CPU logic and ranking methodology are opaque.
- **A post-draft grade.** Sleeper's mock ends with a board, a roster and a
  marketing CTA — **no evaluation at all.** A company of that scale leaving the
  user there is not a gap Juke needs to defend; it is the product.
- **Replacement level and tiers are derived from your league**, not asserted.
  Sleeper gives an ADP list and a projected-pick tag, with no tier logic.
- **The projection is graded against itself.** `pp` in `stats.js` holds what was
  forecast for seasons since played, so "our record on him" is checkable. No
  other mock tool does this.
- **It is fast, and free of ceremony.** No framework, no bundle, no login, no
  ads, works offline. Sleeper requires an account for everything.

---

## The app store question

Unchanged in substance, and still the honest sequence.

**Google Play is reachable.** A Trusted Web Activity wraps the existing PWA;
`manifest.json` and the icons exist. The remaining work is service-worker
offline support — **which the project still does not have** — plus a signed
Android package, meaning a build step for the wrapper only.

**The App Store is harder.** Apple rejects thin web wrappers under the
minimum-functionality guideline. Passing review realistically means a native
shell, which means a real pipeline and a Mac.

So: strengthen the PWA → ship to Play via TWA → treat iOS as a separate project
with its own tooling decision.

**The no-build-step rule stays.** It is correct for the website and it is what
keeps the site fast and approachable. It will have to be revisited for the
wrapper, and that is fine: the wrapper is a different artefact from the site.
