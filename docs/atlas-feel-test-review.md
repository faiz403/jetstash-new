# Atlas Feel-Test — Product & UX Review

**Scope:** `/founder/atlas-feel-test`, current build
**Status:** Concept locked — this review contains no implementation, findings only
**Reviewed against:** becoming the real homepage experience
**Reviewer note:** I cannot render or screenshot this build (no working Browser-pane compositing in this environment). Findings below are tagged `[verified in code]` where I confirmed them directly from source/data, or `[needs your eyes]` where only a live visual check can settle it.

At a glance: **4 high-impact**, **6 medium-impact**, **3 low-impact/polish** findings.

---

## 1. What already feels production quality

- **The two-truths data architecture.** Route Status ("how much do we know") and Network Evidence ("can I fly this") are cleanly separate types, separately sourced, never inherited from one another. This is the real foundation of the whole product and it's already right.
- **Real, licensed, sourced geography.** Every coastline is byte-for-byte from a CC BY 4.0 source, never hand-drawn, with full provenance in code.
- **The size-emphasis system is a real algorithm, not a lookup table.** Glow, blur and halo scale from each country's actual path geometry at render time. A twelfth country needs zero code changes to be treated fairly.
- **Nothing is ever fabricated.** "Route intelligence not yet researched" and "Seasonal" are real, sourced, honestly-labelled states — never a guessed score, never a silently dropped destination.
- **Baseline accessibility is already there, not bolted on.** Every interactive element carries `tabIndex`, `role="button"`, and an `aria-label` that never depends on colour alone.

## 2. What still feels like a prototype

- It's founder-gated and force-rendered on every request (`dynamic = 'force-dynamic'` opts out of the six-hour ISR every other JetStash page uses).
- The copy still talks about itself ("Feel test — not the full experience").
- There is no mobile mode at all — the entire interaction model is `onMouseEnter`/`onFocus`, with no tap-equivalent path and no responsive layout, unlike the production `route-map-hero.tsx`, which already has a dedicated mobile chip-selector.
- Nothing tells a first-time visitor the map is interactive.
- The legend only explains three of the states on screen — nothing about "Seasonal" or "Route intelligence not yet researched."
- The destination panel grew in three separate passes, not one deliberate design.

## 3. UX issues (highest to lowest impact)

1. **[HIGH, verified in code] Hover-only interaction excludes every touch device.** No tap-equivalent for `onMouseEnter` anywhere, no separate mobile layout. This alone blocks shipping as-is.
2. **[HIGH, verified in code] Overlapping hit-circles in two country clusters.** From the real coordinates in `page.tsx`: UAE (628, 394) and Qatar (618.56, 390.2) are ~10.2 units apart; Saudi Arabia and Qatar ~16.7 apart; Spain (464.61, 338.83) and Portugal (452.75, 341.03) ~12.1 apart — all closer than the sum of their 12.5-unit hit-circle radii, so the circles genuinely overlap. SVG hit-testing favours whichever element paints last (render order: India → UAE → Pakistan → Qatar → Saudi Arabia → Turkey → Morocco → Spain → Portugal → Greece → Italy), so hovering near the UAE/Qatar boundary silently resolves to Qatar, and near Spain/Portugal resolves to Portugal, regardless of which marker is actually nearer.
3. **[HIGH, verified in code] No visible keyboard-focus state.** `tabIndex`/`onFocus` exist, but nothing styles a focus-visible state on the SVG circles.
4. **[HIGH, needs your eyes] Nothing signals the other ten countries have detail underneath.** Destination markers only render for the active country.
5. **[MEDIUM, verified in data] Six of eleven countries have exactly one destination** (UAE, Qatar, Spain, Portugal, Greece, Italy) — worth deciding on purpose whether a single-destination country should shortcut straight to the destination view.
6. **[MEDIUM, needs your eyes] Ambient routes to all eleven countries render at rest, simultaneously, always** — read as atmosphere at two countries; worth checking whether it still does at eleven, especially through the crowded Gulf/Iberia clusters.
7. **[LOW, verified in code] Inconsistent link labels** — "Route guide" vs. "Explore destination" for parallel actions.

## 4. Visual issues

1. **[HIGH, needs your eyes] Manchester's dominance is untested at eleven-country scale.** The origin glow was tuned to dominate against two countries; the size-emphasis system can now amplify a country's glow up to 3.2× its base radius. Whether Manchester still reads as unambiguously the most important thing on the canvas is the single biggest open visual question.
2. **[MEDIUM, verified in code] Label collision risk in the Gulf and Iberia clusters** — same coordinate proximity as the hit-circle overlap above.
3. **[MEDIUM, verified in code] Licence attribution reads as prototype copy, not a permanent credit.** CC BY 4.0 requires visible attribution; currently a descriptive sentence in founder-tool header copy.
4. **[needs your eyes] Whether the map feels premium-editorial or busy at full scale** — the entire original point of the feel-test, never yet visually checked at eleven countries.
5. **[needs your eyes] Whether the 3.2× emphasis cap looks right across the whole set**, not just India/UAE.
6. **[needs your eyes] Whether the seasonal badge and network-evidence line read clearly in the panel.**

## 5. What should change before production

**P0 — blocking:**
- A real touch/tap interaction mode, most likely converging with the existing `route-map-hero.tsx` mobile chip-selector.
- Fix the UAE/Qatar and Spain/Portugal hit-circle overlaps.
- Add visible keyboard-focus styling.
- Move off `force-dynamic` and the founder gate onto the site's standard ISR and real metadata.

**P1 — should happen, not launch-blocking:**
- Expand the legend to cover every state actually shown.
- Add an onboarding cue for the hover/tap interaction.
- Decide the single-destination-country pattern on purpose.
- A permanent attribution treatment for the licensed geography.
- One deliberate copy/hierarchy pass on the destination panel.

**P2 — polish:**
- Remove founder-tool language ("YOUR DEPARTURE AIRPORT", "feel test" framing).
- Align the "Route guide" / "Explore destination" link verbs.

## 6. What should not change

- **The two-truths architecture** — Route Status and Network Evidence as separate, non-inheriting layers should carry straight into production untouched.
- **Real, sourced, licensed geography** — never revert to hand-drawn landmasses under any circumstance.
- **The generic size-emphasis algorithm** — the design is right; only its tuning constant is an open question, never the approach.
- **Manchester as the single, fixed origin concept.**
- **The refusal to fabricate confidence** — "not yet researched," "seasonal," and every honestly-labelled state are the single most defensible thing about this build.

---

*Waiting for review before any of this becomes a plan. Nothing above has been implemented.*
