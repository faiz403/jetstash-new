# Whole Journey Value — Design Brief

Status: design only. This is a product direction, not a public claim or UI
specification.

## Relationship to True Trip Cost

Whole Journey Value is a layered model. Smart Fare Comparison may state factual
differences such as fare, time, stops, connections and baggage status. True
Trip Cost remains the stricter gate: it may calculate a total only when every
mandatory cost component is evidenced. Unknown baggage is never zero.

## Possible evidence layers

1. Fare and mandatory booking charges.
2. Baggage and seat charges when explicitly shown.
3. Verified connection and journey facts.
4. Later, separately sourced airport or ground-transport components where the
   traveller's origin, destination and assumptions are explicit.

No layer may silently fill a missing value with an average, reputation-based
assumption or generic convenience estimate.

## Safe product sequence

- First: Smart Fare Comparison for observed itineraries.
- Second: continue building comparable fare and baggage evidence.
- Third: research permitted, reproducible ground and airport data sources.
- Only then: evaluate whether a public Whole Journey Value output is possible.

Fare Watcher Phase 1 does not change this sequence. Its output is an internal
fare-change candidate, not a value score, recommendation or whole-journey
claim. Any future airport, ground-transport or hotel layer must enter through
its own evidenced observation type and remain comparable before it can be
combined with a fare.

## Prohibited shortcuts

- No estimated meals, taxis, lounges, hotels or airport convenience costs.
- No opaque score, recommendation or “worth it” label.
- No public winner when options trade fare against time or have unequal evidence.
- No affiliate hand-off used as evidence of value.

The eventual product should make the evidence trail inspectable and let a
traveller see which facts are known, unknown or not comparable.
