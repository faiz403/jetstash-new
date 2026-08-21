# JetStash Decision Log

Latest decisions override older phase notes. Do not revive a rejected idea without materially new
evidence and an explicit founder decision.

## Approved

### Big Review Clean-up Batch 1 — 21 August 2026

A full numerical reconciliation of `main` at `65db09cf39cd8d09e51b458d86a8947351c5edff` (PR #161
merge) against `STATUS.md`. **This is a correction and update entry, not a rewrite of history** —
the 16 August entry below remains an accurate historical snapshot of what was true then; it is not
edited. Current canonical counts (21 August 2026): 206 total `FareObservation` records (up from 119
on 16 August — ordinary editorial fare-collection growth over 5 days, not a data-integrity issue),
181 publicly publishable, 83 of 88 routes with ≥1 publishable observation, 78 of 88 routes with a
current display-ready Fare Signal. Trip.com CTA coverage (45/88 primary + 18/88 fallback = 63/88
working, 25/88 none by design) and curated `Deal` count (49) are unchanged since 16 August — checked,
not assumed.

Two corrections made to previously-stale project-control claims, both found and fixed the same day:

1. `ROUTE_VERIFICATION_CADENCE_POLICY.md`'s Batch 3 entry stated "none of the four [COV-001]
   reclassified routes has ever had a fare observation logged" — false. All four have real, logged,
   date-complete observations, deliberately held out of public view via
   `methodologyExcludedObservationIds` pending a separate founder decision on unlocking them, not
   absent from the archive. The conclusion this sentence was protecting ("no suppressed fare was
   unlocked by this batch") was itself correct; only the stated mechanism was wrong.
2. `STATUS.md`'s `COV-001` ACTIVE-section paragraph still said Manchester–Karachi, Birmingham–Lahore
   and Birmingham–Islamabad "remain explicitly unresolved PIA disputes" — stale since the COV-001
   audit (PR #159, same day) reclassified all three, plus Birmingham–Delhi. The correct, current
   unresolved list is five routes, not three: Birmingham–Ahmedabad, Gatwick–Ahmedabad,
   Heathrow–Dhaka, Heathrow–Sylhet, Manchester–Sylhet.

Also recorded this pass: the PR #155/#156 5-user real-user validation round is complete (see
`PR155_156_VALIDATION_FOLLOWUP.md`'s outcome section) — PR #155's route-vs-fare comprehension fix is
validated by real, uncoached users; PR #156's two exposed defects were fixed at root in PR #161 and
re-validated clean by a subsequent participant. And: the Trip.com dated round-trip handoff's
**affiliate attribution is not yet confirmed** — proved so far only that a 21 August controlled
click through `D19082296` reached Trip.com with its affiliate parameters intact and confirmed the
generic link opens one-way (`flighttype=S`). Attribution itself requires two further conditions:
Trip.com's reporting cycle explicitly including 21 August, and `D19082296`'s click count showing an
increment above its pre-test baseline of 1 click attributable to the test. Even once that clears, it
does not by itself validate the separate, not-yet-built, transformed `/flights/showfarefirst` URL —
that needs its own proof.

### Business truth + project-control reconciliation — 16 August 2026

A full numerical reconciliation of `main` at `9371c3341b1d36ca4c6940d871c0f519c3ffc2e3` against
`STATUS.md`/`ROADMAP.md`. **This is a correction and update entry, not a rewrite of history** — the
older dated decisions below that reference "23 of 32 routes" or similar figures remain accurate
historical snapshots of what was true when they were made; they are not edited. Current canonical
counts (16 August 2026): 119 total `FareObservation` records, 99 publicly publishable, 81 of 88
routes with ≥1 publishable observation, 79 of 88 routes with a current display-ready Fare Signal, 49
curated `Deal` records, 45/88 exact route-specific Trip.com flight handoffs + 18/88 fallback = 63/88
routes with a working CTA (25/88 none, by design), 10 Hotel Intelligence destinations with 29 exact
property-to-affiliate-link mappings (frozen), Google Ads Basic Consent Mode + conversion tracking
live (PR #135), Pilot #2 running with tracking (day-one click counts intentionally not recorded in
project-control docs — they go stale within hours). See `STATUS.md`'s canonical terminology table
for full definitions. Two corrections made to previously-stale STATUS.md claims: the security
headers line ("no CSP/X-Frame-Options/... set") was wrong relative to the actual code even before
this pass — `next.config.js` has set `X-Content-Type-Options`, `X-Frame-Options` and
`Referrer-Policy` for some time; only the CSP itself remains report-only, not enforced, and enforcing
it as currently written would break Google Ads tracking.

### Travel intelligence first; booking second

JetStash should become the first place travellers check before booking. It is not a general
comparison engine or a thin affiliate layer.

### Trust before marketing

No invented fares, frequencies, airlines, timings, urgency or certainty. Advice may delay a
booking and therefore delay commission; that trade is accepted.

### Premium with a genuine “wow” factor

JetStash should feel distinctive and premium, but spectacle must clarify the journey rather than
hide the decision. “Premium” is not permission to accept unclear conversion paths.

### Verified corridor intelligence is the moat

Competitors can copy interface ideas. They cannot instantly copy years of sourced route, document,
service and fare history.

### International platform, specialist depth

JetStash is a UK travel-intelligence platform for international journeys, not a regional-only or
ethnic travel website. South Asia and the Gulf are the current deepest verified route corridors and
must remain prominent specialist strengths, but they must not define the entire first impression.
Platform navigation, global SEO and parent pages should lead with routes, destinations, UK airports
and travel tools. Never claim worldwide route intelligence before the underlying coverage exists;
describe current depth plainly and distinguish route intelligence from lighter destination guidance.

### Route Status is a flagship capability

Service withdrawals, resumptions, frequency reductions, seasonal returns and significant schedule
changes should be first-class, dated and sourced. Route Status V1 is shipped.

### Arrive By is a future flagship

The approved concept is the urgent-arrival feasibility use case: funerals, weddings, hospital
visits, religious travel and deadline-critical meetings. It must compare fastest and easiest
plausible journeys and work backwards from the required arrival time.

### Travel Confidence is evidence, not a mysterious score

Show understandable states and warnings. Do not reduce confidence to an unexplained number.

### Route Watch is human-reviewed today

Route Watch and Travel Club are Brevo-backed, human-operated workflows. They are strategically
connected to other intelligence products but are not automated monitoring or part of the Travel
Intelligence Engine runtime today.

**First operating pilot (7 August 2026 audit, procedure recorded 8 August 2026):** the signup and
storage side of Route Watch is already safe — capped, merged route preferences
(`MAX_WATCHED_ROUTES` in `lib/route-watch-config.ts`), hardened Brevo-lookup handling (A6, PR #82).
What was missing was an operating procedure for the review-and-send side, which `/founder`'s
alert queue has always pointed at without ever defining. The first pilot is deliberately manual —
see `docs/project-control/ROUTE_WATCH_PILOT_PROCEDURE.md` for the exact workflow. No sending
automation, cron job, or new analytics event is being built for this pilot. Real send history lives
in Brevo's own campaign records plus a private operating log kept outside this repository — never a
public send ledger naming real subscriber counts or campaign statistics. A code-based workflow
(e.g. a send-log data file wired into the founder dashboard) should only be considered after the
manual pilot has actually run and reveals genuine, specific friction — not designed speculatively
ahead of that evidence.

**Meaningful lower-fare trigger (PR #143, 17 August 2026):** the operating-truth audit found that
Route Watch's "I care most about a lower fare" intent (relabelled from "Just want the best price" —
same wording-safety reasoning as the label change itself) had no operable trigger at all: no code
path compared a new fare observation against a prior one, and `/founder`'s only existing "consider a
Route Watch send" signal (`engineAlertQueue`) is Travel-Readiness/booking-timing logic, unrelated to
price. PR #143 closes that gap the smallest way available: `lib/route-watch-fare-trigger.ts` reuses
Fare Watcher's existing, already-reviewed evidence engine (`lib/fare-watcher.ts`) unchanged — same
≥£25-and-≥10%-below-median threshold, same ≥3-point comparable baseline, same comparability gate —
filtered to the two qualifications that clear both thresholds together (`standout-candidate`,
`notable-drop`). A bare `new-recent-low` (clears the previous-low bar but not both meaningful-drop
thresholds) is deliberately excluded from this queue, even though it remains valid Fare Watcher
intelligence elsewhere — Route Watch must not quietly weaken JetStash's existing evidence standard
just to keep a queue non-empty. A "first-ever fare evidence for this route" trigger was audited,
found technically provable, and deliberately left out of PR #143's scope: it is a different event
from "a lower fare," and answering a promise the customer didn't make would be its own honesty
problem. Route Watch remains human-reviewed and manual: this PR added a read-only candidate
derivation surfaced on `/founder`, never a send path, a Brevo query, or persisted state. It does
**not** become automated fare monitoring, real-time alerting, continuous market scanning,
cheapest-price tracking, or automatic email sending.

### Signature Collection visual identity

Use cohesive, owned-feeling JetStash photography and visual direction instead of generic stock.

### Route Intelligence Scoring v2 comes before the next fare-collection batch — completed

Flagged 6 August 2026 after the Manchester–Dubai directness correction, made concrete the same day
by Fare Coverage Expansion Batch A's own audit (Manchester–Amritsar and Manchester–Ahmedabad both
reaching "Strong" on the cheapest possible category combination). Agreed sequencing: Batch A →
Route Intelligence Scoring v2 (`ROADMAP.md` `RIS-001`) → Batch B — **all three now complete**, the
same week. RIS-001 shipped as three independent gates (breadth, category diversity, a
visible-content baseline) on `computeRouteIntelligenceLevel()`, merged `8b1d18d`. Batch B then ran
against the corrected model rather than the loophole it closed, merged `0d84c73` after a dedicated
pre-merge truth audit (fareDirectness evidence, the 3 mechanical Strong upgrades' exact gates, no
fare+connectingAlternative-only Strong route, no unsupported DealCard label, 22/32 customer-visible —
all confirmed against the real code, zero defects found). See `ROUTE_COVERAGE_AUDIT.md`'s "Route
Intelligence Scoring v2 (RIS-001)" addendum, `BATCH_A_COMPLETION_REVIEW.md` §6, and
`FARE_COVERAGE_BATCH_B.md` for the full reasoning.

### Batch C is deliberately not the immediate next step after Batch B

Founder decision, 6 August 2026, made after PR #78's pre-merge truth audit came back clean. With 23
of 32 routes publishable and 22 of 32 customer-visible, the fare database is no longer empty — the
open question shifts from "is there any fare evidence" to "are the strongest routes genuinely the
best travel-intelligence pages." Agreed order: (1) let the new system settle and watch real
analytics — route engagement, which fare cards get clicked, which routes receive traffic — before
deciding where to invest next; (2) close the specific, already-known gaps first (Heathrow–Jeddah
still archive-only; the 6 `unverified` routes Batch B excluded still need primary-source resolution;
9 routes remain with no publishable observation at all); (3) then Batch C, reshaped around real usage
data rather than defaulting to "collect 10 more fares" — weighing highest-traffic route completion,
`connectingAlternative`/airline-verification/baggage depth for the 6 routes Batch B left at exactly
one category, and closing the known gaps, against a further pure fare-collection round. See
`ROADMAP.md`'s `FARE-001` entry for the full sequencing note.

### `'connecting'` fareDirectness means itinerary-level evidence, not round-trip completeness

Clarified 6 August 2026, after Fare Coverage Expansion Batch B's pre-merge truth audit confirmed the
batch's own directness rule (a confirmed-connecting outbound alone is enough to record `'connecting'`,
even with the return leg unreviewed) was applied correctly and honestly — but flagged the wording as
worth protecting explicitly for future batches, since `'connecting'` could otherwise be misread as
"both directions confirmed connecting" rather than its actual, narrower meaning: "this fare's
reviewed leg shows a confirmed stop." `FARE_COLLECTION_CHECKLIST.md` §6 now states this distinction
directly, so a future collector inherits the correct meaning rather than reconstructing it from
Batch B's own evidence files.

## Evolved

- Generic homepage hero → cinematic Journey Desk and Manchester-to-Mumbai pull experience → the
  interactive Route Atlas (29 July 2026), an evidence-backed network map replacing the pull
  experience as the public homepage's primary discovery surface.
- Simple airport list → interactive Manchester route experience.
- Basic travel guide → Journey Brief.
- Basic document checker → Travel Ready Check.
- Numeric Travel Confidence Score → transparent evidence states.
- Generic Arrive By planner → urgent, deadline-critical arrival feasibility.
- Airport photography → originally deferred, now returned to the active delivery queue.

## Deferred

- Full Arrive By implementation, pending trustworthy schedule and ground-transport inputs. The
  evidence-gated product specification is complete in `ARRIVE_BY_SPEC.md`.
- Flight-deal automation.
- Broad SEO expansion beyond priority pages.
- Advanced newsletter growth mechanics.
- Route Status expansions beyond the shipped V1.

## Rejected

- Generic stock photography.
- AI-sounding marketing copy.
- Fake urgency, countdown theatre and unsupported fare advice.
- Becoming a worldwide travel site before the UK-departure corridor strategy is proven.
- Returning to GoDaddy Airo.
- Building a general Skyscanner-style comparison clone.
- An opaque `x/10` Travel Confidence Score.
- Customer-facing arrival promises based on guessed schedules or minimum connection assumptions.
- Hardcoded or invented travel facts added merely to avoid an empty state.
