# JetStash — Seven-Day Controlled Organic Launch Pack

> **Updated, 4 August 2026:** TravelUp has been removed entirely and replaced with Trip.com as
> JetStash's sole active provider (see `STATUS.md` AFF-001). This pack's route selection has been
> finalised following an evidence-based review of all 23 Trip.com-supported routes — see the Change
> log at the bottom for exactly what changed and why. Still nothing sent anywhere; still DRAFT for
> founder review.

**Status: DRAFT for founder review.** The message copy below is a genuine starting point, not
final text — read it, cut anything that doesn't sound like you, and personalise the parts that
should come from you directly before sending anything. Nothing in this document has been sent to
anyone. I have no access to WhatsApp, community groups, or any channel this would go out through —
sending it is entirely yours to do.

**Objective:** get the first genuine users, the first useful feedback, and the first £1 of
revenue, from a small, trusted, well-targeted soft launch — not a wide public push.

**Product freeze in effect:** no redesigns, no new features, no speculative housekeeping for the
duration of this launch. The only reason to touch the product during these seven days is a real
user hitting a real, reproducible problem. Everything below is content and process, not code.

---

## 1. The six launch routes

Your original list named four categories (Pakistan, India, Gulf, Umrah). Following the 4 August
2026 TravelUp → Trip.com migration, three of the previously selected six routes (Heathrow–Delhi,
Heathrow–Mumbai, Heathrow–Jeddah) lost their booking CTA entirely — Trip.com's tools cannot produce
a Heathrow-specific dateless link — and a subsequent interim selection (Delhi/Mumbai/Ahmedabad/
Amritsar, all Manchester) traded fare evidence for coverage across zero-observation routes. Neither
was right for a *first* controlled launch. This final selection is the outcome of an evidence-based
review of all 23 Trip.com-supported routes, scored on: a valid Trip.com CTA, existing fare
observations, no active withdrawal warning, completeness of route guidance, strength for a
first-time visitor, and relevance to JetStash's audience. It restores all four of your original
categories.

| Category | Route | Directness | Fare observations | Trip.com CTA |
|---|---|---|---|---|
| Pakistan | Manchester → Lahore | Direct | 4 (most recent: 4 Aug 2026) | Yes |
| Pakistan | Manchester → Islamabad | Direct | 3 (most recent: 4 Aug 2026) | Yes |
| Gulf | Manchester → Dubai | Direct | 2 (16 Jun / 12 Jun 2026) | Yes |
| Gulf | Manchester → Doha | Direct | 1 (5 Aug 2026) | Yes |
| India | Birmingham → Amritsar | Connecting (Air India's own booking page shows no direct option) | 4 (most recent: 4 Aug 2026) | Yes |
| Umrah | Manchester → Madinah | Connecting (no current direct service; realistic routing via Istanbul) | 2 (most recent: 5 Aug 2026) | Yes |

**Internal note, not for promotional use — be aware before sending anything:**
- **Update, 5 August 2026:** both evidence gaps flagged in the prior update have been closed. Manchester–Doha now has
  its first logged fare observation (£411, Trip.com, one adult return economy, checked 5 August
  2026). Manchester–Madinah now has a fresh flight-only observation (£473, Trip.com, same profile,
  also checked 5 August 2026) alongside its original 9 June 2026 entry — that older entry is a
  pre-methodology Umrah *package* price (flights + hotel, £1,149), a materially different product
  from the new flight-only figure, and remains untouched as historical record; the two are not
  interchangeable and the site never blends them into one displayed range (the "Umrah package" deal
  card on `/deals` correctly shows no price rather than the flight fare — see `data/deals.ts`'s
  `isBundledProductDeal`). Both new observations follow `FARE_OBSERVATION_ARCHIVE.md`'s fixed
  8-week-horizon methodology.
- Two zero-observation, verified-direct Pakistan routes (Manchester–Karachi, Birmingham–Islamabad)
  and one Gulf route (Manchester–Doha's own near-neighbours) were considered and set aside for this
  round — Manchester–Karachi in particular is excluded because JetStash's own data marks its direct
  service as **unverified** (no primary source currently confirms it), which is a materially weaker
  first impression than an honestly-disclosed connection.
- Neither of the two bullets above should appear in outbound messages unless a specific person
  asks a specific question they're directly relevant to (see section 6's "why isn't my route on
  there" pattern) — they're context for you, not talking points.

Live route pages:

- `https://jetstash.co.uk/routes/manchester-lahore`
- `https://jetstash.co.uk/routes/manchester-islamabad`
- `https://jetstash.co.uk/routes/manchester-dubai`
- `https://jetstash.co.uk/routes/manchester-doha`
- `https://jetstash.co.uk/routes/birmingham-amritsar`
- `https://jetstash.co.uk/routes/manchester-madinah`

---

## 2. Tracked links — use for the day-one test, don't rely on yet

UTM-tagged links (`utm_source`, `utm_medium`, `utm_campaign`) can be used for the day-one
experiment below. JetStash itself does not process or store these parameters: a direct search of
this repository (`app/`, `lib/`, `components/`) confirms zero code reads or forwards a `utm_`
value. Whether tagged links show up as usable `utm_source` attribution depends entirely on which
Vercel Web Analytics plan and features this project actually has — that has not been verified in
the real dashboard.

**Convention:** `?utm_source=<community-name>&utm_medium=whatsapp&utm_campaign=soft-launch-jul26`

Swap `utm_medium=whatsapp` for `utm_medium=community` if a message is going into a forum or
Facebook group rather than WhatsApp. Keep `utm_campaign=soft-launch-jul26` the same everywhere
this round, so the whole soft launch can be filtered as one set later, if filtering turns out to be
possible at all.

Worked example — homepage link for a Lahore-focused WhatsApp group:

```
https://jetstash.co.uk/?utm_source=lahore-whatsapp&utm_medium=whatsapp&utm_campaign=soft-launch-jul26
```

Same pattern for a specific route page:

```
https://jetstash.co.uk/routes/manchester-lahore?utm_source=lahore-whatsapp&utm_medium=whatsapp&utm_campaign=soft-launch-jul26
```

**Day-one test, before relying on this for anything real:** send yourself one tagged link and
check whether `utm_source`, `utm_medium` and `utm_campaign` are actually visible in the Vercel
Analytics dashboard. Only you can do this — I have no dashboard access, and Vercel's own
documentation is not the same as seeing it work on this project's actual plan.

- **If the dashboard does show usable UTM data:** use tagged links for the rest of the week as
  planned.
- **If it doesn't:** don't try to force it. Instead keep a manual share log for the week — which
  group, which route URL, and the exact time you sent it — and cross-reference that against
  whichever traffic or form activity does show up. A manual log is a completely adequate way to run
  a seven-day soft launch; don't let missing UTM reporting stall anything.

Do not describe community-level attribution as operational until one of the two above is actually
confirmed.

**Trip.com / affiliate links:** every "Compare flights on Trip.com" button carries a genuine,
dashboard-generated Trip.com affiliate link (`Allianceid`/`SID`, `lib/booking-providers.ts`) — that's
Trip.com's own tracking infrastructure, not anything built for this launch. Trip.com's affiliate
dashboard, not Resend, is the system that would show clicks and commissions; Resend is only how
Contact/Quote Request form emails arrive, and has nothing to do with affiliate clicks. Whether that
dashboard reporting is actually visible, and at what level of detail, has not yet been checked in
the real Trip.com dashboard. **A click through to Trip.com is not the same as a booking or a
commission** — do not treat one as evidence of the other, and do not describe affiliate conversion
measurement as working until you've confirmed it directly in Trip.com's dashboard.

---

## 3. JetStash introduction (short version, for messages)

> JetStash is a small UK site I built to check international flights properly before you book —
> the latest checked evidence on the route and airline, what documents you need, and a real, dated
> fare instead of a live-price claim that changes the moment you click it. It's not a comparison
> site and not a travel agency — think of it as the research you'd do yourself, already done.

## 4. Route Atlas + Travel Ready Check (one paragraph, reusable)

> The homepage has an interactive map (the Route Atlas) — pick a supported UK airport and explore
> the destinations JetStash currently tracks, together with the status of the available route
> evidence. There's also a Travel Ready Check, which checks passport and visa requirements for
> your specific trip against the official government source, not a guess.

---

## 5. Per-audience messages

Each one leads with the route that community cares about, links it with tracking, and closes with
the same honest ask: try it, don't just say it looks nice.

### Pakistan community (Lahore / Islamabad)

> Sharing something I've been building — JetStash, a UK site for checking Pakistan routes properly
> before booking. It checks the latest evidence on which airline and route are operating,
> passport/visa requirements, and real dated fares rather than a live-price claim.
>
> Manchester–Lahore: `https://jetstash.co.uk/routes/manchester-lahore?utm_source=<GROUP-NAME>&utm_medium=whatsapp&utm_campaign=soft-launch-jul26`
> Manchester–Islamabad: `https://jetstash.co.uk/routes/manchester-islamabad?utm_source=<GROUP-NAME>&utm_medium=whatsapp&utm_campaign=soft-launch-jul26`
>
> Would genuinely appreciate you trying it for a real trip you're actually thinking about, not just
> looking at it — and telling me where it's confusing or wrong, not just whether it looks nice.

### India community (Amritsar, via Birmingham)

> Sharing JetStash — a UK site I built for checking India routes before booking. Real route status,
> passport/visa checks against the official government pages, and dated fares rather than a
> live-price claim.
>
> Birmingham–Amritsar: `https://jetstash.co.uk/routes/birmingham-amritsar?utm_source=<GROUP-NAME>&utm_medium=whatsapp&utm_campaign=soft-launch-jul26`
>
> This one currently connects rather than flying direct — Air India's own booking page doesn't list
> a direct option — so JetStash shows the real routing detail rather than a headline duration,
> worth checking before you compare it elsewhere.
>
> If you've got a real UK–India trip coming up, I'd rather you tried it on that than just looked at
> it — and told me honestly where it falls short.

### Gulf community (Dubai / Doha)

> Built a UK travel-intelligence site called JetStash — checks routes, timing and dated fares for
> journeys like Manchester–Dubai and Manchester–Doha properly, instead of a comparison site's
> live-price claim.
>
> Manchester–Dubai: `https://jetstash.co.uk/routes/manchester-dubai?utm_source=<GROUP-NAME>&utm_medium=whatsapp&utm_campaign=soft-launch-jul26`
> Manchester–Doha: `https://jetstash.co.uk/routes/manchester-doha?utm_source=<GROUP-NAME>&utm_medium=whatsapp&utm_campaign=soft-launch-jul26`
>
> There's also an interactive route map on the homepage if neither is your exact trip:
> `https://jetstash.co.uk/?utm_source=<GROUP-NAME>&utm_medium=whatsapp&utm_campaign=soft-launch-jul26`

### Umrah / religious travel community

> Sharing JetStash — built it partly with Umrah travel in mind. It checks the latest evidence on
> the route and airline for journeys like Manchester–Madinah, passport/visa requirements, and dated
> fares rather than a live-price claim.
>
> `https://jetstash.co.uk/routes/manchester-madinah?utm_source=<GROUP-NAME>&utm_medium=whatsapp&utm_campaign=soft-launch-jul26`
>
> Manchester's direct Madinah service isn't currently running, so this one connects (realistically
> via Istanbul) — JetStash shows the actual routing rather than a headline "direct" claim, worth
> checking before you compare it elsewhere.
>
> If you're actually planning an Umrah trip, I'd really value you trying it for real and telling me
> what's missing or unclear.

### General UK travel community

> Built a small UK travel-intelligence site called JetStash — before-you-book research for
> international flights: real route status, document checks, and dated fares rather than a
> live-price claim. There's an interactive route map on the homepage covering UK airports to South
> Asia, the Gulf, Turkey and Morocco.
>
> `https://jetstash.co.uk/?utm_source=<GROUP-NAME>&utm_medium=whatsapp&utm_campaign=soft-launch-jul26`
>
> Would value honest feedback from anyone who actually has a trip to check, not just a look and a
> nice comment.

---

## 6. Prepared replies for common questions

**"Is this a travel agency? Do you sell tickets?"**
No — JetStash doesn't sell flights or take payment. When you're ready to book, it points you to a
partner (currently Trip.com) to actually complete the booking. See the affiliate disclosure page
for exactly how that works: `https://jetstash.co.uk/affiliate-disclosure`

**"How is this different from Skyscanner / Google Flights?"**
Those show you live prices across lots of sites. JetStash does something narrower first: whether
the latest checked evidence still supports the route and airline as advertised, what documents
you'll need, and a real dated fare someone actually checked — before you get to the
price-comparison stage.

**"Are the prices live?"**
No, and it says so on every fare — each one shows the date a person checked it, not a live feed.
That's deliberate: a live-price claim that's actually a few hours stale is worse than an honest
dated one.

**"Is my data safe if I sign up?"**
Newsletter signup only stores your email and, if you choose to give them, your nearest airport and
what you're interested in — nothing else, no selling your details. See
`https://jetstash.co.uk/privacy-policy`.

**"How do you make money?"**
Commission from partner bookings (currently Trip.com) when you book through a link on the site —
never anything that changes the price you pay. `https://jetstash.co.uk/affiliate-disclosure`

**"Why isn't [my route] on there?"**
Genuinely honest answer: JetStash only publishes a route once it's been individually checked, so
coverage is still growing — 27 routes today, added deliberately rather than guessed. Worth saying
if asked, not volunteering unprompted.

---

## 7. Feedback, enquiry and click tracking — simple template

No new tooling for this — a spreadsheet (Google Sheets, Excel, whatever's easiest) with one row per
event is enough for a 7-day soft launch. Suggested columns:

| Date | Source (which group/community) | Person (first name/handle only) | What they did | What they said | Action needed? |
|---|---|---|---|---|---|
| | | | (visited / used Atlas / ran Travel Ready Check / clicked Trip.com / signed up / asked a question) | | |

Log this by hand from these places each day during the soft launch:
1. **Vercel Analytics dashboard**, if day one confirms UTM sources are actually visible there —
   otherwise use your manual share log (group, route URL, time sent — see section 2) instead.
2. **Direct replies** in WhatsApp/community threads — copy anything substantive into the sheet,
   good or bad.
3. **Contact form / Quote Request / Newsletter signups** — these already arrive by email
   (Resend/Brevo); note any that came from this launch in the sheet too.
4. **Trip.com affiliate dashboard**, once you've checked what it actually shows — clicks, actions
   and commissions attributable to this launch, if visible at that level of detail.

---

## 8. Seven-day plan

| Day | Action |
|---|---|
| 1 | Send to five to ten trusted individuals only. Test one tagged link and check dashboard visibility (see section 2). |
| 2 | If no serious issue appeared, share in one carefully selected relevant group only. |
| 3 | Pause expansion. Review feedback, traffic evidence, forms and affiliate-dashboard visibility. |
| 4–5 | Share in one additional group or audience only if the first group produced no material problem. |
| 6–7 | Stop expanding. Review the week and decide what to fix or test next. |

## 9. What's actually measurable today

Checked directly against the code and the real submission pipeline, not assumed:

**Confirmed operational** — independently verified through a channel that's already proven to
work (email delivery, re-verified live 29 July 2026):
- Contact form arrivals
- Quote Request arrivals
- Newsletter signups
- Direct replies and reported problems, logged by hand from conversations

**Needs founder dashboard verification** — code either fires the event or the link carries the
tag, but nobody has yet confirmed it's visible in the real dashboard:
- UTM/community attribution in Vercel Analytics (see section 2)
- Travel Ready Check start/completion — this one already has real `track()` calls in the code
  (`travel_ready_check_started`, `travel_ready_check_completed`, `travel_ready_check_verdict` in
  `components/travel-ready/travel-ready-check.tsx`), and Trip.com CTA clicks are wrapped in a
  `TrackedOutboundLink` that also fires a Vercel event (`tripcom_click`) — so both may already be
  visible in the dashboard, but this pack does not claim that until you've actually looked
- Trip.com affiliate clicks, actions and commissions (see section 2)

**Not currently instrumented** — checked directly: zero `track()` calls exist in this code today:
- Route Atlas interaction (`components/founder/atlas-feel-test.tsx`)
- The homepage Journey Check form (`components/homepage-v2/journey-check-form.tsx`)

Don't monitor the last group as if it were live — there's nothing there to see yet. If Atlas or
Journey Check interaction turns out to matter after this week, adding `track()` calls to them is a
small, separate follow-up, not something needed before starting.

Don't wait for perfect analytics before starting — do the day-one tagged-link check in section 2,
then go.

## 10. What happens after day seven

Per your step 6: fix only genuine, evidence-backed usability problems found this week; add fare
observations specifically to whichever of the six routes got real attention; look hard at pages
people visited but didn't act on; and only then consider broadening beyond this first group. None
of that is scoped here — this document ends at day seven.

**Automation candidates for later, not now:** once the manual week shows which signals actually
matter, suitable candidates for automating include a daily analytics summary, a Trip.com
click/commission summary (where the dashboard actually exposes one), a lead and form-enquiry log, broken-link
monitoring, stale fare/source reminders, and a weekly founder report. None of this is built, scoped
in detail, or started by this PR — automation is deliberately deferred until the manual seven-day
test shows which of these would actually be worth building.

---

## Change log

- **30 July 2026** — draft created for founder review, following the decision to begin a
  controlled seven-day organic launch. Not yet sent anywhere.
- **30 July 2026 (amendment)** — corrected UTM/Vercel and CJ/affiliate measurement wording to
  remove unverified attribution claims and add a manual-share-log fallback; corrected absolute
  product-claim wording ("actually running", "every destination actually reachable", the Umrah
  "package" line); replaced the seven-day rollout with a smaller, more conservative schedule;
  replaced "what to watch for" with a three-tier measurable/needs-verification/not-instrumented
  breakdown checked directly against the code; added a deferred automation-candidates note. The six
  selected routes and their URLs are unchanged. Still not sent anywhere.
- **4 August 2026 (TravelUp → Trip.com correction)** — TravelUp removed entirely as JetStash's
  provider (`STATUS.md` AFF-001); Trip.com is now sole active provider. Three of the six original
  routes (Heathrow–Delhi, Heathrow–Mumbai, Heathrow–Jeddah) lost their booking CTA in that
  migration, so the founder directed a full six-route replacement: Manchester–Lahore,
  Manchester–Islamabad (unchanged), Manchester–Delhi, Manchester–Mumbai, Manchester–Ahmedabad,
  Manchester–Amritsar (new). Manchester–Dubai is no longer part of this six-route selection either,
  by the founder's direction — Gulf/Umrah audiences are deferred this round rather than covered by
  a route inside the six (see section 5). All "TravelUp"/CJ references throughout replaced with
  Trip.com's actual architecture (dashboard-generated `Allianceid`/`SID` links, no CJ SubID/deep-link
  toggle, no per-click dynamic sid parameter). Flagged honestly: four of the six routes
  (Delhi/Mumbai/Ahmedabad/Amritsar) currently have zero logged fare observations, unlike the
  original selection's fare-evidence-first criterion — see section 1. Still not sent anywhere.
- **4 August 2026 (final six-route selection)** — the interim Delhi/Mumbai/Ahmedabad/Amritsar
  selection above traded fare evidence for route-count coverage and dropped Gulf/Umrah entirely;
  neither was right for a first controlled launch. Replaced with the outcome of an evidence-based
  review of all 23 Trip.com-supported routes (valid CTA, fare observations, active-withdrawal
  status, guidance completeness, first-visitor strength, audience relevance — see section 1):
  **Manchester–Lahore, Manchester–Islamabad, Manchester–Dubai, Birmingham–Amritsar,
  Manchester–Madinah, Manchester–Doha.** Restores all four original categories (Pakistan, Gulf,
  India, Umrah) that the two prior selections had each partly dropped. Manchester–Delhi and
  Manchester–Mumbai are excluded on this pass specifically because both carry an active IndiGo
  withdrawal-announced notice (`data/route-status-events.ts`, effective 31 August 2026) — a
  materially weaker first impression than the two prior corrections had assessed. Per-audience
  messages rewritten in section 5 to match: India audience now leads with Birmingham–Amritsar
  (honestly described as connecting, not direct); Gulf and Umrah audiences reinstated with
  Manchester–Dubai/Doha and Manchester–Madinah respectively, each honestly describing directness
  and fare-evidence status without overclaiming. Still not sent anywhere.
- **5 August 2026 (fare observations closed)** — the two evidence gaps flagged above are closed:
  Manchester–Doha logged its first fare observation (£411) and Manchester–Madinah logged a fresh
  flight-only observation (£473), both via Trip.com on the standard 8-week-horizon profile
  (`data/fare-observations.ts`, `docs/project-control/FARE_OBSERVATION_ARCHIVE.md`). While
  correcting this, found and fixed a related product-integrity bug: the "Umrah package" deal cards
  (`umrah-package-jed`, `umrah-package-extended`) were counting flight-only observations as
  evidence for a bundled flight+hotel product's price — a materially different, higher-priced
  product. `data/deals.ts` now gates `hasTrackedFare` on `isBundledProductDeal`, so a
  package/Umrah-category deal only ever counts a tracked fare that's actually evidence for its own
  product; the "Umrah" tab on `/deals` is honestly hidden until a real package-price observation
  exists. Section 1's table and internal note updated to match; no promotional message copy
  touched. Still not sent anywhere.
