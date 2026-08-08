# JetStash First 10 User Test — Founder-Led Procedure

**Recorded:** 8 August 2026, alongside `FIRST_100_VISITORS_WORKSHEET.md` as the first-users
measurement pack. **Status:** procedure only — no test has been run yet, and no results are
recorded in this repository. This document defines the task list, the operating rules, and the
shape of the private per-user record; it deliberately contains zero real participant data.

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
the session. A mix of broad traveller types is more useful than ten similar people — see the
private record's "broad traveller type" field below for the categories to aim to cover (e.g.
someone visiting family in South Asia, a Gulf/Umrah traveller, a business-class flyer, someone with
no immediate travel plan browsing out of curiosity). Do not recruit exclusively from people who
already know the founder is testing a travel site for them — that primes the "what does this do"
task before it starts.

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

## The tasks — give these as plain instructions, not a guided tour

Ask the participant to think aloud as they go. Give one instruction at a time; do not preview later
tasks. Phrase these as neutral prompts, not leading questions — do not say "click the Route Atlas"
if the task is to see whether they can find it themselves.

1. **First impression.** Show them the homepage only. Ask: *"Looking at this, what do you think
   this website does?"* Do not correct or clarify their answer.
2. **Find a relevant route.** Ask them to find information for a flight route that's actually
   relevant to them (their own likely route, or a plausible one if they have no travel plans right
   now). Watch how they get there.
3. **Use the Route Atlas.** Ask them to use the interactive map on the homepage to explore where
   JetStash covers.
4. **Use Travel Ready Check.** Ask them to find out what they'd need to check before flying to a
   destination of their choice.
5. **Find a tracked fare.** Ask them to find a real price example for a route they're interested
   in.
6. **Explain the fare.** Once they've found one, ask: *"What does this price actually mean to
   you?"* — listen for whether they understand it's a dated, hand-checked observation rather than a
   live bookable price or a guaranteed cheapest fare.
7. **Find the booking hand-off.** Ask them to show you where they would go next if they actually
   wanted to book this.
8. **Trust check.** Ask directly: *"Do you trust the information on this page? Why or why not?"*
9. **Confusion check.** Ask: *"What, if anything, confused you during this?"*
10. **Return likelihood.** Ask: *"Would you use this site again, or tell someone else about it?
    Why or why not?"*

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
| Session date | When the session happened |
| Broad traveller type | A category, never an identity — e.g. "visiting family in Pakistan", "Gulf/Umrah traveller", "business-class flyer", "browsing, no imminent trip" |
| Device type | Desktop, mobile, or tablet |
| First impression (Task 1) | Their own words for what they thought the site does, before any correction |
| First point of confusion | Where they first got stuck or hesitated, in their own words or your direct observation |
| Task completion | Pass/fail per task (1–10 above), noted plainly — not scored or weighted |
| Trust concerns | What they said in the Task 8 trust check, plus anything else they raised unprompted |
| Found the booking hand-off? | Yes/no — did they find where to continue to Trip.com, and how long did it take them |
| Would return? | Their own answer to Task 10, in their own words where possible |
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
