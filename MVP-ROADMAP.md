# MVP roadmap

What The Draft Room has, what a shipped fantasy draft product is expected to
have, and a four-phase route to an app-store release before the 2027 season.

This file holds **sequencing**. `DESIGN-DIRECTION.md` holds design direction and
`BUSINESS-PLAN.md` holds the revenue argument; where they overlap, this one
defers rather than repeating. `CLAUDE.md` holds the rules and overrides all
three.

Written August 2026, against `main` at the time. Player counts move nightly, so
any figure here carries a date and should be re-measured rather than trusted.

---

## How this was researched

Both products were walked end to end — a completed 14-round mock on Juke and a
completed 15-round mock on Sleeper, plus player cards, in-draft tooling and
post-draft screens on each — and Sleeper's marketing site was reviewed frame by
frame from a screen recording.

Every checkable claim about Juke was re-verified against the source. The four
that were spot-checked all held: the board is a few hundred deep and
`poolSize()` does refuse a league needing more picks than it carries, the pick
clock does stop at 120 seconds, and there is no export, share or permalink
anywhere in the codebase.

**The board counts moved while this file was being written**, which is the best
possible argument for the caveat above. Measured on 17 August: standard 210,
half 218, full PPR 261. Re-measured the next morning after the nightly rebuild:
standard 210, half **222**, full PPR **259**. Nothing was wrong either time.
Any total written down here is stale within a day, which is why the app derives
`board.length` rather than quoting one.

### Two corrections worth keeping

**The board ceiling was missed entirely** by an earlier version of this
analysis, and it is the most interesting gap in the set: everything else in the
app scales with league settings, and the data does not. The team dropdown offers
up to 24 while the board supports roughly 14 at normal round counts.

**Editable scoring was over-claimed.** An earlier draft led with it as Juke's
biggest advantage, on the evidence that Sleeper's mock-draft setup offers nine
ranking presets with no editable values. That is true of the *mock flow* and
false of the platform — a real Sleeper league has full per-stat custom scoring,
commissioner-editable, with forced recalculation of played weeks. **Custom
scoring is table stakes, not a moat.** What survives is narrow: Juke lets you
mock-draft against your exact rules without creating a league first.

Recorded because the shape of the mistake recurs — one screen generalised into
a claim about a company, in the direction that flattered us.

---

## The one-line version

**Sleeper is a league platform** that happens to have a good draft room. It
competes with ESPN and Yahoo and it customises everything. **Juke is a draft
analyst** — a narrower room wrapped around a grading model and a published
method that Sleeper does not have at all.

Parity is therefore the wrong goal. What follows closes the gaps that *stop
somebody drafting*, and spends the rest on the analysis layer, which is the one
part a platform of that size has shown no interest in building.

---

## Where Juke already wins

Confirmed by drafting on both.

| | Juke | Sleeper |
|---|---|---|
| Post-draft evaluation | Every team graded on four weighted components, A+ to F, updating after every pick, with value and reach callouts | **None.** The board, your roster, and a CTA |
| Replacement level & tiers | Derived from your league shape; "2 left in RB tier 1" | ADP list and a projected-pick tag. No tier logic |
| Published methodology | Full spec page: CPU formula, need multipliers, wobble, grade weights, and what was wrong and fixed | Black box |
| Projection accountability | "Our record on him" — what was forecast each prior season against what happened | None |
| Speed & control | 140 picks auto-drafted in ~5s; undo; skip to my turn | 150 CPU picks took ~3.5 minutes; no undo, no fast-forward |
| Friction | No account, works offline, nothing leaves the browser in a solo draft | Account required for everything |
| Scoring in a *mock* | 38 rules editable in the mock itself, live-rescoring projections, history and the grade | Nine ranking presets in the mock flow |

That last row is the narrow one. See the correction above.

---

## The gaps

Ordered by what would stop a release or stop a drafter, not by effort.

| Gap | Severity | Notes |
|---|---|---|
| **Data rights for a commercial product** | Blocker | Sleeper's API, FFC's ADP, Tank01 and the ESPN scoreboard are all free and undocumented. None checked for commercial-use terms. First, because it can invalidate everything built after it |
| **No way to keep, share or export a result** | Blocker | The grade is the best artifact in either product and it evaporates. Sleeper stores every mock server-side under In Progress / Completed, syncs it, and offers *Convert to League* |
| **No accounts, one browser-local save** | Blocker | One `localStorage` slot, refused if league settings changed. Clearing the browser loses everything |
| **ESPN scoreboard dependency** | Blocker | Undocumented endpoint, the only run-time dependency with no agreement behind it |
| **The board depth caps league size** | Major | Standard 210, half 222, full PPR 259 on 18 Aug 2026 — and moving nightly. The dropdown offers 4–24 teams; the data supports about 14. Also blocks deep benches and any IDP format |
| **Snake only** | Major | Sleeper has snake, linear, auction and third-round reversal. Zero occurrences of "keeper", "auction" or "linear" in Juke's source |
| **No keepers** | Major | Set by clicking a draft square on Sleeper, with a lock icon and a round cost |
| **Clock stops at 120 seconds** | Major | Sleeper runs to 12+ hours. Slow drafts are how real leagues actually draft |
| **CPU stalls if the host closes the tab** | Major | A deliberate trade — the board is a megabyte and the worker has no copy. Fine among friends, weak for strangers |
| **The landing page is one still frame** | Major | Sleeper's runs claim-and-proof sections that advance on a timer. See `DESIGN-DIRECTION.md` |
| **No IDP, dynasty or rookie-only board** | Format | Blocked by the board ceiling before it is blocked by roster settings |
| **No bestball** | Format | Draft-only format. See the strategic note below |
| **Thinner player research** | Moderate | Sleeper carries week-by-week projections by opponent and % rostered / % started. Juke has logs, seasons and depth charts.<br>Headlines-only news is a deliberate licensing choice, not a gap |
| **Nothing that teaches a beginner** | Moderate | Sleeper runs short tutorial videos per format. The how-it-works page convinces the sceptical; it does not onboard the new |
| **No watchlist** | Minor | Queue and position filters exist; watchlist, rookie filter and show-drafted do not |
| **Docs and UI disagree on league size** | Minor | Docs say 8–14, dropdown offers 4–24, data supports ~14. Three numbers for one fact |

---

## Four phases to August 2027

Sequenced so anything capable of invalidating later work happens first, and so
the 2026 season — which starts in weeks — is used as a live test rather than
missed.

### Now → October 2026 · De-risk, and harvest a season you only get once

Two questions that can kill the plan, one feature that is cheap and
compounding, and a live-fire test with an expiry date.

- **Establish data rights in writing.** Sleeper, FFC, Tank01, ESPN. What each
  permits commercially and what a paid tier costs. A "no" changes the product,
  not the schedule.
- **Replace or licence the ESPN scoreboard.**
- **Ship a shareable result** — a permalink and an image of the grade. Small
  next to anything else here, and simultaneously the missing ending, the
  retention hook and the only free marketing the product has. Before the season,
  so every 2026 draft can produce one.
- **Run the 2026 season as a live beta, with instrumentation.** There is
  currently no way to know how far anyone gets or whether they finish.
- **Raise the board ceiling** — a pipeline change, and it unblocks league sizes
  the UI already advertises. Reconcile the three different numbers while there.
- **Rebuild the landing page as claim-and-proof sections.** The design argument
  is in `DESIGN-DIRECTION.md`; the scheduling point is that it is the surface
  deciding whether anybody reaches the draft room at all.

**Done when** you can state in a sentence each whether every data source may be
used commercially, and a finished draft produces a link somebody can send to
their league.

### November 2026 → January 2027 · Make it a product people come back to

The largest structural gap is not a draft feature. It is that Juke forgets you.

- **Accounts and a real datastore.** The worker and its Durable Objects are
  already deployed. Keep the solo, offline, no-account path intact — it is a
  stated principle and a genuine advantage over Sleeper.
- **Draft history**, in progress and completed, re-openable, synced. This is
  also what makes the model's honesty visible over time.
- **Saved leagues.** The setup screen asks its questions on every visit.
- **Move CPU authority off the host's browser**, or document the limit honestly.

**Done when** a returning user lands on their league, their history, and one
button that starts a draft.

### February → May 2027 · Close the format gaps

Ordered by drafters gained per week of effort.

- **Keepers.** The biggest single format gap, and it exercises the draft-order
  machinery the rest depends on.
- **Slow drafts.** Pick clocks in hours and days — which needs notifications,
  which needs the accounts from the previous phase.
- **Linear and third-round reversal.** Small: the engine already owns the snake
  mirror in one function.
- **Watchlist, rookie filter, show-drafted.** Cheap, expected, each removes a
  small reason to leave.
- **Weekly projections on the player card.** The data is already fetched; this
  is presentation.
- **A hairline on every pick on the board.** Borrowed from Underdog, which
  outlines your own picks in an accent and everybody else's in a thin neutral.
  Juke has the first already — `.cell.mine` is a blue inset outline — and not
  the second, which is what gives the board definition as it fills. Keep the
  blue: orange means act, blue means state. An inset `box-shadow`, not a
  border, because everything here is `border-box`.

**Done when** a keeper league can run its real draft on Juke without anyone
noticing something is missing.

### June → August 2027 · Ship it

Packaging and the unglamorous obligations of being an app. Started early because
store review is unpredictable and the season is not.

- **App-store packaging.** The PWA is close; there is still **no service
  worker**, which a Play wrapper needs. See the app-store section of
  `DESIGN-DIRECTION.md` for the routes.
- **Privacy policy, terms, account deletion, age rating.** Both stores reject on
  these routinely.
- **Moderation and reporting.** Chat between strangers is a review question you
  will be asked directly.
- **Load and cost modelling** across the worker, the datastore and Tank01's
  thousand-call tier.
- **Freeze in July.** Feature work stops before the season, not during it.

**Done when** it is in both stores before the first 2027 drafts, with a support
path that is not your personal inbox.

---

## Where this differs from the walkthrough

**Auction is post-launch, not second.** The argument for it is real — it is the
format where practice has most value and Juke offers nothing. But it is a
separate UI, a separate engine and a separate economy, competing for the same
months as accounts, history and keepers, which serve every drafter rather than
one format. Ship it as the first post-launch release, in-season, when there is
usage data to aim it with.

**IDP and dynasty follow the board ceiling.** Both are blocked by the size of
the pool before they are blocked by roster settings, so the pipeline
change in phase one is the prerequisite and neither is worth scheduling until it
lands.

**Full analyst write-ups are not a gap to close.** Reproducing article bodies is
what a licence buys; linking headlines is deliberate and stays that way. Weekly
projections and ownership are the parts of that row worth building.

---

## The strategic note: bestball, not auction

**Bestball is a draft-only format.** You draft, and that is the entire game — no
waivers, no trades, no setting a lineup, no in-season management. The
highest-scoring possible lineup is taken automatically every week.

Which makes it the one format where **Juke would not be a practice tool, it
would be the whole product.** Everything Juke already has is the part that
matters in bestball: replacement level, tiers, a grade that reads a finished
roster, and scoring rules you can actually set. Everything Juke lacks is the
part bestball does not have.

Sleeper badges it "New Feature", so they are moving there too — but they are
adding a draft-shaped format to a season-long platform, and Juke would be adding
a season-long product to a draft. The second is a much shorter distance.

It does not belong in the MVP: it needs scoring, standings and a season to run
against, which is a product rather than a feature. It belongs here as where the
roadmap points *after* launch, and it is a better answer to "what is Juke for"
than auction is.

**Underdog is the product to study if that becomes the direction** — best-ball
first rather than a league platform, which makes them a closer competitor to a
future Juke than Sleeper is.

---

## What Sleeper is missing, and it is stranger than the gaps

A mock draft that ends with **no evaluation at all** is an odd place for a
company of that scale to leave the user. That is not a gap Juke needs to defend.
It is the product.
