# Fare Coverage Expansion — Batch A Completion Review

**Branch:** `fare/batch-a-fare-coverage-2026-08`
**Closed:** 6 August 2026
**Status:** Complete — 10 of 10 routes, evidence audited and corrected, ready for PR.

This is the permanent record of what Batch A actually did, kept because the batch grew well
beyond "add 10 fares" — it changed the fare methodology (`fareDirectness`, the `'unknown'` value),
`DealCard` directness logic, customer-visible fare coverage, and Atlas confidence for two routes and
one country node. Full detail for each individual decision lives in `FARE_OBSERVATION_ARCHIVE.md`
and `ROUTE_COVERAGE_AUDIT.md`; this document is the one-page summary a future reviewer should read
first.

## 1. The 10 routes

| # | Route | Fare | Airline | Evidence depth | Final `fareDirectness` | Customer-visible? |
|---:|---|---|---|---|---|---|
| 1 | Manchester–Dubai *(PR #74, predates Batch A)* | £480 | Gulf Air | Full round trip — both legs confirmed | `connecting` | ✅ `man-dxb-economy` |
| 2 | Manchester–Lahore | £638 | Turkish Airlines | Full round trip — both legs confirmed | `connecting` | ✅ `man-lhe-economy` |
| 3 | Manchester–Islamabad | £524 | Gulf Air | Outbound only | `unknown` | ✅ `man-isb-economy` |
| 4 | Manchester–Delhi | £481 | Gulf Air | Outbound only | `unknown` | ✅ `man-del-economy` |
| 5 | Manchester–Mumbai | £461 | Gulf Air | Outbound only | `unknown` | ✅ `man-bom-economy` |
| 6 | Manchester–Ahmedabad | £666 | Emirates | Outbound only | `unknown` | ✅ `man-amd-economy` |
| 7 | Manchester–Amritsar | £707 | Etihad and Air India | Outbound only | `unknown` | ✅ `man-atq-economy` |
| 8 | Manchester–Doha | £666 | Qatar Airways | Outbound only (outbound itself nonstop) | `unknown` | ✅ `man-doh-economy` |
| 9 | Manchester–Madinah | £493 | Pegasus and Flynas | Outbound only | `unknown` | ✅ `man-med-economy` |
| 10 | Birmingham–Amritsar | £714 | Air India | Outbound only | `unknown` | ✅ `bhx-atq-economy` *(pre-existing Deal)* |

**Evidence model this batch settled on, going forward:** a route's `fareDirectness` is `'direct'` or
`'connecting'` only when both legs of the round trip were independently opened and read — never
inferred from one leg, never from the airline's general network. Everything short of that is
`'unknown'`, honestly. Dubai and Lahore are the only two routes in the whole archive that currently
meet the full standard; every other Batch A route recorded real, dated, genuine evidence (price,
airline, dates) but an honest `'unknown'` directness.

## 2. What actually changed, beyond "add 10 fares"

- **`FareObservation.fareDirectness` gained a third value, `'unknown'`** — the same pattern
  `baggage: 'not stated'` already used: an explicit, positive statement that a collector looked and
  couldn't determine something, distinct from a field left unset on a historic record.
- **`getDealFareDirectnessLabel()`** (already built during the PR #74 correction) is unaffected in
  its own logic, but this batch is what actually exercised its full resolution order at scale for
  the first time — including the "every source matches a verified operator" fallback tier, and the
  fail-closed path, across 10 real routes rather than 1.
- **7 new `Deal` entries** were added (`man-isb-economy`, `man-del-economy`, `man-bom-economy`,
  `man-amd-economy`, `man-atq-economy`, `man-doh-economy`, `man-med-economy`) — the first time this
  archive's fare data was retrofitted with matching `Deal` cards specifically to make existing
  evidence customer-visible, rather than a `Deal` and its fare observation being added together.
- **Manchester–Amritsar and Manchester–Ahmedabad moved Useful → Strong**, which cascaded into
  **Manchester's India country node moving Mixed → "JetStash knows this country well."** Both
  changes are mechanical consequences of `computeRouteIntelligenceLevel()`'s unchanged threshold —
  neither grade was manually set.

## 3. The audit — what it caught, before any PR was opened

A founder-requested final review (same day, before merge) found two real, would-have-shipped
defects:

1. **8 of the 10 observations had only ever reviewed the outbound leg**, despite `fareDirectness`
   being recorded as if the round trip were confirmed. The most consequential instance:
   Manchester–Doha's outbound was explicitly "Nonstop," recorded as `fareDirectness: 'direct'` — the
   archive's only `'direct'` value — without the return leg ever being opened. **Corrected to
   `'unknown'` on all 8.** No observation was deleted or marked non-publishable; only the directness
   claim was overreaching.
2. **A real, on-page contradiction**: before the 7 new `Deal` entries were added, those same 7
   routes' pages simultaneously showed a real fare (`FareHistoryPanel`, driven by raw observations)
   and "We haven't logged a tracked fare... yet" (`NoFareFallback`, driven purely by `Deal`
   presence) on the same page. **Fixed** by adding the 7 Deal entries — each verified safe
   beforehand (no entry produces an unsupported "Direct flight" claim).

Both corrections are recorded in full in `FARE_OBSERVATION_ARCHIVE.md`'s "Evidence-completeness
audit" section and `ROUTE_COVERAGE_AUDIT.md`'s "Batch A evidence-completeness and
customer-visibility audit" addendum — including a struck-through record of the specific claims that
were found wrong, kept visible rather than deleted.

## 4. Customer-visible fare coverage — before and after

| | Before this batch | After Batch A | After the audit fix |
|---|---|---|---|
| Publishable routes | 9 of 32 | 13 of 32 | 13 of 32 (unaffected) |
| Customer-visible routes (real `Deal` card) | 5 of 32 | 5 of 13 tracked *(7 new routes had no card at all)* | **12 of 13 tracked** |

**One route remains archive-only: Heathrow–Jeddah.** Its observation pre-dates Batch A entirely
(part of the original "Second recorded batch") and has no matching flight-category `Deal` — only a
Business deal and a bundled Umrah package exist. Flagged as a genuine follow-up, not fixed here
because it sits outside Batch A's own scope.

## 5. Known limitations, carried forward honestly

- **8 routes need a genuine second check** (one that actually opens the return leg) before they can
  honestly record `'direct'` or `'connecting'` instead of `'unknown'`. This is real, useful future
  work for whoever next checks these routes — not urgent, since `'unknown'` is an honest state, not
  a broken one.
- **Manchester–Amritsar and Manchester–Ahmedabad read thinner than "Strong" implies.** Both qualify
  on exactly the minimum two categories (`connectingAlternative` + fare), with no baggage guidance,
  no per-airline depth, and no visible source citation on the rendered page. Not fixed — the grade
  is mechanically honest and no fact is fabricated, but the confidence label reads stronger than the
  page does. See §6.
- **Manchester's India country node inherits the same softness** — 2 of its 4 Strong destinations
  (Delhi, Mumbai) are genuinely deep; the other 2 (Amritsar, Ahmedabad) are the bare minimum just
  described. The country-level claim is correctly aggregated under the existing conservative rule,
  but is inflated in practice by those two thinner routes counting equally.
- **Heathrow–Jeddah is customer-invisible** despite being counted in "13 of 32" (see §4).

## 6. Route Intelligence Scoring v2 — now the next serious item, not just a flag

Route Intelligence Scoring v2 was first flagged in `ROADMAP.md`/`DECISIONS.md` on 6 August 2026,
after Manchester–Dubai's own promotion raised the same question hypothetically. **This batch made it
concrete and reproducible**: Amritsar and Ahmedabad are real, currently-live routes that clear
"Strong" on the cheapest possible combination of categories, and the resulting page does not read
as confidently as the badge claims.

**Decision (this review): do not block Batch A on this.** The grade is mechanically honest, no fact
is invented, and the weakness is now fully documented rather than hidden. But **Route Intelligence
Scoring v2 should be the next product-quality phase, before any further fare-collection batch** —
otherwise the next batch of fresh observations risks producing another wave of thin "Strong"
promotions the same way this one did, and the problem compounds with each batch rather than getting
addressed.

**Sequencing agreed:**

1. ✅ Batch A fare coverage (this document)
2. ➡️ Route Intelligence Scoring v2 (next — a founder decision on actual criteria, then implementation)
3. ➡️ Batch B expansion (after, not before, v2 lands)

This order is recorded in `ROADMAP.md` and `DECISIONS.md` as of this review.

## 7. Quality gate (final, before PR)

`tsc --noEmit` clean · `npm run lint` clean · full suite **1361/1361 passing** (61 files) ·
production build succeeds (116 pages) · `git diff --check` clean (LF/CRLF advisories only). Visual
QA at 390×844, 768×1024 and 1440×900 across every newly customer-visible route, `/deals`, the
homepage Atlas, Manchester's India country state, and Manchester–Amritsar/Ahmedabad specifically —
no console errors, no overflow, no on-page contradiction, no unsupported directness claim anywhere.

## 8. Follow-ups tracked elsewhere

- Route Intelligence Scoring v2 — `ROADMAP.md`, `DECISIONS.md` (next phase, per §6 above).
- Heathrow–Jeddah's missing `Deal` entry — flagged in `ROUTE_COVERAGE_AUDIT.md`'s audit addendum.
- 8 routes' genuine second (both-legs) fare check — flagged in `FARE_OBSERVATION_ARCHIVE.md`'s audit
  section; not urgent, `'unknown'` is an honest interim state.
