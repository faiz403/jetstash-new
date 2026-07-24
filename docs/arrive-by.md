# Arrive By — evidence-gated journey feasibility specification

**Status:** ARR-001 research and specification complete. Product implementation is deferred until
the required data contracts have been agreed and tested.

## 1. The product promise

Arrive By helps a traveller make a safer urgent-travel decision when they need to reach a place by
a real deadline: a funeral, wedding, hospital visit, religious journey or business meeting. It is
not a generic itinerary builder and it is not a guarantee that someone will arrive on time.

The question it answers is deliberately narrower:

> Based on the current evidence, is there a plausible, bookable journey that leaves enough stated
> time to reach this destination before the required arrival time?

It should make uncertainty visible. A clear “we cannot verify the final rail or ground segment” is
more valuable than a polished but unsafe door-to-door time.

### The founding example

“I am in Preston. I need to be in Bharuch by 13:00 tomorrow.”

The product must **not** turn that into a made-up statement such as “Manchester via Doha takes 13
hours, then allow one hour for immigration and five for the train.” It may only show a complete
Preston → Bharuch plan when every material segment, transfer and time zone is supported by current
source data. Until then it can still offer useful, honest help:

- show whether a current candidate can reach the relevant airport or city gateway;
- show exactly which onward segment remains unverified;
- direct the traveller to the authoritative provider for that segment; and
- never call a partial plan an arrival estimate for Bharuch.

## 2. Who it is for

The same engine serves several urgent reasons, but the interface must not require a traveller to
disclose a distressing reason.

- bereavement and funerals;
- weddings and family emergencies;
- hospital visits and caring responsibilities;
- deadline-critical work travel; and
- Umrah or other religious journeys with fixed commitments.

“Why are you travelling?” is optional and local to the browser. It can tailor tone, never
eligibility, ranking or advertising.

## 3. Scope: what V1 can and cannot claim

### V1: an evidence-backed feasibility brief

V1 may compare currently sourced **candidate** journeys and present a transparent time ledger. It
must use wording such as “may be feasible”, “requires reconfirmation” and “not enough verified
information to assess”. It may link a traveller to the provider to complete booking.

V1 must not promise arrival, reserve tickets, infer airport queues, assume luggage transfer,
silently substitute an unverified segment, or present a cached schedule as live availability.

### Launch geography and endpoint discipline

Launch one narrow, evidence-complete corridor at a time. An initial scope could be UK local
station/postcode → supported UK departure airport → flight destination airport. A destination
address, secondary-city rail leg or airport taxi leg appears only after its own source contract is
approved.

This is why “Preston → Bharuch” is a flagship **target**, not a launch demo. Full Indian rail
coverage requires a licensed IRCTC Train Information Enquiry Service integration; see §8. A person
may never be shown an assumed Mumbai → Bharuch connection merely because it looks plausible.

## 4. Inputs

| Input | Required | Rules |
|---|---:|---|
| Starting point | Yes | Postcode, locality, station or airport. Keep only for the current request unless the traveller explicitly saves it. |
| Required arrival | Yes | Local date, local time and IANA time zone of the destination. Reject ambiguous or past values. |
| Destination | Yes | Airport, city, station or verified place. Do not map a city to an airport without showing that assumption. |
| Earliest departure | Yes | Defaults to “now”; the traveller can set a later realistic ready-to-leave time. |
| Passport/document readiness | Optional | Offer Travel Ready Check; never infer readiness from nationality, route or trip purpose. |
| Bags, children, mobility, connection preference | Optional | Affects presentation and suitability, never silently changes the timing evidence. |
| Reason for travel | Optional | Used only for compassionate wording in the current client session. Never stored in analytics. |

## 5. The time ledger

Every candidate is a sequence of independently evidenced segments. The result must show where each
minute comes from, instead of hiding it in a single optimistic duration.

```text
ready-to-leave time
  + verified local-transport segment
  + source-stated airport/terminal deadline
  + booked-itinerary connection time
  + verified flight segments
  + verified arrival/rail/ground segment
  = latest evidenced arrival
```

### Required fields for every segment

```ts
type ArriveBySegment = {
  id: string;
  mode: 'walk' | 'rail' | 'coach' | 'road' | 'flight' | 'transfer';
  from: { label: string; timeZone: string };
  to: { label: string; timeZone: string };
  scheduledDeparture: string | null; // ISO instant, never a floating local date
  scheduledArrival: string | null;   // ISO instant, never a floating local date
  availability: 'live' | 'scheduled' | 'unknown';
  source: { name: string; url: string; retrievedAt: string; validUntil: string | null };
  transferProtection: 'single-itinerary' | 'self-transfer' | 'not-applicable' | 'unknown';
  uncertainty: string[];
};
```

No segment without a source, retrieval time and valid-until rule can contribute to an arrival
calculation. “Unknown” is a real state, not a blank to fill with a heuristic.

### Buffers

Arrive By keeps three things separate:

1. **Provider requirement** — an airline, rail operator or airport’s published deadline, with its
   source.
2. **Itinerary protection** — whether the connection is on one ticket, a self-transfer, or not
   known.
3. **Traveller contingency** — an explicit, clearly labelled additional allowance chosen by the
   traveller. JetStash must not market an invented “safe” universal number for immigration,
   baggage or queues.

If a material buffer cannot be evidenced or chosen, the candidate is not “safe”; it is either
“needs confirmation” or suppressed from the deadline comparison.

## 6. Result states and language

| State | When it may appear | Required language |
|---|---|---|
| `candidate-with-buffer` | Complete evidence chain and calculated arrival is before deadline with visible buffer. | “This candidate may reach your destination before the deadline if the current schedule and availability still hold.” |
| `candidate-tight` | Complete chain, but the visible buffer is below the traveller’s chosen contingency or a material risk remains. | “This is tight. Do not rely on it until you have reconfirmed the highlighted segments.” |
| `partial-chain` | One or more material segments lack current evidence. | “We can verify part of this journey, but not the full arrival time.” |
| `no-evidenced-candidate` | Searched sources return no candidate that meets the deadline. | “We could not find a currently evidenced candidate that reaches the destination before your deadline.” |
| `source-unavailable` | A required source, integration or booking result is unavailable/stale. | “We cannot assess this safely right now because a required source is unavailable or out of date.” |

Never say “impossible”, “guaranteed”, “you will arrive”, “fastest” or “easiest” unless the claim
is explicitly defined by the compared, current evidence. The interface can instead label
**earliest evidenced arrival**, **fewest hand-offs**, and **lowest self-transfer exposure**.

## 7. Ranking without a mystery score

Show at most three named candidates, each with its trade-off. Do not reduce life-critical travel to
an opaque 7.8/10 score.

- **Earliest evidenced arrival** — only when the complete chain is verified.
- **Least hand-offs** — fewest independently boarded segments; disclose if it is a self-transfer.
- **Lowest connection exposure** — based on the explicit protection state, not an invented delay
  probability.

The product should let the traveller see the timeline first. A ranking is an explanation layer,
not a black box.

## 8. Source and licensing gate

| Segment | Required source standard | Current finding | Launch consequence |
|---|---|---|---|
| GB rail | National Rail Darwin / Rail Data Marketplace, or an approved licensed equivalent. | Darwin is the GB industry’s official real-time train-running information engine and requires marketplace access. [National Rail](https://www.nationalrail.co.uk/developers/darwin-data-feeds/) | Suitable after credentials, licence review and outage handling are implemented. |
| London local transport | TfL Unified/Journey Planner API. | TfL provides journey planning, disruption and timetable data; usage needs account/key and attribution. [TfL](https://tfl.gov.uk/info-for/open-data-users/unified-api?intcmp=29422) | London legs can be a separate approved adapter, not assumed national coverage. |
| Flights | Live airline booking response or contracted flight-shopping/operational provider, with booking-time reconfirmation. | Flight-shopping providers can return offers, but coverage differs by carrier; Amadeus documents exclusions, including British Airways in its self-service Flight Offers results. [Amadeus](https://developers.amadeus.com/self-service/apis-docs/guides/developer-guides/resources/flights/) | No global “live flights” promise. Coverage is provider- and route-specific. |
| India rail | IRCTC-authorised Train Information Enquiry Service integration. | IRCTC’s TIES policy describes licensed train availability, schedules and boarding information for registered providers. [IRCTC policy](https://contents.irctc.co.in/en/TIES_Policy.pdf) | Full Bharat rail arrival chains stay disabled until a qualifying integration and commercial review exist. |
| Road/last mile | Contracted or provider-authorised journey/booking source with an explicit freshness rule. | No approved source contract yet. | Do not calculate it; present it as an unverified final leg. |

Every adapter must declare its licence, coverage, supported geography, request limit, source URL,
freshness behaviour and failure response before it is enabled. A cached response past its declared
validity must downgrade the result to `source-unavailable` or `partial-chain`.

## 9. Product flow

1. **Tell us where and when.** Starting point, destination and required arrival time.
2. **Confirm what “ready to leave” means.** The traveller chooses their earliest realistic departure
   time and can optionally state bags, mobility and document readiness.
3. **Evidence check.** Arrive By searches only the adapters that can support the requested chain.
4. **Show the decision, not a fake booking funnel.** Present candidates, their full time ledger,
   sources, risks and missing evidence.
5. **Book or verify.** Send the traveller to the relevant provider with the key facts retained in
   the summary. Re-run the check after booking or a provider schedule change.
6. **Travel readiness hand-off.** If a document signal could block the journey, offer Travel Ready
   Check without claiming the route is infeasible solely from an unanswered question.

## 10. Safety, privacy and operations

- Treat exact location, urgent reason, health context and deadline as sensitive. Keep them in local
  request state; do not send them to analytics, Brevo, affiliate parameters or Route Watch.
- No generative route construction. The engine composes only validated segment records.
- Record an internal, non-personal audit event containing adapter versions, source timestamps and
  result state; this is needed to investigate an unsafe recommendation without storing personal
  trip context.
- A provider outage must reduce capability, never cause a fallback to stale cached timing.
- Any wording change must be reviewed against `JETSTASH_PRINCIPLES.md`’s trust-before-marketing
  rule and the rejected “customer-facing arrival promises” decision.

## 11. Technical architecture

```text
Input normalisation
  → source-coverage gate
  → provider adapters (each independently validated)
  → segment ledger
  → timezone-safe feasibility calculation
  → result-state mapper
  → timeline-first UI and provider hand-offs
```

The calculation must be a pure server-side function of the normalised request, sourced segment
ledger and an injected `now` instant. Do not calculate with browser local time, dates without time
zones, or string-sorted local timestamps. A client component may render the briefing, but source
credentials and raw provider responses remain server-side.

Suggested future modules:

```text
lib/arrive-by/
  types.ts                 Request, segment, source and result contracts
  coverage.ts              Fail-closed source/geography gate
  feasibility.ts           Time-zone-safe pure calculation
  presentation.ts          Canonical customer copy for all result states
  providers/               One audited adapter per provider
app/api/arrive-by/         Authenticated, rate-limited server orchestration
components/arrive-by/      Input, time ledger, candidate and uncertainty UI
tests/arrive-by/           Boundary, timezone, stale-source and no-claim regressions
```

## 12. Delivery gates

### Gate A — before any customer-facing prototype

- Source contracts approved for every proposed segment.
- Time-zone and daylight-saving test fixtures for every covered geography.
- Copy review proving that incomplete chains cannot render arrival claims.
- Security/privacy review for location, deadline and urgent-reason input.

### Gate B — limited corridor pilot

- One corridor with an evidence-complete chain, including outage behaviour.
- Human review of every displayed candidate during the pilot.
- No booking commission KPI used as a ranking signal.
- Test cases for source stale, cancellation, self-transfer, missed buffer, unsupported final leg and
  an exact-deadline boundary.

### Gate C — wider rollout

- A source-quality dashboard and scheduled revalidation.
- Formal incident/rollback process.
- Per-corridor enablement; no global switch.

## 13. Success measures

Measure decision quality, not only clicks:

- percentage of requests that produce an evidence-complete chain;
- percentage that correctly fail closed rather than fabricate a final leg;
- source freshness and adapter outage rate;
- traveller use of the “recheck” action after schedule changes;
- provider hand-off completion only as a secondary measure; and
- qualitative feedback from urgent travellers about clarity, not merely speed.

## 14. What makes this defensible

The interface can be copied. The durable asset is a corridor-by-corridor ledger of verified
transfer rules, source reliability, operational constraints and safe failure modes. That is why
Arrive By belongs beside Route Status, Journey Brief and Travel Ready Check: it converts fragmented
travel information into a transparent decision without pretending uncertainty has disappeared.
