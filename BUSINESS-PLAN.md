# Business plan

A route from where this project is now — a free, working mock draft
simulator with no users — to $500,000 of annual revenue, without DFS and
without a licence.

No timeline is attached. Every milestone below is gated on **users**, not
dates, because the only thing that reliably moves this business forward is
the size of the audience.

Assumptions are stated so you can argue with them. The conversion rates are
the softest numbers here; treat them as the thing to measure first, not as
facts.

---

## 01. What is being sold, and to whom

Three products, one subscription:

1. **Mock draft simulator** — practise against a computer room, with your
   league's real shape and real scoring.
2. **Live draft companion** — connect to your actual draft, see the board
   empty in real time, get suggestions that reflect who is actually gone.
3. **In-season roster tool** — waiver priority, roster holes, add/drop
   recommendations, week to week.

The customer is not the casual player in one office league. It is the
**engaged manager in two to four leagues** who already spends $50–$200 a
year on entry fees and treats the draft as the most important day of the
season. Roughly 40 million Americans play fantasy football; this plan needs
a rounding error of them.

That customer is unusually good to sell to: 84% hold a bachelor's degree and
63% earn over $50,000. Price sensitivity is low. Bullshit sensitivity is high.

---

## 02. Why anyone picks this over FantasyPros

FantasyPros is the incumbent in exactly this niche, at $59.88/year for MVP
and $95.88 for HOF. Competing on features is a losing game. There are three
places where this project is structurally different rather than merely
cheaper.

**Every number is explained.** The grade breaks into four visible
components. Replacement level is a formula on the page. There is a document
explaining the whole engine. Competing products are expert-consensus black
boxes — you are told a player is ranked 14th and never told why. For the
analytical segment of this market, "show your work" is the entire pitch, and
it is already built.

**No expert consensus means no licensing cost.** FantasyPros' product *is*
aggregated expert rankings, which means relationships, contracts and
payments. This project computes everything from public data. That is a
permanently lower cost base and it is why a solo operator can compete at all.

**Points are recomputed from raw components.** Most tools inherit the host
platform's scoring assumptions. This one already discards them. Once scoring
is fully configurable, the numbers will be correct for leagues that other
tools quietly approximate.

**Positioning:** the transparent alternative. Smaller addressable segment
than FantasyPros, materially higher trust and retention within it.

---

## 03. The product ladder

The free tier has to stay genuinely good. It is the top of the funnel, the
SEO surface, and the proof that the paid tier is honest.

| | Free | Season Pass | Multi-League |
|---|---|---|---|
| Mock drafts, any league shape | ✓ | ✓ | ✓ |
| All scoring formats | ✓ | ✓ | ✓ |
| Full method transparency | ✓ | ✓ | ✓ |
| Connect a real league | — | 1 league | up to 6 |
| Custom scoring import | — | ✓ | ✓ |
| Live draft companion | — | ✓ | ✓ |
| In-season roster tool | — | ✓ | ✓ |
| League + team history | — | — | ✓ |
| Dynasty / keeper support | — | — | ✓ |
| **Price** | $0 | **$39/yr** | **$79/yr** |

$39 undercuts FantasyPros' $59.88 by a third while sitting far below a
typical league buy-in. It is an easy yes for someone already spending $100
to play. $79 captures the multi-league player, who is the same person who
tells their leaguemates about tools.

Sold as a **Season Pass** that auto-renews, with an honest reminder email
before it charges. Dark-pattern renewals would earn a year of revenue and
destroy the one asset — trust — that this positioning depends on.

---

## 04. The arithmetic to $500,000

Blended ARPU of ~$42 assumes roughly 80% Season Pass and 20% Multi-League.

```
  $500,000 ÷ $42 ARPU  =  ~11,900 paying subscribers
```

What that requires at different conversion rates:

| Free → paid | Annual free users needed | Share of the 40M market |
|---|---|---|
| 3% | ~397,000 | 1.0% |
| 4% | ~298,000 | 0.75% |
| 5% | ~238,000 | 0.60% |
| 8% | ~149,000 | 0.37% |

**The whole business is that table.** $500,000 does not require beating
FantasyPros; it requires about half a percent of American fantasy football
players using a free tool once a year, and one in twenty of them paying.

Freemium tools in this category typically convert in the 1–5% band. This
product should sit at the top of it or above, because the paid features
(live draft, league sync) are the ones people actually want in the moment
the free tool has just proved useful. Above 5% is plausible but unproven —
measure it before believing it.

At maturity the mix should be roughly:

- Subscriptions **~$430,000**
- Sponsorship / newsletter **~$45,000**
- Licensing the engine to a content site **~$25,000**

---

## 05. Stages, gated on users

### Stage 1 — Free, earn trust (0 → 5,000 annual users)

Revenue: **$0.** Cost: **~$0**, still a static site.

- Finish Phase 2 so scoring is genuinely configurable. Nothing paid works
  without it.
- Connect Sleeper leagues, free, no account required. It needs no backend
  and it is the cheapest possible test of whether league sync is the hook.
- Build the shareable draft recap page. This is the growth engine; see 06.
- Instrument everything: drafts completed, return visits, which league
  shapes people pick.

Success looks like people coming back unprompted, not revenue.

### Stage 2 — First dollars (5,000 → 25,000)

Revenue: **~$30,000** at 3% and $39.

This is where the architecture changes and costs begin. Accounts, payments
and league sync cannot live on GitHub Pages.

- Backend, accounts, Stripe.
- Live draft companion for Sleeper.
- Season Pass launches. Existing free users get a permanent discount for
  being early; it costs little and buys advocacy.

### Stage 3 — A real business (25,000 → 100,000)

Revenue: **~$160,000** at 4% and $40 blended.

- Yahoo integration. It is the only non-Sleeper platform with a legitimate
  documented OAuth API.
- In-season roster tool ships. This is what converts a one-weekend product
  into a seventeen-week one, and it is the single biggest lever on renewal.
- First sponsorship revenue.

### Stage 4 — Target (250,000 → 300,000)

Revenue: **~$500,000+** at 4.5% and $42.

- ESPN, if and only if a route exists that does not involve handling users'
  session cookies. See the risk in 08.
- League and team history, dynasty support, Multi-League tier.
- Consider a second sport, or licensing the engine.

---

## 06. How the users actually arrive

Most plans wave at "marketing" here. These are the four things that will
plausibly work for a solo operator with no budget, in order of leverage.

**1. The league-connect loop.** When one manager connects a league, the tool
learns the other nine to thirteen managers by name. A shared draft recap —
grades for the whole room, best and worst picks, a link — lands in the
league group chat, which is the single highest-intent audience that exists
for this product. Every connected league is a warm introduction to a dozen
people who play fantasy football and are already arguing about the draft.
Build this before anything else in Stage 1.

**2. Long-tail SEO, one page per league shape.** August search volume for
draft tools is enormous, and the incumbents own the head terms. They do not
own "superflex mock draft simulator", "14 team half PPR mock draft", "10
team dynasty startup simulator". The product already supports arbitrary
league shapes, so each of those can be a real, useful, pre-configured
landing page rather than SEO filler. This compounds every year and costs
nothing but time.

**3. r/fantasyfootball.** Millions of members and an August frenzy. The
rules on self-promotion are strict and correctly enforced. The only approach
that works is participating honestly for a year and having a free tool good
enough that other people link it.

**4. Shareable draft grades.** An image or link saying "my draft graded A−,
third in the room" is inherently shareable to exactly the right people.
Cheap to build, and it makes the loop in (1) work harder.

Paid acquisition — podcast and YouTube sponsorship — only makes sense once
there is revenue and a measured conversion rate. Fantasy podcast reads are
not cheap and cannot be justified on hope.

---

## 07. Costs

| Stage | Monthly | Notes |
|---|---|---|
| 1 | ~$0 | static hosting, a domain |
| 2 | $50–150 | backend, database, Stripe fees ~2.9% + 30¢ |
| 3 | $200–500 | scaling, transactional email, error monitoring |
| 4 | $800–2,000 | plus the first contractor, almost certainly support |

The cost that does not appear on that table is **August**. Eighty percent of
the year's usage, support load and bug reports arrive in about six weeks,
and that is precisely when users are least forgiving of a broken tool.
Budget for help before you need it, not after.

Administrative, and cheap: an LLC, a separate bank account, terms of service
and a privacy policy, and sales tax handling for a SaaS product — economic
nexus rules vary by state, and Stripe Tax or similar handles it. GDPR
applies if you take European users. None of this is the gaming-licence
burden that DFS would have required.

---

## 08. Risks, honestly

**Seasonality is the defining structural problem.** Revenue arrives in a
six-week window. A bad August is a lost year, with twelve months to think
about it. The in-season tool is the mitigation, which is a commercial
argument for building it, not just a product one.

**Platform dependency.** ESPN's endpoints are undocumented and can change
without notice. Sleeper's API is free and open today with no contractual
promise that it stays that way. Fantasy Football Calculator is currently
the single source of ADP, and losing it would remove a core input. Plan a
second ADP source before you need one.

**ESPN's cookie problem.** Private ESPN leagues require the user's session
cookies. That means asking people to paste credentials from another site,
storing something you cannot rotate, and training the exact behaviour
phishing relies on. Common in this space; still a genuine liability. Treat
ESPN as blocked until there is a route that does not require it.

**Solo maintenance.** One person, in the busiest six weeks, is a single
point of failure at the worst possible moment.

**Incumbent response.** FantasyPros can copy any single feature. They cannot
easily copy the positioning — an expert-consensus business cannot credibly
become the show-your-work business.

**The conversion assumption.** Everything in section 04 rests on a rate
nobody has measured for this product. If it lands at 1.5% rather than 4.5%,
the audience requirement triples. Measure it at Stage 2 and rebuild the
model with the real number.

---

## 09. What to do next

1. **Phase 2.** Scoring rules into the browser. Every paid feature, on every
   platform, depends on it.
2. **Sleeper league connect**, free and unauthenticated.
3. **The shareable draft recap.** The growth loop, and the cheapest thing on
   this list.
4. **Instrument the funnel** so Stage 2 pricing is set against real numbers.

Nothing before Stage 2 costs money. The first three items are the whole
Stage 1 plan, and they can be built without a backend, an account system or
a single dollar of spend.

---

## Sources

- FantasyPros pricing: <https://www.fantasypros.com/premium/plans/bp/>
- FSGA participation research: <https://thefsga.org/new-fsga-research-highlights-industry-stability-and-next-generation-growth-in-fantasy-sports-and-sports-betting/>
- Fantasy football participation estimate: <https://scoutcast.ai/blog/how-many-people-play-fantasy-football/>
