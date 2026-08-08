# Route Watch — First Operating Pilot Procedure

**Recorded:** 8 August 2026, following a full audit of the existing Route Watch implementation.
**Status:** manual pilot, deliberately no code changes. See `docs/project-control/DECISIONS.md`
("Route Watch is human-reviewed today") for the decision this procedure implements.

## What this is, and what it deliberately is not

Route Watch's signup and storage side is already safe: a hardened API route
(`app/api/route-watch/route.ts`), capped and merged route preferences (`MAX_WATCHED_ROUTES` in
`lib/route-watch-config.ts`), and Brevo-lookup handling that fails closed rather than silently
overwriting a real subscriber's preferences (A6, PR #82). `/founder`'s alert queue
(`lib/founder-insights.ts`, `engineAlertQueue()`) already surfaces which priority routes have an
engine verdict worth reviewing, and has always ended in the same instruction: review, confirm, and
"send a Route Watch email... via Brevo if it's genuinely worth their attention."

What has never existed — in code or in writing — is the procedure for that review-and-send step.
This document is that procedure. It adds **no code**: no send function, no analytics event, no
data file, no cron job. Every step below uses tools that already exist (the ledger, `/founder`,
Brevo's own dashboard). If this manual process reveals genuine, specific friction after real use,
*that* is the evidence to justify building something — not a guess made ahead of running it.

## Pilot scope

- **2–3 routes only**, selected using **actual `WATCH_ROUTE` signup volume visible in Brevo** —
  never a guess or a "these routes feel important" assumption. Check Brevo's contact filters for
  which routes currently have real, non-trivial signup counts before picking the pilot set.
- A reasonable starting shortlist to check against is `BOOK_BY_PRIORITY_ROUTE_SLUGS`
  (`lib/booking-intelligence.ts`) — the site's own existing "most product investment" route list —
  but the actual pilot routes must be confirmed by real Brevo signup counts, not assumed from that
  list alone.
- No cap is stated on subscriber count because none should be needed: current site traffic is low
  (444 impressions / 6 clicks over 3 months per the last Search Console audit), so real segment
  sizes for 2–3 routes are almost certainly already small. Confirm the actual number in Brevo's
  segment preview before every send regardless (see below) — never assume it stayed the same as
  last time.

## Trigger

A send is only ever considered after a **new, dated entry in `data/route-status-events.ts`** on a
pilot route. Never a schedule, never a cron, never a "it's been a while, let's check in" impulse.
The ledger entry's own required `SourceRef` (a real URL and an `accessedAt` date, enforced by the
type system) is the evidence a send would be based on.

## Review step — human judgement only

The founder reads the ledger event and `/founder`'s alert queue, and decides in their own judgement
whether the change is genuinely meaningful to a route's watchers. No part of this is automated or
scored by code:

- No automated judgement of "meaningfulness" exists or should be built for this pilot.
- **If nothing meaningful changed, send nothing.** There is no obligation to send just because a
  ledger event exists — plenty of ledger events (e.g. `frequency-change`, routine `service-launched`
  entries) are historical/advisory and not watcher-relevant on their own.
- Founder approval is the review step itself — in a pilot this size there is one person doing the
  reviewing and the sending, so there is no separate sign-off stage to define.

## Duplicate-send prevention — check both, every time, before sending

1. **Brevo's own campaign history** — check whether a campaign already went out referencing this
   route/event.
2. **The private operating log** (see template below, kept outside this repository) — check
   whether this exact `{route slug, route-status event ID}` pair has already been logged as sent.

**Never send twice for the same route-status event.** If either check shows it's already gone out,
stop — do not send again "just in case" the first one didn't land.

## Segmentation — Brevo, `WATCH_ROUTE` only

1. In Brevo, open Contacts → Segments (or the campaign's own recipient filter).
2. Add filter condition: `WATCH_ROUTE` **contains** `<route-slug>` (e.g. `manchester-lahore`).
3. **Never segment using `WATCH_AIRPORT`, `WATCH_DESTINATION` or `WATCH_REGION`.** Those three
   fields are overwritten on every signup and only reflect a subscriber's *most recent* Route Watch
   signup — for anyone watching more than one route, they do not represent all of their preferences.
   `WATCH_ROUTE` (the comma-delimited, capped list) is the only field that does.
4. **Preview the recipient count before sending.** Confirm it's the small, expected segment for
   that one route — not the shared list Route Watch and Travel Club both write into (see
   `docs/COMMERCIAL_RESET_PHASE_1.md`'s corrected note on this).

## Sending — Brevo Campaigns only

- **Send only through Brevo's Campaign feature.** Never through Resend (the transactional provider
  used by Contact/Quote Request), never a BCC blast, never a manual one-off email client send.
- This is not a style preference — it's the only path that automatically includes a compliant
  **unsubscribe link** and correctly honors anyone who has already unsubscribed. A manual or
  transactional email would not.
- No scheduled or automatic sends. Every send is a deliberate, individually reviewed action.

## After sending — log it immediately, privately

Record the send in a **private operating log kept outside this public repository** (a local file, a
password-manager note, a private founder doc — anywhere that is not committed to this git history).
**The completed log must never be committed to this repository or any public location.** It will
contain real subscriber counts and real send history, which this repository's own content-integrity
rules (see `CLAUDE.md`, "No fabricated content") and ordinary subscriber-privacy practice both mean
should never be public.

The template below defines the *shape* of that private log only — it is intentionally empty here.
Do not fill in real values in this file or anywhere in this repository.

### Private log template (fields only — keep the completed log outside this repository)

| Field | Purpose |
|---|---|
| Route slug | Which pilot route this send was about |
| Route-status event ID | The exact `data/route-status-events.ts` entry (`id`) this send is based on |
| Evidence checked date | When the founder actually reviewed the ledger event and its source |
| Founder approval date | When the decision to send was made |
| Brevo campaign ID | Brevo's own campaign identifier, for cross-checking campaign history |
| Send date | When the campaign actually went out |
| Recipient count | The segment size at send time, from Brevo's own preview/report |
| Outcome / notes | Anything worth remembering — deliverability issues, a reply, a correction needed next time |

## What this pilot is not, and what it must never become without a new, explicit decision

- No sending automation, cron job, or scheduled send of any kind.
- No new analytics event for sends (nothing was added to `lib/analytics.ts`'s event vocabulary).
- No `data/` send ledger or any other code change — the private log above is a document the founder
  edits directly, not something the application reads, writes, or displays.
- No exposure of subscriber counts, email addresses, or campaign statistics anywhere in this public
  repository.
- No real Brevo contacts were created, modified, or emailed as part of writing this procedure.

## When to reconsider building something

Only after the manual pilot has actually run — through at least a small number of real candidate
events — and reveals a specific, concrete friction point (e.g. the duplicate-check is genuinely
error-prone in practice, or segment-preview counts are unreliable). At that point, revisit
`docs/project-control/DECISIONS.md`'s Route Watch entry with the real evidence, and scope any code
change as its own separate, reviewed piece of work — never speculatively ahead of that evidence.
