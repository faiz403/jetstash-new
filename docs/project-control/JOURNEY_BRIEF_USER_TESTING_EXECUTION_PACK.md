# Journey Brief — Controlled User Test Execution Pack

Companion to `docs/project-control/JOURNEY_BRIEF_USER_TESTING_PROTOCOL.md` (the source of truth for
scope, the three core questions, and the readiness gate). This document does not redefine any of
that — it operationalises it into the concrete materials a founder needs to actually run 10–20
sessions consistently: what to say to a participant, what a moderator may and may not do, how to
score an answer repeatably, and what to log.

**No test has been run under this pack. No participant data exists. Every table below is a blank
template.** Do not fill in example rows "for illustration" — a blank template stays unambiguous;
a filled-in fake one risks being mistaken for real evidence later.

## 1. Participant instructions

Read this to the participant verbatim, before they see anything. Nothing here explains what the
page is testing for, what a "correct" answer looks like, or draws attention to any specific
section of the brief.

> *"I'm going to show you a page on a phone/laptop. It's an early, unfinished version of something
> we're building — you're not being shown a finished product. Take your time reading it, however
> long that takes you. When you're done, tell me, and I'll ask a few questions about what you just
> read. There's no wrong answer, and I'm not testing you — I'm testing whether the page itself is
> clear. Please don't worry about being polite about it — if something is confusing, that's exactly
> what I need to find out."*

Do not add anything else. In particular, do not say what the page is called ("Journey Brief"), what
route it covers, that it's about Manchester and Mumbai, or that it involves a "trade-off" — all of
that is for the participant to discover from the page itself.

## 2. Moderator script

**Opening (say this, nothing more):** the participant instructions above.

**While the participant reads:**
- Stay silent. Do not narrate, hover, or point at the screen.
- Do not answer "what does this mean?" if asked mid-read — say only *"Read it however you'd
  naturally read it, and we'll talk about anything unclear once you're done."*
- Note the wall-clock time from when the page is first shown to when the participant says they are
  done reading (see §5, "Time to done reading").

**Once they say they're done:**
- Move the device out of view (turn the screen away, minimise the window, or hand-cover it) before
  asking anything. Do not let the participant re-read while answering.
- Ask the three core questions from the merged protocol, **in order, one at a time**, exactly as
  written there:
  1. *"What's the main trade-off or issue with this specific journey?"*
  2. *"What does JetStash actually know for sure here, and what does it say it doesn't know?"*
  3. *"What would you actually do next, based on this?"*

**Clarification — what is and isn't allowed:**
- Allowed: repeating the question exactly as worded, once, if the participant clearly didn't hear
  or understand the *question* (not the page). Allowed: a neutral prompt for more if their answer
  is very short — *"Anything else you'd add?"* — asked identically for every participant, not just
  the ones giving a weak answer.
- Not allowed, ever: rephrasing a question to make the intended answer more obvious. Not allowed:
  confirming or denying whether part of their answer is right before all three questions are asked.
  Not allowed: referencing specific page content ("did you notice the bit about baggage?") to
  recover a missed answer. Not allowed: letting the participant look at the page again before Q3 is
  answered.

**After Q3:** thank the participant, then it's fine to answer any question they have about the
product itself (the session is over — this doesn't contaminate their recorded answers).

**Between participants:** never discuss one participant's answers where the next participant can
hear them. Never show a participant another participant's written responses.

## 3. The three core questions (reused verbatim — not redefined here)

See `JOURNEY_BRIEF_USER_TESTING_PROTOCOL.md`, "The three questions (ask unaided — do not lead)" for
the full wording and the "looking for" guidance behind each. This pack adds only the scoring rubric
below — the questions themselves are that document's, unchanged.

## 4. Scoring rubric — PASS / PARTIAL / FAIL

Score each question independently, immediately after the session, while it's fresh — not from
memory later. Use the participant's own words as the record of *why* a score was given (see the
participant log's "unaided answer summary" field).

Only a **PASS** counts as "correctly explain" for the readiness gate's 8/10 threshold. PARTIAL and
FAIL both count as not meeting the gate for that participant — the distinction between them exists
for the recurring-confusion-theme analysis in the final readout, not to soften the gate.

### Q1 — main trade-off/issue

- **PASS**: names the actual decisive issue on the page (the self-transfer, the very long duration,
  or the specific long layover) and shows they understood *why* it matters — not just repeating a
  number from the page without connecting it to a consequence.
- **PARTIAL**: gestures at the right area ("it takes a really long time," "there's a stopover
  somewhere") without naming the specific decisive fact, or only produces it after the one neutral
  "anything else?" prompt.
- **FAIL**: names nothing material, names something the page doesn't say, or answers with a price
  observation alone.

### Q2 — known vs uncertain

- **PASS**: names at least one thing JetStash confirmed (e.g. the direct service has ended, or the
  recorded £395 fare) **and** at least one thing the page says is still unconfirmed (e.g. baggage
  cost, whether that exact fare is still available) — both sides present.
- **PARTIAL**: correctly names only one side (either a confirmed fact or an uncertainty, not both),
  or blends the two together without distinguishing which is which.
- **FAIL**: can't name anything from either side, or states something as confirmed that the page
  actually flags as unconfirmed (or vice versa) — **also log this in the misinformation log, §6**,
  since it means the page produced a false belief, not just an incomplete one.

### Q3 — what next

- **PASS**: names an action that matches the page's own "What to do next" section (searching
  current options, checking travel readiness, or adding their dates) in substance, even if not in
  the exact wording.
- **PARTIAL**: names a plausible but generic travel action ("I'd look for flights") without it being
  traceable to what this specific page suggested.
- **FAIL**: "I don't know," silence, or a fabricated action the page never suggested (e.g. "I'd call
  JetStash to book it") — **also log this in the misinformation log, §6**, if it implies a
  capability JetStash doesn't have (a call centre, a booking service, live monitoring).

## 5. Participant log

One row per participant. Fill in immediately after each session.

| Field | Notes |
|---|---|
| Participant # | Sequential, no name — anonymise from the start. |
| Traveller profile/context | e.g. "occasional leisure traveller, visits family in Pakistan yearly" — enough to support the recruitment-mix check in §8, not a full demographic form. |
| Unaided answer summary — Q1 | Their own words, paraphrased if long, verbatim for anything notable. |
| Unaided answer summary — Q2 | As above. |
| Unaided answer summary — Q3 | As above. |
| Q1 result | PASS / PARTIAL / FAIL |
| Q2 result | PASS / PARTIAL / FAIL |
| Q3 result | PASS / PARTIAL / FAIL |
| Confusion observed | Anything that visibly slowed or derailed their reading, even if they ultimately answered correctly (e.g. re-read the same paragraph twice, asked what "self-transfer" meant). |
| Misinformation identified | Cross-reference to a row in §6 if applicable, else "None". |
| Notable wording | Any verbatim phrase worth quoting in the final readout (a strong quote either way — clarity or confusion). |
| Overall pass/fail | PASS only if Q1, Q2 and Q3 are **all** PASS. Otherwise FAIL — no partial credit at the participant level (a participant either clears the bar or doesn't; PARTIAL exists for diagnosis, not for a fractional pass). |
| Time to "done reading" | From the protocol's own recording field — wall-clock time to "I'm done reading." |

## 6. Misinformation log

Separate from the participant log so a real finding can't get lost in routine rows. Log an entry
**only** for something a participant came away genuinely believing that isn't true — not ordinary
confusion or a slow read.

| # | Participant # | What they believed | Why it's wrong | Exact page text that likely caused it | Severity (blocks readiness / worth fixing but not blocking) |
|---|---|---|---|---|---|

A finding belongs here if it matches the protocol's own definition: believing JetStash is quoting a
live, bookable price; believing JetStash recommended one option over another; believing a
capability exists that doesn't (live monitoring, a booking service); or any other factual belief
the page's own text contradicts.

## 7. Final readout template

Complete once all sessions in a batch are done. This is the artefact that actually answers the
readiness question — fill in every field, don't summarise past it.

```
JOURNEY BRIEF — CONTROLLED USER TEST READOUT
Route tested: Manchester -> Mumbai (Journey Brief Phase 1, /founder/journey-brief/manchester-mumbai)
Test date(s):
Moderator(s):
Total participants:

Q1 pass rate:      __ / __ PASS   (__ PARTIAL, __ FAIL)
Q2 pass rate:      __ / __ PASS   (__ PARTIAL, __ FAIL)
Q3 pass rate:      __ / __ PASS   (__ PARTIAL, __ FAIL)
All-3 pass rate:   __ / __ participants passed all three unaided

First-10 gate result (mandatory if N > 10):  __ / 10 passed all three  ->  MEETS / DOES NOT MEET the 8/10 bar
Total-sample result:                          __ / __ passed all three ->  __ %

Recurring confusion themes (list every theme raised by 2+ participants, with which question it affected):
-
-

Material misinformation found: YES / NO
  If YES, list every entry from the misinformation log (§6) by number:

READINESS VERDICT (per the protocol's own gate — both conditions required):
  [ ] >=8/10 (or >=80% at larger N) correctly explained all three, unaided
  [ ] No unresolved material misinformation found
  => READY FOR NEXT PHASE  /  NOT READY — reasons:
```

## 8. Recruitment guidance

10–20 participants, none of whom have seen this page before (per the merged protocol). Practical
guidance for who to approach:

- Prefer people reasonably representative of JetStash's actual audience: UK-based travellers who
  fly to visit family abroad, or who are at least familiar with the idea (Pakistan/India/Gulf travel
  familiarity is a plus, not a requirement).
- Mix frequent flyers and occasional/first-time-in-years travellers — the two groups read fare and
  duration information very differently.
- Mix ages and general comfort with reading web pages/apps where practical — don't recruit only
  people who are already digitally confident.
- Actively avoid recruiting only people who already know JetStash, work in travel, or have seen an
  earlier version of this page — that's the fastest way to get an inflated pass rate that doesn't
  transfer to a real first-time visitor.
- Don't over-engineer this into a formal demographic quota system — a genuinely mixed group of
  10–20 real people is the goal, not a market-research panel.

## 9. Test conditions

- One participant at a time — never test two people together or let one overhear another's
  answers.
- Test on mobile where practical — that's how most real visitors will encounter this page — but a
  laptop/desktop session is acceptable if that's what's available; note which device was used in
  the participant log's context field.
- The participant reads the brief with no explanation beyond §1's script — the moderator does not
  coach, hint, or correct mid-session.
- Record each participant's answers immediately after their session, not from memory at the end of
  a batch.
- Never show one participant another's responses, written or verbal.
- **Do not change the product partway through a test batch.** If a genuine product defect is found
  mid-batch (see the misinformation log), record it and keep testing the *same* version with
  remaining participants in that batch — patching the page mid-batch makes every participant's
  result before and after the patch non-comparable, and the batch can no longer honestly support a
  single readiness verdict. Fix the defect, then start a **fresh** batch against the corrected
  version if a re-test is warranted.

## Readiness gate (preserved exactly from the merged protocol — not restated with different wording)

> At least 8 of 10 (or the equivalent ≥80% at a larger N) participants correctly explain all three
> answers unaided, **and** no unresolved material misinformation is found.

For a batch larger than 10 participants, report **both** results in the final readout (§7): the
first-10 gate result and the total-sample result. This does not change the 8/10 threshold — it
only makes sure a larger batch can't obscure a genuine first-10 failure by averaging it against
a stronger back half, or vice versa.

## What this pack explicitly does not do

- It does not change the protocol's scope, questions, or readiness gate — see the protocol document
  itself for those.
- It does not measure conversion, booking intent, or willingness to pay.
- It does not fabricate or pre-fill any result. Every table above is a blank template for the next
  founder-run batch to fill in and file as its own dated artefact.
