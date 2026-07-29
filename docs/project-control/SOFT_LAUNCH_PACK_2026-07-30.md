# JetStash — Seven-Day Controlled Organic Launch Pack

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

## 2. Tracked links

Vercel Analytics (already live on every page — no code change needed) automatically records
standard UTM query parameters on pageviews. Append these to any link before sharing it, and the
source will show up in the Vercel Analytics dashboard broken down by `utm_source`.

**Convention:** `?utm_source=<community-name>&utm_medium=whatsapp&utm_campaign=soft-launch-jul26`

Swap `utm_medium=whatsapp` for `utm_medium=community` if a message is going into a forum or
Facebook group rather than WhatsApp. Keep `utm_campaign=soft-launch-jul26` the same everywhere
this round, so the whole soft launch can be filtered as one set later.

Worked example — homepage link for a Lahore-focused WhatsApp group:

```
https://jetstash.co.uk/?utm_source=lahore-whatsapp&utm_medium=whatsapp&utm_campaign=soft-launch-jul26
```

Same pattern for a specific route page:

```
https://jetstash.co.uk/routes/manchester-lahore?utm_source=lahore-whatsapp&utm_medium=whatsapp&utm_campaign=soft-launch-jul26
```

**Before relying on this for real:** send yourself one tagged link on day one and confirm it
actually appears in the Vercel Analytics dashboard with the right source. I could not verify this
against a real dashboard during development — I don't have access to it — so this is the one
"confirm basic page views are appearing" check from your own step 5, done first, not last.

TravelUp affiliate clicks need no extra tagging — every "Check live price(s)" button on the site
already carries its own tracked link automatically (route, cabin and page context baked in), so
whether someone clicks through to book is already measurable in Resend/CJ without anything added
for this launch.

---

## 3. JetStash introduction (short version, for messages)

> JetStash is a small UK site I built to check international flights properly before you book —
> which route and airline are actually running, what documents you need, and a real, dated fare
> instead of a live-price claim that changes the moment you click it. It's not a comparison site
> and not a travel agency — think of it as the research you'd do yourself, already done.

## 4. Route Atlas + Travel Ready Check (one paragraph, reusable)

> The homepage has an interactive map (the Route Atlas) — pick your UK airport and it shows you
> every destination actually reachable from there, with the real status of each route. There's
> also a Travel Ready Check, which checks passport and visa requirements for your specific trip
> against the official government source, not a guess.

---

## 5. Per-audience messages

Each one leads with the route that community cares about, links it with tracking, and closes with
the same honest ask: try it, don't just say it looks nice.

### Pakistan community (Lahore / Islamabad)

> Sharing something I've been building — JetStash, a UK site for checking Pakistan routes properly
> before booking. It checks which airline and route are actually running, passport/visa
> requirements, and real dated fares rather than a live-price claim.
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

> Sharing JetStash — built it partly with Umrah travel in mind. It checks the real route and
> airline for journeys like Heathrow–Jeddah, passport/visa requirements, and dated fares rather
> than a live-price claim, so you're not guessing what a package actually includes.
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
the route and airline are genuinely running as advertised, what documents you'll need, and a real
dated fare someone actually checked — before you get to the price-comparison stage.

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

Log this by hand from three places each day during the soft launch:
1. **Vercel Analytics dashboard** — pageviews and UTM sources (confirms which link/community drove
   traffic).
2. **Direct replies** in WhatsApp/community threads — copy anything substantive into the sheet,
   good or bad.
3. **Contact form / Quote Request / Newsletter signups** — these already arrive by email
   (Resend/Brevo); note any that came from this launch in the sheet too.

---

## 8. Seven-day plan

| Day | Action |
|---|---|
| 1 | Send yourself one tagged link, confirm it appears in Vercel Analytics. Share with a handful of trusted people only — no groups yet. |
| 2 | If day 1 was clean (no confusion, no broken link, tracking visible), share with 1–2 selected WhatsApp groups per audience. Do not post everywhere at once. |
| 3–4 | Watch quietly. Log everything in the feedback sheet. Do not launch anywhere new yet unless day 1–2 groups responded well. |
| 5 | Expand to a couple more groups/communities if the first ones went well. Start looking for patterns: which routes get attention, where people drop off. |
| 6–7 | Stop expanding. Review the week: which routes/messages worked, what confused people, whether anyone clicked TravelUp or reached out, what the feedback sheet actually shows. |

## 9. What to watch for (from your step 5, unchanged)

- Which tracked links people actually open (Vercel Analytics, by `utm_source`)
- Which of the six routes attract attention
- Whether people interact with the Route Atlas
- Whether they start or complete Journey Check
- Whether they click through to TravelUp
- Whether Contact / Quote Request / Newsletter submissions arrive
- Where people get confused or leave — this one only comes from direct replies and conversation,
  not analytics

Don't wait for perfect analytics before starting — do the day-one tagged-link check above, then go.

## 10. What happens after day seven

Per your step 6: fix only genuine, evidence-backed usability problems found this week; add fare
observations specifically to whichever of the six routes got real attention; look hard at pages
people visited but didn't act on; and only then consider broadening beyond this first group. None
of that is scoped here — this document ends at day seven.

---

## Change log

- **30 July 2026** — draft created for founder review, following the decision to begin a
  controlled seven-day organic launch. Not yet sent anywhere.
