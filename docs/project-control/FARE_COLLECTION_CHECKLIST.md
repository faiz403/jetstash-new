# Fare Collection Checklist

A step-by-step template for recording one `FareObservation`. `FARE_OBSERVATION_ARCHIVE.md` is the
binding methodology (search configuration, profiles, cadence, review standard); this file is the
worked-through checklist a collector follows in order while actually performing a check, so no
field gets reconstructed from memory afterwards. It exists because Manchester–Dubai's first
publishable observation (6 August 2026) found a real gap this way: directness was not part of the
original collection habit, and a route-level "DIRECT FLIGHT" badge ended up rendered above a fare
that was itself connecting. Every item below exists to make sure that specific mistake, or one like
it, cannot happen silently again.

Do not start a check without reading `FARE_OBSERVATION_ARCHIVE.md`'s "Observation methodology
(binding)" section first — it defines what counts as an allowed manual check at all (no automated
polling, scraping or API harvesting) and the route's stable `profileId`.

## 1. Route

- [ ] Exact route slug (`data/routes.ts`) — the specific UK airport → destination pair, not a
      wider "the region" or "the airline's network" search.
- [ ] Cabin (`Economy` / `Premium Economy` / `Business`).
- [ ] Confirm the route's current `profileId` (or create one, per the binding methodology, if this
      is the route's first check) — a profile must stay stable across a route's series.

## 2. Dates

- [ ] `observedDate` — today, the date the check is actually performed. Never backfilled.
- [ ] `departureDate` — the fixed 8-week-out horizon from `observedDate` (or the route profile's
      documented override), never a date chosen to make a nicer fare.
- [ ] `returnDate` — 14 nights out from `departureDate` (or the route profile's documented stay
      length). Both dates are required for the observation to be publicly displayable at all
      (`isPubliclyPublishable()`).

## 3. Traveller profile

- [ ] One adult, no children, return economy (the baseline profile) — or record and justify the
      exact deviation if this route's profile intentionally differs, per the binding methodology.
- [ ] `observationReason` — one of `routine-weekly`, `routine-fortnightly`, `school-holiday`,
      `religious-peak`, `airline-sale`, `emergency-recheck`, `route-status-recheck`, `other` (with
      the reason spelled out in `priceNote` if `other`).

## 4. Fare

- [ ] `price` — the actual total shown, not the "from" teaser price if the search result page
      shows both.
- [ ] `priceNote` — plain, factual, e.g. `return, per person, one adult`. Add routing/stop detail
      here (see §6) rather than inventing a separate field.
- [ ] `currency` — GBP for this archive.
- [ ] Is this genuinely the top/recommended result, or a hand-picked cheapest fare? State which —
      never silently cherry-pick a coincidentally-low outlier.

## 5. Airline

- [ ] `source` — the airline or provider actually named by the result, never the route's generic
      "known operator" assumption.
- [ ] `observedVia` — `airline`, `trip.com` or `google-flights`.
- [ ] `sourceUrl` — a stable, safe-to-retain manual-check URL, where the source provides one.

## 6. Directness — the step this checklist exists to enforce

- [ ] **Is the specific itinerary this fare was quoted for direct or connecting?** Read this
      directly off the result — never assume it from the route's own verified service state. A
      route being verified direct on one airline does not mean every fare found for that route is
      also direct; a cheaper or different result can genuinely be a different airline on a
      different, connecting routing (exactly what happened with Manchester–Dubai's Gulf Air fare
      against Emirates' verified direct service).
- [ ] Record `fareDirectness` as exactly one of:
  - `'direct'` — **both legs** of the round trip were reviewed and each independently confirmed
    nonstop. A single-leg "Nonstop" label is not enough on its own — see the Manchester–Doha
    correction in `FARE_OBSERVATION_ARCHIVE.md`'s evidence-completeness audit, where an outbound
    labelled "Nonstop" was originally (wrongly) recorded as `'direct'` before the return leg had
    ever been opened.
  - `'connecting'` — **either** leg reviewed shows one or more stops. Unlike `'direct'`, this value
    does not require both legs to have been checked: a confirmed stop on the leg you did review is
    real, positive evidence the round trip is not fully nonstop, whether or not the other leg was
    opened (Fare Coverage Expansion Batch B, 6 August 2026, made this explicit — see below). Record
    **where** the connection is and **how many stops**, with leg-by-leg timings if the source shows
    them, in `priceNote` (see the Manchester–Dubai entry in `FARE_OBSERVATION_ARCHIVE.md` for the
    level of detail expected — airport codes, terminal, layover duration, both legs, where available).
  - `'unknown'` — the source genuinely does not make this determinable, or neither leg shows a
    confirmed connecting stop and the other leg was never reviewed. Record `'unknown'` explicitly.
    **Never leave the field unset** to mean "unknown" — an unset field is reserved for historic
    entries that predate this checklist, not a new observation's honest answer.
- [ ] Never infer this field from the route's `isDirect` flag or `airlineSlugs`. It describes the
      one specific itinerary in front of you, nothing else.
- [ ] **What `'connecting'` means, precisely (added after Fare Coverage Expansion Batch B, 6 August
      2026 — read this before recording a `'connecting'` value from outbound-only evidence).** A
      `'connecting'` value is **itinerary-level evidence** — "this specific fare's reviewed leg
      shows a confirmed stop" — never **round-trip-completeness confirmation** — "both directions of
      this fare are confirmed connecting." When only the outbound was reviewed, always disclose that
      plainly in `priceNote` (Batch B's own convention: "outbound only reviewed... return leg not
      reviewed"), exactly as this checklist already requires for every field. Do not let a
      `'connecting'` value be read, by a future collector or by the archive's own prose elsewhere, as
      implying the return leg was also checked — it wasn't, and the record must keep saying so.

## 7. Baggage

- [ ] `baggage` — what the result explicitly states (a figure, an allowance description), or the
      literal string `not stated`.
- [ ] If the source shows an ambiguous badge (e.g. a generic "Included" label with no kg/piece
      figure), inspect the DOM/accessibility tree directly for a hidden tooltip or fare-rules link
      before concluding `not stated` — never infer a real figure from an ambiguous badge.

## 8. Source and checked date

- [ ] `observedVia` and `sourceUrl` (§5) — already captured.
- [ ] `observedDate` (§2) — already captured. Confirm it matches the day the check actually ran,
      not the day the record was written up.

## 9. Evidence record

- [ ] Write a contemporaneous evidence document under `docs/project-control/fare-evidence/` (see
      `manchester-dubai-2026-08-06.md` as the reference example), captured at the same time as the
      check — not reconstructed afterwards from memory.
- [ ] State plainly and unambiguously whether an image file (screenshot) was actually persisted to
      the repository, or only viewed during the session. Never imply a saved image exists when it
      doesn't — see that same file's "A note on what 'evidence' means in this record" section for
      the exact wording standard.
- [ ] Confirm the evidence record covers every field above, not just the price.

## 10. Publishability result

- [ ] Run `isObservationPublishable()` / `isPubliclyPublishable()` against the new entry (both
      dates present, a real current route record, route status `'direct'` or `'connecting'`) and
      record the result — `true` or `false` — in the archive write-up.
- [ ] If `false`, say exactly why (missing date, route not yet verified, service ended) rather than
      recording the observation silently and leaving its publishability ambiguous.

## 11. Write it up

- [ ] Append the new `FareObservation` to `data/fare-observations.ts` — never edit or overwrite an
      existing entry, even if the fare has since changed.
- [ ] Add a closed-observation section to `FARE_OBSERVATION_ARCHIVE.md` (see the Manchester–Dubai
      entry as the reference example) covering every field above.
- [ ] Re-run the full quality gate (`tsc --noEmit`, lint, `vitest run`, `npm run build`) and confirm
      the affected route/deal pages render correctly — in particular, confirm the `DealCard` badge
      (`getDealFareDirectnessLabel()`) matches the `fareDirectness` just recorded, with no
      direct/connecting contradiction on the card.
