# Travel Club email sequence

## What this file is — and isn't

These are **email templates for the site owner to send manually**, not an automated drip sequence. JetStash
has no email-sending infrastructure beyond the single Brevo `contacts` API call in
`app/api/subscribe/route.ts`, which adds a contact with two attributes and sends nothing on its own.

There is no double opt-in confirmation currently configured. If you want one, set it up directly in Brevo
(Contacts → Forms → Double confirmation, or a separate Automation workflow watching for "contact added to
list") — the application code cannot trigger this for you. Until you do, the success message on the site
correctly says "you're on the list," not "check your inbox to confirm," because that confirmation email
genuinely doesn't exist yet.

Use Brevo's contact segmentation (`NEAREST_AIRPORT` and `TRAVEL_INTEREST` attributes, captured at signup) to
send each email only to the relevant segment — not your whole list. Sending an Umrah-focused email to someone
who selected "Gulf" as their interest is exactly the kind of irrelevant noise that gets Travel Club marked as
spam.

---

## Email 1 — Welcome (send within a day or two of signup)

**Subject line options** (pick one, don't reuse the same one every time — repetition reads as automated):
- "You're in — here's what to expect from Travel Club"
- "Welcome to Travel Club. One thing before the alerts start."

**Body:**

> Hi,
>
> Thanks for joining JetStash Travel Club.
>
> Quick honesty check, because we'd rather you knew this upfront: we don't run automated live price
> tracking. There's a real person on the other end of this checking fares by hand. When we find something
> on [INTEREST — e.g. "the Pakistan routes" / "Gulf flights" / "business class fares"] genuinely worth
> flagging, you'll hear from us. When we don't find anything worth your time, we stay quiet. That's the
> whole deal.
>
> In the meantime, here's where to actually look right now:
> → [LINK to their interest hub, e.g. jetstash.co.uk/pakistan]
>
> If your travel plans change — different airport, different region — just reply to this email and we'll
> update your preferences. No forms, no faff.
>
> Safe travels,
> The JetStash team

**Why this works:** states the honest mechanism in the first two sentences (protects trust immediately,
rather than letting the subscriber discover the lack of automation later and feel misled), gives an
immediate reason to click through to the site *today* rather than wait for an alert, and opens a low-friction
feedback channel (reply to update preferences) that doubles as an engagement signal for you.

---

## Email 2 — First real value (send when you actually have something — see note below)

**Do not send this on a fixed schedule.** It should be sent when one of these genuinely happens:
- You've added or corrected fare data on a route in their segment (`data/deals.ts`)
- You've added a new route in their region (`data/routes.ts`)
- A peak period relevant to their segment is approaching (Eid, Diwali, Ramadan, school holidays) and the
  practical guidance on the site (booking windows, document reminders) is worth resurfacing

**Subject line options:**
- "[Route] — what we found"
- "Before you book [region], read this"

**Body template:**

> Hi,
>
> Two things worth your time this week on [region]:
>
> 1. [Specific, concrete fact — e.g. "We added a new Birmingham–Lahore route guide. Birmingham now has two
>    direct PIA routes to Pakistan, not just one."]
> 2. [A genuinely useful reminder tied to timing — e.g. "Eid al-Fitr falls in [month] this year. Routes from
>    [their airport] typically see fares rise sharply about 3 weeks before — if your dates are fixed, this
>    is roughly when to book."]
>
> → [Link to the specific route or destination guide]
>
> As always — if this isn't useful or your plans have changed, just unsubscribe below, no hard feelings.
>
> The JetStash team

**Why this works:** delivers something concrete and specific (not generic encouragement to "check out our
site"), ties to a real calendar event the subscriber cares about, and the explicit "no hard feelings"
unsubscribe line is a genuine trust signal — it tells the subscriber you're not trying to trap them on the
list, which paradoxically makes people more likely to stay.

---

## Email 3 — Re-engagement check-in (send only to subscribers who haven't clicked anything in ~2-3 months)

**Subject line options:**
- "Still planning that trip?"
- "Quick one — still relevant to you?"

**Body template:**

> Hi,
>
> You joined Travel Club a little while back for [their interest], and we haven't heard from you since —
> which might just mean your trip already happened, plans changed, or this isn't useful anymore. All fine.
>
> If you're still planning something, the most useful thing we've added recently is:
> → [Most relevant new content — a new route, a new guide, a corrected fare]
>
> If not, no need to do anything — but if you'd rather stop hearing from us, you can unsubscribe below in one
> click.
>
> The JetStash team

**Why this works:** re-engagement emails that guilt-trip ("we miss you!") perform worse and damage trust;
this version is matter-of-fact, gives the subscriber an easy honest exit, and only goes to people who've
actually gone quiet — sending it to everyone on a fixed schedule would be exactly the generic-digest pattern
the Travel Club page explicitly promises not to do.

---

## Frequency discipline — how to avoid looking like spam

- **No fixed schedule.** If you have nothing genuinely new for a segment, don't email that segment. A Travel
  Club email with no real news is worse than silence.
- **Segment every send.** Use `NEAREST_AIRPORT` and `TRAVEL_INTEREST` — never send a Gulf-focused email to
  someone who signed up for Pakistan-route alerts.
- **One clear thing per email**, not a digest of five updates. Specific beats comprehensive.
- **Always include a real, working unsubscribe link** (Brevo includes this automatically in campaign emails —
  don't strip it out if building a custom template).
