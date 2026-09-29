# Arrive By — worldwide airport catalogue (Phase A)

Status: **architecture only.** No airport beyond MAN, ISB, LHE and KHI is publicly enabled. Worldwide
enablement is Phases B–D and needs a generic road-first engine, live QA and a founder decision.

## Layers

| Layer | File | Job |
| --- | --- | --- |
| Catalogue | `lib/arrive-by-shared/airport-catalogue.ts` + `catalogue/airports.generated.json` | Airport identity: IATA, ICAO, name, city, country, coordinates, IANA timezone. Says nothing about routability. |
| Overrides | `lib/arrive-by-shared/airport-registry.ts` | Explicit validated profiles (MAN transit-first Terminal 2; ISB/LHE/KHI Pakistan road-first). An override always wins over a catalogue-derived profile. |
| Capability gate | `lib/arrive-by-shared/airport-capability.ts` | `catalogued` → `route_testable` → `road_supported`, plus `special_profile` and the `temporarily_unsupported` kill switch. Only `road_supported` and `special_profile` are journey-eligible. |
| Destination policy | `lib/arrive-by-shared/destination-policy.ts` | `SAME_COUNTRY`, `ALLOWED_COUNTRIES`, `UNRESTRICTED_VALIDATED`. Resolves to the same `expectedCountryCodes` array `destination-resolution.ts` already gates on. |
| Search | `airport-search.ts` (client-safe, list passed in) / `catalogue-search.ts` (server only) | Local string matching; never calls Google. |

`ROAD_CAPABILITY_EVIDENCE` in the capability module is **empty on purpose**. Adding an entry needs real
evidence (identity check against Google + a probe DRIVE route) and a note.

## Data source and licence

- Source: OurAirports `airports.csv` — <https://davidmegginson.github.io/ourairports-data/airports.csv>
- Licence: **Public Domain.** OurAirports states: "All data is released to the Public Domain, and comes with no guarantee of accuracy or fitness for use." Redistribution is permitted.
- Retrieved 2026-09-30; SHA-256 `e5b485bd1453002071231563dcc54fbf1efacb7c3cbaa486c73247b3aa1b2398` (recorded with counts in `catalogue/airports.provenance.json`).
- Timezones are not in the source. They are derived offline, per airport coordinate, by the dev-only `tz-lookup` package (CC0), whose boundaries come from [timezone-boundary-builder](https://github.com/evansiroky/timezone-boundary-builder) (ODbL). We ship only the resulting IANA name per airport, and record the attribution here. `tz-lookup` is a `devDependency` and never runs at request time.

Regenerate: download the CSV, then `node scripts/generate-arrive-by-airport-catalogue.mjs <airports.csv> <YYYY-MM-DD>`.
The script is deterministic and fails loudly on a duplicate IATA code, invalid coordinate or unresolvable timezone.

## Public-airport filter

Included: `large_airport`, `medium_airport`, `small_airport` **with an IATA code and `scheduled_service = yes`**.
Excluded: heliports, seaplane bases, balloonports, closed fields, anything without IATA, anything without scheduled service.
Military: a name that reads as a military installation and not also as a civil airport is excluded. Five airports are excluded this way (full list in the provenance file): KMC, IKO, KWA, BEK, OKY (KMC by explicit review). **IKO (Nikolski, Alaska) and BEK (Bareilly) are flagged in the source as scheduled-service and may be false exclusions — review before Phase D.** Joint-use fields whose name is also a civil airport (e.g. BGW, NKM) are kept.

Size: **4,003 airports** across 200+ countries (1,150 large / 2,090 medium / 763 small), 368 distinct timezones.

Known limitations, stated rather than hidden:
- `scheduled_service` is OurAirports' community-maintained flag; an airport with seasonal or newly resumed service may be missing or stale.
- OurAirports has no military-only flag, so the filter above is name-based plus scheduled-service. A few joint-use airports may be present that are not open to ordinary passengers; the capability gate (not this list) decides usability.
- City strings are OurAirports' municipality (first comma-separated part), so a display city can differ from a traveller's word for it (e.g. DEL is "New Delhi", SYD is "Sydney (Mascot)", ISB is "Attock"). Overrides keep their own display names.
- The catalogue country is where the airport physically is: BSL (EuroAirport) is `FR`.

## Destination policy default

Generic catalogue airports default to **`SAME_COUNTRY`** — an explicit, conservative decision, not an inference. Border airports are opted into wider policies in `CROSS_BORDER_DESTINATION_POLICIES` (GVA, BSL, LUX today). These entries are unvalidated against live routing until Phase C, and widening a policy never makes an airport public — capability is a separate gate.

Limitation: any border-adjacent airport not listed there (e.g. Saarbrücken, Maastricht, airports on the US–Mexico or US–Canada border) rejects destinations across the border until it gets an explicit policy.

## Terminal model

Generic airports use catalogue coordinates as the routing origin and must show **"Airport-level estimate"** (`getEstimateLabel`). Only MAN carries `originPrecision: 'terminal'` (validated Terminal 2). No worldwide terminal support is claimed.

## Bundle and performance

The catalogue JSON is 351 KB raw / ~143 KB gzip. It is imported **only by server code**: `app/arrive-by/page.tsx` resolves a tiny `AirportLookup` for the requested `?airport=` code and passes it to the client shell. `shell-dispatch.ts`, `airport-search.ts`, `destination-policy.ts` and the shell itself import no catalogue data (enforced by `tests/arrive-by-airport-capability.test.ts`). Verified in the production build: catalogue-only strings appear in server chunks and in zero client chunks; `First Load JS shared by all` is unchanged at 103 kB.

For Phase D, when the selector must search all airports, use a server search endpoint or a lazily fetched compact index — not a static import.
