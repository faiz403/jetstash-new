# JetStash Holidays — Package vs DIY Design Brief

Status: design only. Do not add hotel, package or affiliate integrations yet.
This remains a later product layer, separate from the internal Fare Watcher
foundation and not connected to production UI.

## Initial scope

Start with Antalya, Dalaman, Marrakech and Agadir, then expand only when the
underlying evidence and demand justify it. The product should compare a
traveller's options, not behave like a tour operator.

## Evidence model

For each package or DIY option, preserve the exact checked date, travel dates,
provider, currency, party assumptions, board basis, baggage, transfers,
flight details, hotel details and unavoidable fees. Unknown inclusions remain
unknown; no generic hotel or airline policy is substituted.

## Comparison shape

- Flights plus hotels, where each component is evidenced.
- All-inclusive and other board-basis distinctions.
- Family pricing with ages and room assumptions visible.
- Baggage and transfer treatment shown separately from the headline fare.
- Package versus DIY totals only when every included component and mandatory
  fee is comparable.
- Contextual hotel recommendations based on explicit traveller needs and
  evidenced hotel attributes, never opaque rankings.

## Commercial boundary

Use affiliate or referral hand-offs only after the customer has received a
clear factual comparison. Do not add widgets or new affiliate URLs in this
design phase. Do not imitate tour-operator fulfilment, support or package-sale
obligations before legal review confirms the operating model.

## Required gates before build

1. Confirm legal position for referral-only package comparisons.
2. Confirm permitted provider/API access and price freshness.
3. Define a versioned family and board-basis search methodology.
4. Define expiry, recheck and editorial approval rules.
5. Prove that package and DIY totals are genuinely like-for-like.

## Relationship to Fare Watcher

Fare Watcher may later identify a verified flight observation for an Antalya,
Dalaman, Marrakech or Agadir corridor, but that does not make a hotel or package
price evidenced. A Holidays comparison must retain its own party, board-basis,
bag, transfer and hotel evidence and must not reuse a flight-only fare as a
package total. No candidate alert or affiliate hand-off can auto-create a
holiday recommendation.
