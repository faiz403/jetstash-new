# JetStash — Seven-Day Controlled Organic Launch Pack

> **Founder attention needed — 4 August 2026:** TravelUp has been removed entirely and replaced
> with Trip.com as JetStash's sole active provider (see `STATUS.md` AFF-001). Every "TravelUp"
> reference below is now stale — replace with Trip.com before sending anything. More importantly:
> **3 of the 6 routes selected below (Heathrow–Delhi, Heathrow–Mumbai, Heathrow–Jeddah) now have no
> booking CTA at all** — Trip.com's tools cannot produce a Heathrow-specific dateless link. If this
> pack hasn't been sent yet, consider swapping those three for supported routes before using it.
> This document has not been rewritten for Trip.com; treat all message drafts and the FAQ below as
> needing a fresh pass, not ready to send as-is.

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

Your original list named the right four categories (Pakistan, India, Gulf, Umrah). Two of the six
specific routes are swapped from what you proposed, based on which routes actually have logged
fare evidence and a verified TravelUp deep link today — the two things that make a route page look
credible on a stranger's first visit rather than showing an honest-but-bare "no fare checked yet"
state.

| Category | Route | Fare observations | Verified TravelUp deep link |
|---|---|---|---|
| Pakistan | Manchester → Lahore | 3 | Yes |
| Pakistan | Manchester → Islamabad | 2 | Yes |
| India | **London Heathrow** → Delhi | 3 (most recent: 28 July) | Yes |
| India | **London Heathrow** → Mumbai | 2 (most recent: 24 July) | Yes |
| Gulf | Manchester → Dubai | 2 | Yes |
| Umrah | **London Heathrow → Jeddah** | 3 | Yes |

Two changes from your list, with the reason:

- **Delhi and Mumbai: Heathrow, not Manchester or Birmingham.** Manchester–Delhi, Manchester–Mumbai
  and Birmingham–Mumbai all currently have **zero** logged fare observations — a first-time visitor
  from one of these routes would land on a page with no price shown at all. The Heathrow versions
  of both have real, recent observations.
- **Umrah: Jeddah, not Madinah.** Jeddah has 3 observations and a working route-specific TravelUp
  link. Madinah has only 1 observation, and — following the fix shipped a few days ago — its
  booking CTA now honestly says it opens TravelUp's general site rather than a Madinah-specific
  search, because no such page could be verified. Jeddah is the stronger first impression of the
  two; Madinah is still a real, working part of the site, just not the one to lead with.

Live route pages:

- `https://jetstash.co.uk/routes/manchester-lahore`
- `https://jetstash.co.uk/routes/manchester-islamabad`
- `https://jetstash.co.uk/routes/london-heathrow-delhi`
- `https://jetstash.co.uk/routes/london-heathrow-mumbai`
- `https://jetstash.co.uk/routes/manchester-dubai`
- `https://jetstash.co.uk/routes/london-heathrow-jeddah`

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

**TravelUp / affiliate links:** every "Check live price(s)" button already carries CJ's own
tracked link, with route, cabin and page context baked into CJ's `sid` field
(`lib/booking-providers.ts`) — that's CJ's existing tracking infrastructure, not anything built for
this launch. CJ, not Resend, is the system that would show clicks, actions and commissions; Resend
is only how Contact/Quote Request form emails arrive, and has nothing to do with affiliate clicks.
Whether that CJ reporting is actually visible, and at what level of detail, has not yet been
checked in the real CJ dashboard. **A click through to TravelUp is not the same as a booking or a
commission** — do not treat one as evidence of the other, and do not describe affiliate conversion
measurement as working until you've confirmed it directly in CJ.

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

### India community (Delhi / Mumbai)

> Sharing JetStash — a UK site I built for checking India routes before booking. Real route status,
> passport/visa checks against the official government pages, and dated fares rather than a
> live-price claim.
>
> Heathrow–Delhi: `https://jetstash.co.uk/routes/london-heathrow-delhi?utm_source=<GROUP-NAME>&utm_medium=whatsapp&utm_campaign=soft-launch-jul26`
> Heathrow–Mumbai: `https://jetstash.co.uk/routes/london-heathrow-mumbai?utm_source=<GROUP-NAME>&utm_medium=whatsapp&utm_campaign=soft-launch-jul26`
>
> If you've got a real UK–India trip coming up, I'd rather you tried it on that than just looked at
> it — and told me honestly where it falls short.

### Gulf / Dubai-focused travellers

> Built a UK travel-intelligence site called JetStash — checks routes, timing and dated fares for
> journeys like Manchester–Dubai properly, instead of a comparison site's live-price claim.
>
> `https://jetstash.co.uk/routes/manchester-dubai?utm_source=<GROUP-NAME>&utm_medium=whatsapp&utm_campaign=soft-launch-jul26`
>
> There's also an interactive route map on the homepage if Dubai isn't your exact trip:
> `https://jetstash.co.uk/?utm_source=<GROUP-NAME>&utm_medium=whatsapp&utm_campaign=soft-launch-jul26`

### Umrah / religious travel community

> Sharing JetStash — built it partly with Umrah travel in mind. It checks the latest evidence on
> the route and airline for journeys like Heathrow–Jeddah, passport/visa requirements, and dated
> fares rather than a live-price claim.
>
> `https://jetstash.co.uk/routes/london-heathrow-jeddah?utm_source=<GROUP-NAME>&utm_medium=whatsapp&utm_campaign=soft-launch-jul26`
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
partner (currently TravelUp) to actually complete the booking. See the affiliate disclosure page
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
Commission from partner bookings (currently TravelUp) when you book through a link on the site —
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
| | | | (visited / used Atlas / ran Travel Ready Check / clicked TravelUp / signed up / asked a question) | | |

Log this by hand from these places each day during the soft launch:
1. **Vercel Analytics dashboard**, if day one confirms UTM sources are actually visible there —
   otherwise use your manual share log (group, route URL, time sent — see section 2) instead.
2. **Direct replies** in WhatsApp/community threads — copy anything substantive into the sheet,
   good or bad.
3. **Contact form / Quote Request / Newsletter signups** — these already arrive by email
   (Resend/Brevo); note any that came from this launch in the sheet too.
4. **CJ dashboard**, once you've checked what it actually shows — clicks, actions and commissions
   attributable to this launch, if visible at that level of detail.

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
  `components/travel-ready/travel-ready-check.tsx`), and TravelUp CTA clicks are wrapped in a
  `TrackedOutboundLink` that also fires a Vercel event — so both may already be visible in the
  dashboard, but this pack does not claim that until you've actually looked
- CJ affiliate clicks, actions and commissions (see section 2)

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
matter, suitable candidates for automating include a daily analytics summary, a CJ click/commission
summary (where the dashboard actually exposes one), a lead and form-enquiry log, broken-link
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
