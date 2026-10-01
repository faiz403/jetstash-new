# Arrive By — worldwide airport catalogue (Phase A)

Status: **Phase B built (generic road engine, gated); nothing beyond the four special profiles is publicly enabled.** Originally: architecture only. No airport beyond MAN, ISB, LHE and KHI is publicly enabled. Worldwide
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
No name-based military exclusion. Names such as "Air Station" are unreliable (Nikolski, Alaska and Bareilly, India both carry scheduled passenger service), so every scheduled-service, IATA-coded airport stays catalogued. A joint-use or restricted field being *in the catalogue* never makes it usable: only the capability gate does.

Size: **4,008 airports** across 200+ countries (1,150 large / 2,094 medium / 764 small).

Known limitations, stated rather than hidden:
- `scheduled_service` is OurAirports' community-maintained flag; an airport with seasonal or newly resumed service may be missing or stale.
- OurAirports has no military flag, so a few restricted or joint-use airports may be present that are not open to ordinary passengers; the capability gate (not this list) decides usability.
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

## Phase B: generic road engine (gated)

- One engine: `lib/arrive-by-shared/road-journey.ts` (`computeRoadJourney`) runs every ROAD_PICKUP_FIRST airport from a server-resolved profile. Pakistan's `computePakistanJourney` is now a thin caller with its validated address origin, `Asia/Karachi` and the PK gate, so ISB/LHE/KHI behaviour is unchanged. Timezone, outcome and Routes code moved to `lib/arrive-by-shared/` (the Pakistan paths re-export them).
- One API: `POST /api/arrive-by/road` takes an airport **code** only. It resolves profile, capability, origin (catalogue coordinates or override) and destination policy server-side, ignores any client-supplied coordinates/timezone/country, and returns 404 for a catalogued-only, route_testable, blocked or unknown airport before any Google call. Shares the `arrive-by:<client>` 5/60 s budget. Airport search is local and consumes none of it.
- Identity: `airport-identity.ts` checks a catalogue airport against one Google Geocoding request (typed airport, same country, within 5 km of the catalogue point, name words or IATA in the address). It runs offline as a capability check, never per keystroke or per user request.
- Evidence: a `road_supported` entry must record `checks.identityVerified` and `checks.routeProbed`, enforced when the table loads. The shipped table is still empty.
- UI: `components/arrive-by-road-public.tsx`, reached only for a server-verified `road_supported` airport; labelled "Airport-level estimate".

Before worldwide **public** rollout: add a user-accessible third-party data notice (OurAirports, tz-lookup, timezone-boundary-builder / ODbL) and revisit the in-memory rate limiter (distributed store / hard spend protection) before any indexing or promotion.

## Phase C: capability is not release

Two separate gates. **Capability** (`airport-capability.ts`, evidence in `catalogue/capability-evidence.json`, written only by the operator probe) says whether Arrive By can safely calculate an airport. **Release** (`airport-release.ts`, `ARRIVE_BY_RELEASED_AIRPORTS`, empty) says whether users may use it. A generic airport is publicly journey-eligible only when both hold; `temporarily_unsupported` beats any release; the four explicit profiles are unaffected. The dev-only `ARRIVE_BY_INTERNAL_QA=1` switch is honoured only under `next dev`. Results and the recommended Phase D rule: `ARRIVE_BY_PHASE_C_CAPABILITY_REPORT.md`.
