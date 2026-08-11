# Design direction

A review of Sleeper, and what to take from it. Written to answer one
question: what turns this from a good personal project into something that
holds up next to the products people already use?

Read `CLAUDE.md` first. Nothing here overrides the rules in it.

---

## What I actually saw, and what I didn't

Sleeper's real draft room is behind a login, and no account was created to
get past it. So this review is based on:

- the public mock draft landing page, including the feature grid where they
  compare themselves to "other apps" — that grid is Sleeper stating what it
  considers table stakes;
- their live design tokens, read off the rendered page;
- how the marketing site itself is built and behaves.

The interior of the draft room is **not** reviewed here. Anything below about
in-draft interaction is reasoning from the feature list and from general draft
UX, not from having used it. Worth doing properly later from an account you
own.

---

## 01. Their design tokens, measured

| | Sleeper | Alpine today |
|---|---|---|
| Page background | `#05091D` — near-black, blue cast | `#F5F7FA` light grey |
| Surfaces | `#131E2C`, `#192533`, `#202635` | `#FFFFFF` cards |
| Primary text | white | `#16202C` |
| Secondary text | `#98B3D6`, `#5F7BA9` — **blue-tinted** | `#5A6875`, `#94A1AC` |
| Display font | Poppins | Poppins |
| Body font | Inter | Inter |
| Base size | 16px | 15px |
| Corner radius | pills everywhere, plus 20–32px cards | 8–12px |
| Buttons | uppercase, 600, 1px letter-spacing, pill | sentence case, 600, 8px radius |

Two things jump out.

**The typography is already the same.** Inter and Poppins, the exact pairing
this project picked independently. That is a real signal that the type
foundation is sound and does not need touching.

**Their neutrals are blue, not grey.** Every muted colour on the page carries
a blue cast rather than being true grey. It is the single cheapest trick in
their system and the main reason a very dark UI reads as designed rather than
as "dark mode was switched on". Alpine's `--ink-light` is already slightly
blue; `--ink-mid` is closer to neutral.

---

## 02. What they treat as table stakes

Straight from their own comparison grid: free with no ads, mobile app,
real-time, invite others, solo option, start anytime, unlimited pause,
rookie-only option, customisable positions, copyable draftboards,
pre-selected keepers.

Alpine has: free, no ads, solo, start anytime, unlimited pause, and — as of
the settings work — customisable positions. That is six of eleven, and the
six that matter for a single-player tool.

The five it lacks all require either accounts or multiplayer. `CLAUDE.md`
already rules out live multi-user drafting for good reasons, and that decision
should hold. **The gap is not a to-do list.** Competing with Sleeper on
Sleeper's axis is unwinnable and not the point.

Two of their features are worth stealing because they are single-player and
genuinely good:

- **Copyable draftboards / templates.** Re-running the same league setup
  repeatedly is the core loop of mocking. Saving named setups is cheap here —
  the `league` object already serialises.
- **Custom ADP.** Their acknowledgement that ADP is an input, not a truth.

---

## 03. What to adopt

### Adopt: dark surface as an option, not a replacement

Sleeper is dark because it is a social app people use at night on a phone in
bed. Alpine's light theme is legible, printable and matches the Alpine
Consulting Partners brand it carries in the header. Throwing that away to look
like a competitor would be the wrong trade.

The right move is `prefers-color-scheme` support, which means the colours in
`:root` need a dark counterpart. This is already the project's structure —
colours are defined once and reused by name — so it is a contained change to
one block of `style.css` and nothing else.

### Adopt: blue-tinted neutrals

Push `--ink-mid` and `--ink-light` slightly further toward blue. Small change,
disproportionate effect on cohesion, no structural risk.

### Adopt: a 16px base

15px is a hair small for a phone. 16px is also what stops iOS Safari zooming
the page when a text input is focused — a real bug the search box on the
Players tab will hit today.

### Adopt: pill radii on chips only

Their pills work on tags and buttons. Applying 24px+ radii to data-dense
tables and the draft board would hurt scanning. Alpine's tier and bye chips
are already pills; leave the cards alone.

### Adopt: the draftboard as a first-class view

They call out that the board "gives you extra context on opponent moves so you
can adapt to position runs and team needs". That is the single most valuable
screen in any draft tool and Alpine already has it — but it is the third tab
and it renders small. It deserves to be more prominent, and it should show
position runs, which the app has the data to detect and currently does not
surface.

---

## 04. What to reject

- **Their information density.** A marketing page is not a draft room, but
  their app is busy. Alpine's calm, one-thing-per-panel layout is a genuine
  advantage for a first-time drafter. Do not trade it for feature parity.
- **`user-scalable=no`.** Sleeper ships it. It breaks pinch-zoom and is an
  accessibility failure. Alpine's viewport tag is currently correct — keep it
  that way.
- **Uppercase button labels.** Fashionable, slightly dated, and worse for
  legibility at small sizes.
- **Chasing AI positioning.** Their "powerful A.I." is ADP plus tendencies.
  Alpine's honesty about its own model — every number explained on the page —
  is more durable than marketing language, and it is what "timeless" actually
  looks like.

---

## 05. Where Alpine is genuinely ahead

Worth naming, because it should be protected in any redesign.

- **Every number is explained.** The method notes, the four grade bars, and
  `docs/draft-room-how-it-works.html` mean nothing is a black box. No major
  fantasy site does this.
- **Points are recomputed from raw components.** Most tools take the
  platform's number and inherit its assumptions.
- **Replacement level is derived, not asserted.** It moves correctly with
  league shape.
- **It is fast.** No framework, no bundle, no login, no ads. Opens instantly.

---

## 06. Suggested order

Roughly cheapest-to-most-valuable first. None of this is committed to.

1. 16px base size — fixes the iOS input-zoom bug as a side effect.
2. Blue-tinted neutrals.
3. Dark mode via `prefers-color-scheme` on the `:root` block.
4. Saved league setups, named. Reuses the existing settings fingerprint.
5. Position-run detection on the draft board.
6. Custom ADP import.
7. Scoring rules moved into the browser — Phase 2 in `SETTINGS-REFACTOR.md`.
   This is the one that unlocks the most, because it makes the scoring
   selector honest.

---

## 07. The app store question

This needs saying plainly, because it conflicts with a rule in `CLAUDE.md`.

**Google Play is reachable** from where the project stands. A Trusted Web
Activity wraps an existing PWA; `manifest.json` and the icons already exist.
The remaining work is service-worker offline support, and Play requires a
signed Android package, which means a build step for the wrapper only — not
for the site.

**The App Store is harder.** Apple rejects thin web wrappers under the
minimum-functionality guideline. Passing review realistically means a native
shell with native capabilities, which means Capacitor or similar, which means
a real build pipeline and a Mac.

So the honest sequence is: strengthen the PWA → ship to Play via TWA → treat
iOS as a separate project with its own decision about tooling.

The "no build step" rule in `CLAUDE.md` is correct today and should not be
relaxed for the website. It will have to be revisited for the wrapper, and
that is fine — the wrapper is a different artefact from the site. The website
staying buildless is what keeps it fast and approachable, and that should
survive any app store.
