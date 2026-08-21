# Route Page Journey Clarity + Scanability — Validation Follow-Up Procedure

**Recorded:** 21 August 2026, immediately after PR #155 (Route Page Journey Clarity System) and
PR #156 (Route Page Scanability fix) shipped to production. **Status:** procedure only — no test
has been run yet, and no results are recorded in this repository. This document defines the task
list, the operating rules, and the shape of the private per-user record; it deliberately contains
zero real participant data, following the same pattern as `FIRST_10_USER_TEST.md`.

## Why this exists

PRs #155 and #156 were both engineering responses to a real, evidence-backed problem: two
independent first-time users found a route's own verified service and its tracked fare visually
indistinguishable, and the route page was long enough that the actual booking decision (fare,
routing, dates, the route-vs-fare distinction) sat below the mobile fold. Both fixes were validated
against **measured page structure** (a 56/88-route dataset audit for #155; pixel-position
before/after for #156) — that proves the engineering is correct, not that the comprehension problem
the original two users hit is actually gone. Those are different questions. This procedure answers
the second one, the same way the original problem was found: real people, unscripted, using the
production site.

## What this is, and what it deliberately is not

A small, founder-run, moderated usability check — the founder is present live (in person or on a
call) to ask the task prompts and follow-up questions, matching how the original two-user round that
found the #155 problem worked. It is **not** a re-run of the full `FIRST_10_USER_TEST.md` battery
(that test covers the whole site; this covers two specific route pages and two specific fixes), and
it is not a statistically significant sample. A handful of people is enough to catch a repeated,
obvious problem — it is not enough to prove the fix is perfect or to justify a further redesign on
its own.

## Who to recruit

**New people, not the original two testers.** The original two already know what "should" be there
and will unconsciously grade the page against their memory of the old one rather than reading it
cold — that tests recall, not comprehension. Recruit people with no prior exposure to JetStash, the
same recruiting guidance as `FIRST_10_USER_TEST.md`: real people who genuinely book or help book
international travel, not coached beforehand, using their own device where practical (prioritise
mobile — that's where both fixes' evidence was strongest). **5 participants** is a practical target
for this focused follow-up (smaller than the full 10-person battery, since the scope here is two
pages and two fixes, not the whole site) — enough to see whether a problem repeats, not a statistical
claim.

## Before the session — operating rules (identical to `FIRST_10_USER_TEST.md`, restated here)

- **Do not explain the route-vs-fare distinction or point at the "Route service" box before the
  test.** If the fix works, they find it on their own.
- **Do not fix things while the user is testing.** Let them stay stuck; the struggle is the finding.
- **Do not redesign or re-open either PR based on one person.** One participant's confusion is a
  data point. See "Turning findings into action" below for the actual bar.
- **Only recommend a further change when the same issue appears repeatedly** across independent
  participants — not on a single session.

## Opening script

> I built this website and I'm checking how clear a couple of specific pages are. I won't explain
> anything first because I want to see what makes sense naturally. Please think aloud as you go.
> I'm testing the page, not you. Don't enter any personal or passport information, and don't
> complete a booking.

Keep each session to roughly 10–15 minutes — this is two pages and six tasks, not a whole-site walk.

## The tasks — give these as plain instructions, phrased neutrally

Ask the participant to think aloud. Give one instruction at a time; do not preview later tasks or
name any UI element before they've had a chance to find it themselves.

1. **Land and orient (Manchester–Islamabad).** Open `jetstash.co.uk/routes/manchester-islamabad` on
   the participant's own device (prefer mobile). Ask: *"Without scrolling yet, what do you think
   this page is telling you?"* Record what they say before any scrolling.
2. **First scroll — the decision facts.** Ask them to scroll normally, at their own pace, until they
   feel they've seen "the important stuff." Ask: *"Tell me when you feel like you've found the key
   facts — the price, whether it's a direct flight, and how to check current prices."* **Note how
   many scrolls/screens it takes them to say so** — this is the direct, real-world test of PR #156's
   169px/153px measured improvement; do not tell them the target or hint they're being timed.
3. **The route-vs-fare distinction.** Once they've found the tracked fare, ask: *"Is this fare for a
   direct flight or a connecting one? And is that the same as the route's own regular service?"* Do
   not use the words "Route Service callout" or point at any element. Record their exact answer —
   this is the direct test of whether PR #155's fix actually prevents the confusion the original two
   users had, not just whether the callout renders.
4. **What still needs checking.** Ask: *"Based on what you've seen, what would you still need to
   check yourself before booking?"* Record whether they mention baggage, exact dates, or booking
   terms unprompted, and whether they noticed the caveat text near the price/CTA.
5. **A second route, no mismatch (Glasgow–Bodrum).** Open `jetstash.co.uk/routes/glasgow-bodrum`
   fresh (a route where the tracked fare matches the route's own direct service, so no "Route
   service" callout renders). Repeat task 2's question: *"Tell me when you've found the key facts."*
   Then ask: *"Does anything here feel incomplete or missing, compared to the last page?"* This
   checks that the fix doesn't create an expectation gap — a participant who now expects a callout
   on every page would be a real finding.
6. **Booking hand-off.** On either page, ask: *"If you wanted to continue towards booking, show me
   what you would do."* Before any click, ask: *"Where do you expect this to take you?"* Allow one
   safe click to Trip.com where practical; do not complete a booking. Record whether they understand
   they're leaving JetStash and the fare/details need re-checking.

## Privacy — read before running a single session

**Never record names, email addresses, passport details, or any other sensitive travel-document
information in this repository, in any form, at any point.** The completed per-participant record is
kept in **a private log outside this repository**, exactly as `FIRST_10_USER_TEST.md` requires. The
table below defines the *shape* of that private record only — this file stays a template.

### Private per-participant record (fields only — keep the completed record outside this repository)

| Field | What to capture |
|---|---|
| Anonymous participant code | A code such as V01 — never a name or contact detail |
| Session date | When the session happened |
| Device/browser | Their normal device and browser, mobile prioritised |
| Task 1 — first impression, pre-scroll | Their own words for what the unscrolled page told them |
| Task 2 — scroll count to key facts (Manchester–Islamabad) | Approximate number of scrolls/screens before they said they'd found price, direct/connecting, and the CTA |
| Task 3 — route-vs-fare answer | Their exact answer to "is this fare direct or connecting, and is that the same as the route's own service" — pass/fail against the real facts (PIA direct route, Etihad connecting fare) |
| Task 4 — what still needs checking | What they named unprompted, and whether they noticed the caveat text |
| Task 5 — scroll count (Glasgow–Bodrum) | Approximate number of scrolls/screens on the no-mismatch route |
| Task 5 — expectation-gap check | Whether they said anything felt missing or incomplete without the callout |
| Task 6 — handoff expectation | Where they expected the click to go before clicking, and what they understood after |
| Direct quotes worth preserving | Verbatim phrases that capture a reaction precisely — anonymous, skip anything identifying |

## After all sessions — turning findings into action

- **Aggregate first, act second** — look across every private record together before concluding
  anything from one session.
- **Repeated problem vs. personal preference**, exactly as `FIRST_10_USER_TEST.md`'s rule: an issue
  that independently affects multiple participants at Task 3 (the route-vs-fare question) or Task 2/5
  (scroll count still feels long) is a real signal worth a further PR. A single person's phrasing
  preference is not.
- **Two possible outcomes, both legitimate:**
  - If participants consistently answer Task 3 correctly and reach the key facts in materially fewer
    scrolls than the pre-fix baseline (roughly 1 screen at mobile, per the #156 measurement), both
    fixes are validated by real comprehension, not just by page structure — close this follow-up and
    log the result in `STATUS.md`.
  - If the same confusion recurs (e.g. participants still can't tell the route's real service from
    the tracked fare, or still don't reach the key facts quickly), that is new evidence for a further,
    narrowly-scoped fix — not a reason to revert #155/#156, which are independently correct on the
    evidence that shipped them.
- **No aggregate summary belongs in this repository** if it would reveal individual participants'
  identities or quotes traceable back to them — keep the private log's raw detail outside the
  repository; a findings summary written up for `STATUS.md` should describe the pattern found, not
  reproduce quotes or identifying detail.

## What this does not replace

- It does not replace `FIRST_10_USER_TEST.md`'s full-site battery, and finding no problem here is
  not evidence the rest of the site works well.
- It is not a redesign mandate for either PR — the bar for acting on a finding is a repeated,
  independent occurrence, per the operating rules above.
- It creates no code, no analytics event, and no data file — documentation-only, matching
  `FIRST_10_USER_TEST.md` and `ROUTE_WATCH_PILOT_PROCEDURE.md`'s same approach.
