# JetStash — Seven-Day Controlled Organic Launch Pack

> **Updated, 4 August 2026:** TravelUp has been removed entirely and replaced with Trip.com as
> JetStash's sole active provider (see `STATUS.md` AFF-001). This pack's route selection and every
> "TravelUp" reference have been corrected below — see the Change log at the bottom for exactly
> what changed and why. Still nothing sent anywhere; still DRAFT for founder review.

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
2026 TravelUp → Trip.com migration, three of the originally selected six routes (Heathrow–Delhi,
Heathrow–Mumbai, Heathrow–Jeddah) lost their booking CTA entirely — Trip.com's tools cannot produce
a Heathrow-specific dateless link, and JetStash's standing rule is an exact airport-specific link
or no CTA, never a generic fallback. You've directed the replacement selection below; Gulf and
Umrah are not represented in this particular six for now as a result — Dubai and Jeddah/Madinah
remain real, live, working parts of the site, just not part of this launch round's featured set.

| Category | Route | Fare observations | Trip.com CTA available |
|---|---|---|---|
| Pakistan | Manchester → Lahore | 4 | Yes |
| Pakistan | Manchester → Islamabad | 3 | Yes |
| India | Manchester → Delhi | **0** | Yes |
| India | Manchester → Mumbai | **0** | Yes |
| India | Manchester → Ahmedabad | **0** | Yes |
| India | Manchester → Amritsar | **0** | Yes |

**Be aware before sending anything:** unlike the original selection (which specifically prioritised
routes with logged fare evidence, to avoid a first-time visitor landing on a bare "no fare checked
yet" page), four of these six — Delhi, Mumbai, Ahmedabad, Amritsar — currently have **zero** logged
fare observations. Their route pages are honest and fully functional (booking-window guidance,
route facts, Travel Ready Check, Trip.com CTA all work normally), but they'll show "no fare checks
logged yet" rather than a real £ figure. If that's a concern before sending to any of these four
communities, log at least one real fare observation per route first (`data/fare-observations.ts`,
see `FARE_OBSERVATION_ARCHIVE.md`) — optional, your call, not something this correction did for you.

Live route pages:

- `https://jetstash.co.uk/routes/manchester-lahore`
- `https://jetstash.co.uk/routes/manchester-islamabad`
- `https://jetstash.co.uk/routes/manchester-delhi`
- `https://jetstash.co.uk/routes/manchester-mumbai`
- `https://jetstash.co.uk/routes/manchester-ahmedabad`
- `https://jetstash.co.uk/routes/manchester-amritsar`

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

### India community (Delhi / Mumbai / Ahmedabad / Amritsar)

> Sharing JetStash — a UK site I built for checking India routes before booking. Real route status,
> passport/visa checks against the official government pages, and dated fares rather than a
> live-price claim.
>
> Manchester–Delhi: `https://jetstash.co.uk/routes/manchester-delhi?utm_source=<GROUP-NAME>&utm_medium=whatsapp&utm_campaign=soft-launch-jul26`
> Manchester–Mumbai: `https://jetstash.co.uk/routes/manchester-mumbai?utm_source=<GROUP-NAME>&utm_medium=whatsapp&utm_campaign=soft-launch-jul26`
> Manchester–Ahmedabad: `https://jetstash.co.uk/routes/manchester-ahmedabad?utm_source=<GROUP-NAME>&utm_medium=whatsapp&utm_campaign=soft-launch-jul26`
> Manchester–Amritsar: `https://jetstash.co.uk/routes/manchester-amritsar?utm_source=<GROUP-NAME>&utm_medium=whatsapp&utm_campaign=soft-launch-jul26`
>
> If you've got a real UK–India trip coming up, I'd rather you tried it on that than just looked at
> it — and told me honestly where it falls short.

### Gulf / Umrah — deferred this round

Manchester–Dubai and Heathrow–Jeddah are not part of this six-route selection (see section 1). Both
are still real, live, working route pages — Dubai still has a working Trip.com CTA; Jeddah's lost
its CTA in the TravelUp → Trip.com migration and now shows the honest "not available yet" state.
Neither is being featured to a Gulf/Umrah-specific audience in this round. If you want to reach
those communities this week anyway, the general UK travel message below still works, or point them
directly at the homepage Route Atlas.

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
