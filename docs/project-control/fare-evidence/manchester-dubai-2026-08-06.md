# Evidence record — Manchester–Dubai fare observation, checked 6 August 2026

**Observation ID this evidence supports:** `obs-man-dxb-economy-20260806-8w-v1` (`data/fare-observations.ts`)

## A note on what "evidence" means in this record

Two screenshots were taken live during this check and reviewed and approved in conversation before
this observation was recorded. **The actual PNG image files could not be saved to a path in this
repository** — the browser tool used for this check renders a screenshot inline for review but does
not expose a file path on disk this session could write to `git`. This is a genuine tooling
limitation, disclosed here rather than silently worked around: no PNG file exists at any path this
document might imply, and nothing should assume otherwise.

What this record contains instead is a complete, literal transcription of every fact shown in both
screenshots — captured via the live page's own accessibility tree and DOM at the same moment the
screenshots were taken, not reconstructed from memory afterwards. Every field below was read
directly off the rendered page. If a durable pixel image is required as well, the two screenshots
shown in conversation should be saved by a human reviewer to `docs/project-control/fare-evidence/`
alongside this file (suggested names: `manchester-dubai-2026-08-06-outbound-select.png` and
`manchester-dubai-2026-08-06-return-select.png`) — this document does not assume that has happened.

## Screenshot 1 — search results, outbound leg selection

**URL:** `https://www.trip.com/flights/showfarefirst?dcity=man&acity=dxb&ddate=2026-10-01&rdate=2026-10-15&dairport=man&aairport=dxb&triptype=rt&class=y&curr=GBP`
**Captured:** 6 August 2026 (site's own on-page freshness stamp read "Last updated: 13:41:54" — timezone not stated by the site and not assumed here)

Confirmed on screen, together, in one view:
- Search bar: **Round-trip**, **Manchester (MAN) → Dubai (DXB)**, **Thu, Oct 1 — Thu, Oct 15**, **1 adult · Economy**
- Sort tab: **Recommended** (active), showing £480 — not the "Cheapest" tab (£469)
- "41 flights found"
- Top result card, exact accessibility-tree text: *"Flight departing from Manchester Airport T2 at 2026-10-01 09:55:00 and arriving at Dubai International Airport T1 at 2026-10-01 22:35:00. The flight duration is 9 hours 40 minutes, including a layover of Bahrain [1h 5m]"*
- Airline: **Gulf Air**
- Price shown on this card: **£480, "Round-trip"**
- Availability badge on this card: **"<9 left"**
- Baggage badge on this card: **"Included"** (icon only, no kg/piece figure — confirmed by DOM inspection, see below)
- "Select this fare" button present (not activated at this point)

## Screenshot 2 — return leg selection, after selecting the Gulf Air outbound

Reached by activating the outbound card's "Select" control (a genuine UI interaction, not a
booking/payment step) — this moved to Trip.com's own "2. Returning to Manchester" step, one step
short of any passenger-detail or payment page. No booking or payment step was reached at any point.

Confirmed on screen, together, in one view:
- Recap bar: **"Depart Thu, Oct 1 · 09:55–22:35 · Manchester–Dubai · 9h 40m"** — confirms the outbound leg above stayed selected
- Search bar unchanged: Round-trip, MAN↔DXB, Thu Oct 1 — Thu Oct 15, 1 adult · Economy
- "24 flights found" for the return leg
- Sort tab: **Recommended** (active), showing £480
- Top result card, exact accessibility-tree text: *"Flight departing from Dubai International Airport T1 at 2026-10-15 21:00:00 and arriving at Manchester Airport T2 at 2026-10-16 07:15:00. The flight duration is 13 hours 15 minutes, including a layover of Bahrain [4h 55m]"*
- Airline: **Gulf Air**
- Price shown on this card: **£480, "Round-trip"** (the same combined total as screenshot 1 — confirms this is the matching return leg for the same £480 fare, not a separate price)
- Availability badge: **"<9 left"**
- Baggage badge: **"Included"** (same ambiguous icon-only badge as the outbound card)

## Baggage — explicitly checked, not assumed

Before accepting "Included" at face value, the DOM was inspected directly (not just the visible
badge) for any hidden or hover-revealed detail:
- Queried every element with a `title` or `aria-label` mentioning baggage/luggage/kg/checked —
  found only the *left-hand filter sidebar's* two checkbox labels ("Checked baggage included",
  "Carry-on baggage included"), which describe filter controls, not this specific result.
- Queried the result card's own markup for baggage-related text — found only the icon's internal
  component name ("BAGGAGE", used as a CSS/component identifier, not customer-facing copy).
- Hovered the baggage icon directly and re-screenshotted — no tooltip appeared.

**Conclusion: no explicit checked-baggage or cabin-baggage allowance (kg or pieces) is disclosed
anywhere in this selection flow, on either leg.** Recorded in the observation as `baggage: 'not
stated'`, per the archive's own standard for exactly this situation — never inferred from the
generic "Included" badge.

## Explicitly not recorded as durable facts

- **"<9 left"** — a live inventory claim, true only at the moment of viewing. Not carried into the
  observation record or any public-facing copy.
- **The page's "Last updated: 13:41:54" timestamp** — shown with no stated timezone. Recorded here
  as-shown for context only; the observation's own `observedDate` (2026-08-06) is the fact that
  matters for the archive, not this ambiguous clock time.
