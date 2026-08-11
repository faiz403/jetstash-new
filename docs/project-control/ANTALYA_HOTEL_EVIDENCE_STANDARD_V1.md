# Antalya Hotel Intelligence V1 — Evidence Standard

**Status:** Governance draft for founder review
**Scope:** Documentation only; no UI, hotel inventory, prices or affiliate links are public under this standard.
**Pilot destination:** Antalya, Türkiye
**Initial areas:** Lara Beach, Belek and Side
**Current date:** 11 August 2026

## Purpose and boundary

JetStash may eventually surface a small number of evidence-complete Antalya hotel examples and contextual Trip.com handoffs. This is not a hotel directory, ranking engine or public price-comparison product.

This standard has two separate evidence layers:

1. **Layer 1 — Area and property intelligence:** active for V1 and may begin collection after founder approval.
2. **Layer 2 — Hotel price observations:** blocked pending written Trip.com commercial and usage clarification.

Unknown, stale or unverified information remains unknown. Absence of a restriction in Trip.com's current materials is not permission to display, retain or compare prices.

## Layer 1 — Area and property intelligence (active for V1)

### Area evidence record

Each area record should contain:

- area identity and geographic context;
- Antalya Airport transfer distance or time, with the transport method used;
- neutral beach, resort or city character;
- named practical amenities;
- family facilities only where specifically evidenced;
- all-inclusive inventory evidence, without implying prevalence unless an explicit sample supports it;
- named attractions and access information;
- walkability only to named places with stated distances;
- seasonal caveats;
- source name and URL;
- date checked and review date;
- evidence limitations and unresolved uncertainty.

Prefer factual outputs. For example, **“approximately 25 minutes by car from Antalya Airport”** is acceptable when the route, date and method are recorded. **“Close to Antalya Airport”** is not a sufficient evidence statement.

Area-level character should not be inferred from a single hotel listing. Subjective claims such as quietness, nightlife or walkability require stronger, dated area evidence and should remain absent when that evidence is not available.

### Acceptable area sources

- Antalya Airport and other airport or transport authority sources;
- Turkish tourism authorities, municipalities and official attraction organisations;
- hotel or resort sources for property-specific facilities and location;
- dated map or route checks for named distances and transfer methods;
- reputable independent sources only as corroboration, never as the sole basis for a strong generalisation.

Generic, undated travel-blog language is not JetStash intelligence.

### Operational geography for property evidence

Every future Antalya property record must distinguish authoritative location from provider
marketing shorthand. It must record:

- provider marketing location label;
- exact property address as sourced;
- authoritative operational area;
- authoritative sub-area where relevant;
- geography source and geography checked date;
- provider/geography conflict: `yes`, `no` or `unknown`;
- classification confidence: `strong`, `usable-with-caveat` or `unresolved`;
- classification limitations or notes.

The evidence hierarchy is:

1. official property address;
2. reliable coordinates or location record;
3. municipal or official tourism geography;
4. provider marketing label, retained only as secondary metadata or an alias.

Provider shorthand must never override stronger geographic evidence. If the operational area or
sub-area cannot be resolved, classification is **unresolved** and the property fails closed: it
must not become a public JetStash hotel example.

Operational rules for the initial Antalya research areas:

- **Lara / Kundu:** Güzeloba/Muratpaşa evidence tied specifically to Lara Beach may be classified
  as Lara Beach. Properties in Kundu, Kemerağzı or Aksu are classified as Kundu/Aksu even when a
  provider markets them as “Lara”. Lara Beach and Kundu are not treated as geographically identical.
- **Belek:** Belek, Kadriye, Üçkum Tepesi or Acısu may fall within the operational Belek
  resort/golf grouping where authoritative evidence supports it. Boğazkent does not automatically
  become Belek because a provider includes it in a Belek search; the exact property evidence wins.
- **Side / Manavgat:** Side historic core remains distinguishable from surrounding resort areas.
  Preserve evidenced sub-area names including Kumköy, Sorgun, Titreyengöl, Evrenseki, Çolaklı,
  Gündoğdu, Kızılağaç and Kızılot. Do not silently relabel those properties as Side historic core.

Do not invent kilometre thresholds. A provider page that says “Trendy Lara” while giving a
Kundu/Aksu address, a Side search result that gives an Evrenseki, Kumköy or Titreyengöl address,
or a Belek result with a Boğazkent address illustrates why this classification step is required.

The final public Antalya area structure is **not yet locked**. Research supports a simple
top-level model with visible sub-area distinctions, but actual property evidence must be reviewed
before JetStash decides how areas should be presented publicly. Operational classification and
public navigation are separate decisions; this standard does not prescribe permanent labels such
as “Lara / Kundu”, “Belek / Kadriye” or “Side / Manavgat coast”.

### Property evidence record

One future hotel record must support:

#### Identity

- internal evidence ID;
- hotel name exactly as the source shows it;
- area;
- source/provider and source URL;
- Trip.com hotel URL;
- category or star information exactly as sourced;
- date checked.

#### Property facts

- family room or family accommodation where explicitly shown;
- kids' club where shown;
- children's pool where shown;
- other named children's facilities;
- pool;
- beach access;
- board bases explicitly shown;
- all-inclusive status where shown;
- location;
- separately sourced airport-transfer information where available;
- relevant limitations;
- explicit `unknown` or `not stated` values where evidence is absent.

#### Commercial handoff

- specific Trip.com hotel handoff verified;
- hotel identity preserved through the handoff;
- affiliate tracking verified at the time of checking;
- required affiliate disclosure recorded.

Layer 1 does not require live availability or public pricing.

## Layer 2 — Hotel price observations (blocked)

**BLOCKED PENDING TRIP.COM COMMERCIAL/USAGE CLARIFICATION**

No dated family pricing profile is locked. Do not use the earlier proposal of 6–13 October 2026, children aged 6 and 10, or any replacement dates or ages. The exact profile remains:

> **NOT YET LOCKED**

That is deliberate because Trip.com rights remain unconfirmed for:

- public display of observed hotel prices;
- internal retention of dated prices;
- historical price archives;
- derived comparisons;
- package-versus-DIY calculations;
- required price freshness;
- dynamic dated hotel-link generation.

If this layer is later approved, a record would require:

- exact check-in and check-out dates;
- number of nights;
- adults, children and exact child ages;
- rooms and room type;
- board basis;
- GBP price;
- taxes and mandatory fees;
- cancellation terms;
- availability;
- checked timestamp;
- provider/source;
- transfer inclusion;
- public-display clearance;
- historical-retention clearance;
- comparison clearance.

Unknown must remain unknown. No price from this layer may be public until the rights questions are resolved in writing.

## Safe public language

Potentially safe when the exact evidence is present:

- **“Family room shown.”**
- **“Kids' club listed.”**
- **“Children's pool listed.”**
- **“All-inclusive board shown.”**
- **“Beachfront”** only when the authoritative or property source explicitly says beachfront or on-beach.
- A factual airport transfer time with the transport method stated.
- Named, sourced amenities.

Do not initially use:

- suited to families;
- perfect for families;
- ideal for families;
- close to the airport;
- quieter;
- higher-spec;
- best;
- top;
- recommended;
- bargain;
- great value;
- cheapest.

These are comparative or promotional claims and require a separate approved methodology.

## Neutral property-selection procedure

The initial target is up to **one evidence-complete hotel example per area**:

- Lara Beach;
- Belek;
- Side.

A hotel may appear only when:

1. Its area and location are sufficiently evidenced.
2. Its minimum property evidence record is complete.
3. Its specific Trip.com handoff has been verified.
4. The factual reason it contributes useful intelligence is recorded.
5. No ranking or recommendation claim is needed.

If an area has no evidence-complete hotel, show none. Do not fill a slot for appearance or symmetry.

The neutral framing should be equivalent to **“Examples with verified property information”**, not a JetStash recommendation.

## Freshness and review governance

The following are proposed operational review defaults, not factual claims about hotels:

| Evidence | Operational default | Public behaviour when stale |
|---|---:|---|
| Identity and location | Review every 180 days | Remove or mark unknown |
| Category/star information | Review every 90 days | Do not display as current |
| Facilities | Review every 30–60 days | Remove the affected label |
| Area evidence | Review every 180 days | Remove affected generalisation |
| Board basis for a stay | Check in the same session | Do not carry forward |
| Availability | Same session only | Do not display |
| Cancellation terms | Same session only | State not stated |
| Dated room inventory | Same session only | Do not display |
| Prices | Internal only until rights are cleared | Never publish |
| Affiliate links | Verify at creation and before publication | No CTA if unverified |

Hotel facts and live inventory do not share one freshness interval. A stale or incomplete record fails closed.

## Trip.com handoff model

The safest initial handoff is a verified specific-hotel deep link. An Antalya search link may be used only when its destination context is preserved. Lara, Belek and Side-specific wording must not be used unless area targeting is independently verified.

The safe CTA is:

> **View this hotel on Trip.com**
> Partner link, opens Trip.com in a new tab.

JetStash may promise that the visitor can view the hotel on Trip.com. It must not promise a price, availability, fixed dated stay, room allocation, board basis, cheapest result or package total.

Do not create production links under this document. Any future affiliate URL must come from Trip.com's own tool, remain unedited, preserve hotel identity, and use JetStash's existing sponsored-link and disclosure rules.

## Trip.com rights questions requiring written clarification

1. May JetStash publicly display an observed Trip.com hotel price?
2. May JetStash retain dated hotel prices internally?
3. What historical retention period is allowed?
4. May JetStash show historical lows, medians, ranges or movements?
5. May JetStash calculate derived per-night or other price comparisons?
6. May JetStash perform package-versus-DIY calculations?
7. Are comparisons allowed using only Trip.com data?
8. What freshness interval is required for displayed prices and availability?
9. What affiliate disclosure wording is mandatory?
10. Are dynamic dated and party-specific hotel links supported and permitted?
11. May JetStash reuse hotel names, photographs and room descriptions?
12. How are cancellations, refunds and no-shows treated for commission?
13. Are independent Lara, Belek and Side area links supported?
14. How does Flight + Hotel attribution behave, including dates and party size?

The absence of a restriction in the dashboard or FAQ is not permission.

## Phase boundary

### Phase 1A — Evidence standard

Approve this document and lock the Layer 1 fields and operational review defaults.

### Phase 1B — Area evidence

Collect authoritative Lara Beach, Belek and Side evidence without collecting hotel prices.

### Phase 1C — Property examples

Identify up to one evidence-complete hotel per area using the neutral selection procedure.

### Phase 1D — Founder-only preview

Review the evidence privately before any public integration.

### Public hotel module

Only after evidence review and commercial/legal requirements permit it.

### Price intelligence and Package-vs-DIY

Separate later phases, blocked until Trip.com provides written clarification.

## Repository decision

This document is the governance layer. No hotel data model, UI, price archive or affiliate integration should be created until the founder approves the profile and the Trip.com rights blocker is resolved.
