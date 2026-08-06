# JetStash Decision Log

Latest decisions override older phase notes. Do not revive a rejected idea without materially new
evidence and an explicit founder decision.

## Approved

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

### Signature Collection visual identity

Use cohesive, owned-feeling JetStash photography and visual direction instead of generic stock.

### Route Intelligence Scoring v2 comes before the next fare-collection batch — completed

Flagged 6 August 2026 after the Manchester–Dubai directness correction, made concrete the same day
by Fare Coverage Expansion Batch A's own audit (Manchester–Amritsar and Manchester–Ahmedabad both
reaching "Strong" on the cheapest possible category combination). Agreed sequencing: Batch A →
Route Intelligence Scoring v2 (`ROADMAP.md` `RIS-001`) → Batch B — **all three now complete**, the
same week. RIS-001 shipped as three independent gates (breadth, category diversity, a
visible-content baseline) on `computeRouteIntelligenceLevel()`, merged `8b1d18d`. Batch B then ran
against the corrected model rather than the loophole it closed. See
`ROUTE_COVERAGE_AUDIT.md`'s "Route Intelligence Scoring v2 (RIS-001)" addendum,
`BATCH_A_COMPLETION_REVIEW.md` §6, and `FARE_COVERAGE_BATCH_B.md` for the full reasoning.

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
