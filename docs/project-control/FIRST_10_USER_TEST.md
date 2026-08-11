# JetStash First 10 User Test — Founder-Led Procedure

**Recorded:** 8 August 2026, alongside `FIRST_100_VISITORS_WORKSHEET.md` as the first-users
measurement pack. **Updated:** 11 August 2026 to cover the current Fare Signal, Manchester–Islamabad
Smart Fare Comparison and Trip.com handoff. **Status:** procedure only — no test has been run yet,
and no results are recorded in this repository. This document defines the task list, the operating
rules, and the shape of the private per-user record; it deliberately contains zero real participant
data.

## What this is, and what it deliberately is not

This is a small, founder-run, unmoderated-style usability check: 10 real people, using the real
production site, attempting realistic tasks without being coached first. It exists to surface
genuine confusion and trust gaps before any redesign decision is made on opinion alone — the same
reasoning `LAUNCH_CHECKLIST.md` item F1 and `CONV-001` in `STATUS.md` already establish for
site-wide analytics: **real evidence before a change, not a guess dressed up as certainty.**

It is not a formal usability lab study, not a statistically significant sample, and not a substitute
for the traffic-volume analytics tracked separately in `FIRST_100_VISITORS_WORKSHEET.md`. Ten
people is enough to catch a repeated, obvious problem — it is not enough to prove a redesign, rank
features, or settle a disagreement about taste.

## Who to recruit

Real people who are not already familiar with JetStash and were not coached on what it does before
the session. Prefer people who genuinely book or help book international travel. A mix of broad
traveller types is more useful than ten similar people — see the private record's "broad traveller
type" field below for the categories to aim to cover (e.g. someone visiting family in South Asia,
a Gulf/Umrah traveller, a general long-haul traveller, or someone with no immediate trip who can
realistically understand the task). Do not impose artificial demographic quotas, and do not recruit
exclusively from people who already know the founder is testing a travel site for them — that primes
the "what does this do" task before it starts. Use participants' normal devices where practical,
especially mobile.

## Before the session — operating rules (do not skip these)

- **Do not explain the site before the test.** No verbal walkthrough, no "here's what this page
  does" before or during Task 1. The homepage has to do that work on its own, or the test has
  already told you it doesn't.
- **Do not fix things while the user is testing.** If they get stuck, let them stay stuck and note
  it — do not point, hint, or nudge them past the exact place they struggled. That struggle is the
  finding.
- **Do not redesign based on one person.** A single participant's confusion is a data point, not a
  verdict. See "Turning findings into action" below for the actual bar.
- **Distinguish a repeated problem from a personal preference.** "I don't love this shade of gold"
  is one person's taste. "I didn't know where to click next" said independently by several people
  in the same place is a real problem. Record both, but do not treat them the same way.
- **Only recommend a product change when the same issue appears repeatedly.** As a working rule of
  thumb: one occurrence is a data point, not a pattern; treat an issue as a real candidate for
  action once it shows up independently across multiple participants, not just once. Do not act on
  a single session's finding alone, however compelling it feels in the moment.

## Opening script

Keep the introduction short and natural:

> I built this website and want to see how clear it is. I won't explain it first because I want to
> see what makes sense naturally. Please think aloud as you use it. I'm testing the website, not you.
> Don't enter any personal or passport information, and don't complete a booking.

Keep each session to roughly 20–25 minutes so that ten real sessions remain practical: a short
introduction, the ten tasks one at a time, and a brief debrief. Do not preview later tasks or turn
the session into a product walkthrough.

## The tasks — give these as plain instructions, not a guided tour

Ask the participant to think aloud as they go. Give one instruction at a time; do not preview later
tasks. Phrase these as neutral prompts, not leading questions — do not say "click the Route Atlas"
if the task is to see whether they can find it themselves.

1. **First impression.** Show them the homepage only. Ask: *"What do you think this website
   does?"* Do not correct or clarify their answer.
2. **Find a relevant route.** Ask them to find information for a flight route that's actually
   relevant to them (their own likely route, or a plausible one if they have no travel plans right
   now). Ask them to show what they would inspect first, and watch how they get there.
3. **Discover coverage.** Ask: *"From the homepage, explore where this site covers."* Do not name
   the Route Atlas beforehand. Record whether they naturally discover and use the map, and what
   they think it does.
4. **Travel readiness.** Ask them to find what they would need to check before travelling to a
   destination of their choice. Then ask: *"What does this result mean to you, and what would you
   do next?"* Do not collect real passport or document information.
5. **Find a fare example.** Ask: *"Find a fare example for a route you are interested in."* Do
   not use internal terms such as "tracked fare" or explain the Fare Signal first.
6. **Understand the Fare Signal.** Once they have found a fare, ask: *"What does this fare
   information tell you?"* Record whether they understand the observed fare, checked date, travel
   dates, airline, routing/directness and that it is not automatically a cheapest-market claim.
   Do not teach these points beforehand.
7. **Compare Manchester–Islamabad.** Ask them to open the Manchester–Islamabad route and then ask:
   *"What differences do you notice between these fare options?"* Do not point them to the £5 /
   2h 45m comparison or identify a preferred option. Record whether they notice price, journey-time,
   routing/connection and baggage differences, and whether they mistakenly think JetStash is choosing
   or recommending a winner. This is not a True Trip Cost test.
8. **Booking hand-off.** Ask: *"If you wanted to continue towards booking, show me what you would
   do."* Before any click, ask: *"Where do you expect this to take you?"* Allow one safe click to
   the current partner handoff where practical, but do not complete a booking or enter payment data.
   Record whether they understand that they left JetStash, Trip.com is the booking partner, the link
   opens separately or in a new tab where applicable, fare/details need checking again, and clicking
   is not equivalent to booking. Do not explain these points beforehand.
9. **Differentiation, trust and confusion.** Ask: *"Compared with where you normally start looking
   for flights, what does this site do differently, if anything?"* Do not ask whether JetStash is
   "better" than a comparison site. Then ask: *"What made you trust or question anything you saw?"
   and *"What, if anything, confused you?"*
10. **Before-booking intent.** Ask: *"Would you use JetStash before booking a flight? Why or why
   not?"* This is intentionally more specific than simply asking whether they would visit again.

## Privacy — read before running a single session

**Never record names, email addresses, passport details, or any other sensitive travel-document
information in this repository, in any form, at any point.** Nothing below asks for that
information anyway — do not add fields that would capture it.

The completed per-user record for each of the 10 sessions is kept in **a private log outside this
repository** (a local file, a password-manager note, or another private founder document — never
committed to this git history, never made public). The table below defines the *shape* of that
private record only. Do not fill in real participant data in this file or anywhere in this
repository — this file stays a template.

### Private per-user record (fields only — keep the completed record outside this repository)

| Field | What to capture |
|---|---|
| Anonymous participant code | A code such as U01 — never a name or contact detail |
| Session date | When the session happened |
| Broad traveller type | A category, never an identity — e.g. "visiting family in Pakistan", "Gulf/Umrah traveller", "business-class flyer", "browsing, no imminent trip" |
| Device/browser | The participant's normal device and browser, where practical |
| First impression (Task 1) | Their own words for what they thought the site does, before any correction |
| First point of confusion | Where they first got stuck or hesitated, in their own words or your direct observation |
| Route discovery | Whether they found a plausible route and what they inspected first |
| Route Atlas discovery/comprehension | Whether they found the map naturally and what they thought it showed |
| Travel Ready comprehension | What they thought the result meant and what they would do next |
| Fare Signal noticed/understood | Whether they noticed it and understood the observed fare, dates, airline and routing limits |
| Smart Fare Comparison understood | Whether they noticed the price, time, routing and baggage differences without being led |
| Recommendation misunderstanding | Whether they treated the comparison as JetStash choosing or recommending a winner |
| Baggage uncertainty | Whether they understood that an unknown baggage amount was not £0 or included |
| Trip.com handoff expectation | Where they expected the click to go before clicking |
| Trip.com handoff outcome | What happened after the safe click and what they understood about leaving JetStash, the partner and rechecking details |
| Differentiation language | Their own words about what JetStash does differently from where they normally look |
| Task completion | Pass/fail per task (1–10 above), noted plainly — not scored or weighted |
| Trust concerns | What they said in the Task 9 trust check, plus anything else they raised unprompted |
| Before-booking intent | Their answer to Task 10, in their own words where possible |
| Direct quotes worth preserving | Verbatim phrases that capture a reaction precisely — keep these anonymous (no name attached), and skip any quote that would identify the person if read on its own |

## After all 10 sessions — turning findings into action

- **Aggregate first, act second.** Look across all 10 private records together before drawing any
  conclusion from a single one.
- **Repeated problem vs. personal preference.** Group findings by task and by theme. An issue that
  independently affected multiple participants at the same point is a real signal. An issue one
  person mentioned, that nobody else hit, stays recorded as a data point — not as a justification
  for a change on its own.
- **Only recommend a product change when the same issue appears repeatedly**, per the operating
  rule above. When a change is recommended, name the exact task and step it affects, and how many
  of the 10 participants independently hit it — do not round up, generalise, or imply a stronger
  pattern than what was actually observed.
- **No aggregate summary belongs in this repository either** if it would reveal individual
  participants' identities or quotes in a way that could be traced back to them — keep the private
  log's raw detail outside the repository, and if a summary of *findings* (not people) is ever
  written up for `LAUNCH_CHECKLIST.md` or `STATUS.md`, it should describe the pattern found, not
  reproduce quotes or identifying detail.
- **Ten people is a start, not a conclusion.** If a genuine, repeated problem is found, treat it as
  evidence worth fixing — but do not treat the absence of a problem in a 10-person sample as proof
  the site works for everyone. Combine this with the real traffic evidence in
  `FIRST_100_VISITORS_WORKSHEET.md` before making a larger claim.

## What this test does not replace

- It does not replace `LAUNCH_CHECKLIST.md` item F1 (real analytics dashboard confirmation) — that
  measures actual visitor behaviour at scale; this measures a small number of people closely and
  qualitatively. Both matter, and neither substitutes for the other.
- It is not a redesign mandate, a scoring rubric, or a formal usability certification.
- It creates no code, no analytics event, and no data file — this is a documentation-only
  procedure, matching the same deliberately-no-code-change approach as
  `ROUTE_WATCH_PILOT_PROCEDURE.md`.
