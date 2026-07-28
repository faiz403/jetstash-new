# Arrive By — Evidence-Gated Product Specification

**Status:** Specification complete; customer-facing implementation remains deferred until the
required schedule and ground-transport inputs are available.

**Owner:** JetStash product and evidence review

## Purpose

Arrive By is for a traveller who has a real-world deadline and needs to know whether a journey is
still realistically possible. It is not a generic trip planner and it is not a promise engine.

Typical situations include a funeral, wedding, hospital visit, religious obligation, business
meeting or any other event where arriving after a particular date and time has serious consequences.

The traveller enters where they are, where they need to be and when they must arrive. JetStash
works backwards from that deadline and compares the fastest and easiest *plausible* journeys using
dated, attributable evidence.

## Non-negotiable trust boundary

JetStash must never say or imply that a traveller **will** arrive by the deadline. Every result must
be framed as an evidence-based feasibility assessment, with its assumptions and uncertainty visible.

If a required input is missing, stale or unsupported, the result must become less specific or stop
with an honest explanation. An empty result is safer than a confident-looking guess.

## Proposed V1 inputs

Required:

- current location (town, postcode or selected map point);
- destination location (town, postcode, airport or named venue);
- required arrival date, time and time zone.

Useful optional inputs:

- number of travellers and children;
- checked baggage;
- mobility or assistance needs;
- passport/document readiness via Travel Ready Check;
- preference for fastest, easiest or a balanced option;
- tolerance for a tight connection;
- reason for travel, used only to tune language and urgency—not to invent priority access.

The reason must never change the underlying transport facts. A bereavement journey and a business
journey use the same evidence model; they differ only in the care and practical guidance shown.

## Journey model

Each candidate is a chain of separately evidenced legs:

1. origin to departure airport;
2. arrival-at-airport buffer and departure processing;
3. each scheduled flight leg;
4. each connection, including the airport and terminal where known;
5. arrival processing, baggage and border-control allowance;
6. destination airport to the final destination.

The earliest plausible arrival is the sum of those legs and their declared buffers. The interface
must show the calculation as a timeline, not hide it behind a single “travel time” number.

### Evidence required for a candidate

- current airline or airport schedule for each flight leg;
- a current, attributable source for operating status and any material service notice;
- a source for minimum connection or terminal-transfer assumptions where they materially affect
  feasibility;
- a current ground-transport estimate from a named provider or official transport source;
- a timestamp and freshness window for every volatile input.

No source means no precision. In particular, JetStash must not invent a connection time, assume a
terminal transfer, or turn a map estimate into a guaranteed road journey.

## Result states

Every candidate must resolve to one of these plain-language states:

### Possible with margin

The evidenced arrival estimate is earlier than the deadline and the documented buffers leave a
meaningful margin. The result still says “based on the checked options,” never “guaranteed.”

### Possible but tight

The evidence points to an arrival before the deadline, but one or more connections or ground legs
leave a small margin. The tight leg is highlighted and the traveller is told what could make the
plan fail.

### Not currently evidenced

The route may exist, but one or more required schedule, connection or ground inputs are missing,
stale or contradictory. JetStash explains what is unknown and gives the next safe action.

### Not feasible from the checked options

The latest evidenced arrival is after the deadline, or every checked option fails a hard constraint.
This is a statement about the options checked at the stated time, not a claim that no itinerary in
the world exists.

## Output for each candidate

Each result should show:

- route name and checked-at timestamp;
- departure airport and each connection;
- an arrival window or estimate with the underlying legs visible;
- the required arrival time beside the estimated arrival;
- the margin in plain language (for example, “comfortable margin” or “very tight”);
- the exact assumptions that matter (baggage, immigration, terminal transfer, onward travel);
- source links for volatile facts;
- a “what could change this” warning;
- fastest and easiest alternatives when both are evidenced.

The primary call to action is practical: check documents, contact the airline, confirm the final
ground leg, or choose a flexible/refundable option. It must not be a fake urgency or an unverified
affiliate push.

## Emergency/deadline mode

Emergency mode is a tone and workflow variant, not a hidden priority channel. It may surface:

- the earliest checked option;
- the least complex evidenced option;
- airline and airport contact guidance;
- document-readiness warnings;
- a reminder to confirm availability directly before travelling to the airport.

It must not claim access to emergency seats, special fares, standby priority or faster immigration
unless a named provider has explicitly confirmed that service for that traveller.

## Data and architecture gates before implementation

Implementation may begin only when JetStash has:

1. a permitted schedule/availability source with freshness and usage terms understood;
2. a reliable source for airport connection and terminal assumptions;
3. a reliable ground-transport source for the supported origin/destination scope;
4. a defined method for handling stale, conflicting or unavailable sources;
5. an audit trail that stores the source, checked time and assumptions used for each result.

The first implementation should be a server-side, testable feasibility engine with explicit source
adapters. It must not scrape search engines, silently reuse stale route facts or put estimates in
the existing route ledger. Route Status remains the sole source of service-change truth; Arrive By
consumes it and adds its own timestamped journey inputs.

## Acceptance criteria for a future V1 build

- A user can enter an arbitrary UK origin, destination and deadline without the UI implying that
  every route is supported.
- Every displayed flight, connection and ground assumption has an attributable source and checked
  time.
- Missing or contradictory evidence produces “Not currently evidenced,” not a fabricated result.
- The timeline exposes the buffers that determine feasibility.
- Tests cover comfortable, tight, impossible, stale-source, missing-ground-leg and conflicting-source
  cases.
- The live site never promises arrival and never presents an estimate as a booking guarantee.

## Explicit non-goals

- No generic Skyscanner comparison clone.
- No automated scraping or retrospective schedule reconstruction.
- No opaque confidence score.
- No emergency-seat marketplace or special-access promise.
- No launch on the homepage before the evidence and source gates above pass.
