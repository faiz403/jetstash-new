# Journey Brief — User Testing Protocol (Manchester → Mumbai pilot)

Status: protocol only. No sessions have been run under it and no participant data exists yet —
see this doc's own "Do not fabricate results" note. This document is the template for the next
controlled round; it does not itself constitute the readiness gate being met.

## Scope

This protocol tests **one page only**: `/founder/journey-brief/manchester-mumbai`
(`FOUNDER_DASHBOARD_ENABLED=true` or localhost). It is founder-only, not publicly reachable, and
this pilot does **not** expand it to a second route or make it public — see
`docs/project-control/STATUS.md`'s "Programme state" for why Manchester–Mumbai (not
Manchester–Islamabad, where the separate Journey Choice pilot lives) is the correct scope.

A 5-person founder-run comprehension test already ran once (5 Sept 2026) and found one
launch-blocking usability defect — a scroll/focus bug across the entry→result transition — which
was fixed and merged (PR #235). This protocol is for the next, larger round (10–20 participants)
that decides whether the brief is ready to move from "founder-only prototype" to "controlled
traveller pilot."

## What is being tested

Not the fare, not the route facts, not Travel Ready's visa logic — those are already covered by
their own canonical source-of-truth and test suites. This protocol tests one thing only: **can an
unaided first-time reader correctly explain the brief back, in their own words, within about 30
seconds of reading it?**

## Participants

- 10–20 people, none of whom have seen this page before.
- No specific travel-industry background required — the target reader is an ordinary traveller
  comparing a real trip, not a JetStash team member.
- Recruit a mix of people who would and wouldn't naturally consider a self-transfer itinerary
  acceptable, so the "what you could miss" and duration-reflection copy get exercised by readers
  with genuinely different personal thresholds — the exact kind of variation Reddit experiment #2
  surfaced qualitatively.

## Session script

1. **Do not explain the page first.** Say only: *"I'm going to show you a page. Take your time
   reading it, then I'll ask you a few questions. There's no wrong answer — I'm testing the page,
   not you."*
2. Show the participant the Manchester → Mumbai Journey Brief, already in its **result** state
   (submit the entry form for them beforehand, or ask them to submit it with today's date as
   departure/return so the observer isn't seen steering their answers) so the timed part is the
   result view itself, not the setup form.
3. Let them read at their own pace. Note the time from first render to when they say they're done
   reading (not a hard 30-second cutoff — the target is "roughly half a minute," not a stopwatch
   fail).
4. Once they say they've read it, remove the page from view (turn the screen away, minimise the
   window) and ask the three questions below **in order, one at a time**, without repeating any
   wording from the page itself.

## The three questions (ask unaided — do not lead)

1. **"What's the main trade-off or issue with this specific journey?"**
   Looking for: the self-transfer / long layover in Katowice, or the general "this takes a very
   long time" point — not a price observation alone, and not something invented that isn't on the
   page.
2. **"What does JetStash actually know for sure here, and what does it say it doesn't know?"**
   Looking for: they can name at least one confirmed fact (e.g. the direct service has ended, or
   the recorded £395 fare) AND at least one item from "What remains unconfirmed" (e.g. baggage
   cost, whether the fare is still current) — not just one side of that pair.
3. **"What would you actually do next, based on this?"**
   Looking for: something that matches the page's own "What to do next" section (search current
   options, or check travel readiness, or add their dates) — not a fabricated action the page
   never suggested, and not "I don't know."

Do not accept a paraphrase of the page's own headline sentence as a full answer to Q1 if it's
plainly just repeating the words without the participant showing they understood *why* it matters
(e.g. reciting "43 hours" without connecting it to the self-transfer or the layover).

## Recording

For each participant, record a single row:

| # | Q1 correct (Y/N) | Q2 correct (Y/N) | Q3 correct (Y/N) | All 3 (Y/N) | Notable misreading, verbatim | Time to "done reading" |
|---|---|---|---|---|---|---|

"Notable misreading" is for anything that suggests actual misinformation — e.g. a participant
believing JetStash is quoting a live, bookable price, or believing JetStash has recommended one
choice over another. Record the participant's own words, not a summary, so a genuine
misinformation finding can be traced back to the exact sentence that caused it.

## Readiness gate

The pilot is ready to move from "controlled user test" toward a real traveller-facing pilot only
if **both** of the following hold:

- **At least 8 of 10 (or the equivalent ≥80% at a larger N) participants correctly explain all
  three answers unaided.**
- **No unresolved material misinformation is found** — no participant came away believing a false
  claim about price, availability, or a recommendation JetStash didn't make.

Falling short of either bar means: fix the specific evidenced misreading (word the copy more
plainly, reorder if the actual issue is discoverability, or add a missing signpost) and re-test
with fresh participants — not declare success on a partial result, and not lower the bar after
seeing the numbers.

## What this protocol explicitly does not do

- It does not measure conversion, booking intent, or willingness to pay — those are commercial
  questions for a later, separately-authorised pilot phase, not this comprehension test.
- It does not test the entry form itself (dates, passport fields) — only the result view's
  comprehensibility, which is the part Astra's "30-second brief" target is actually about.
- It creates no new analytics/tracking infrastructure. If a session is observed live (recommended
  for the first round), take notes manually; the existing `journey_brief_started` /
  `journey_brief_completed` events already fire and can be checked afterward if useful, but no new
  telemetry is built for this protocol.
- It does not fabricate or assume results. This document is the template only — a completed run's
  actual filled-in table, participant count, and pass/fail verdict must be recorded as its own
  dated follow-up, never invented to satisfy this readiness gate.
