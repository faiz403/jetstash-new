# Atlas Feel-Test — Implementation Roadmap

**Source:** `docs/atlas-feel-test-review.md`
**Branch:** `prototype/atlas-feel-test`
**Status:** No code written — plan only, awaiting approval

Legend: 🔴 Before production · 🟡 Shortly after · 🟢 Future enhancement · ⚪ Reject

---

## Finding 0 — Where does the Atlas actually live in production? *(decision needed before Phase 1 is scoped)*

Not in the original review — the review's "before production" list quietly assumes this is already decided. It isn't.

`app/page.tsx`'s current homepage is a fully working, real production surface: `JourneyDeskHome`, with its own Manchester→Mumbai pull-interaction hero and three-stage photography (per `CLAUDE.md`). "The Atlas becomes the real homepage experience" could mean at least three different things:

- **(a)** it replaces that hero outright,
- **(b)** it becomes a new linked page (e.g. `/atlas`) the homepage points to,
- **(c)** it becomes a new section alongside the existing hero.

Each has a very different blast radius — (a) retires working production UI and needs its own risk review; (b) and (c) don't. Almost every "before production" item below is scoped differently depending on the answer. **Recommend resolving this first, as a decision, before Phase 1 work is scheduled.**

---

## Phase 1 — Production blockers

Nothing here changes the architecture, geography, evidence model, or interaction pattern — only what's needed for the existing prototype to be safe and coherent in front of real users.

| Finding | Type | Complexity | Impact | Depends on | Timing |
|---|---|---|---|---|---|
| Un-gate the route: real ISR, real metadata | Bug | Low | High | Finding 0 | 🔴 |
| Build a touch/tap interaction mode | Bug | **Medium** *(see note)* | High | Finding 0 | 🔴 |
| Fix overlapping hit-circles (UAE/Qatar, Spain/Portugal) | Bug | Low | High | — | 🔴 |
| Keyboard focus visibility on map markers | Accessibility | Low | **Medium** *(see challenge)* | — | 🔴 |
| Visual QA: does Manchester still read as dominant? | Visual polish (conditional) | Low–Medium | High | — | 🔴 |
| Visual QA: label collisions, Gulf/Iberia clusters | Visual polish | Low | Medium | hit-circle fix | 🔴 |
| Visual QA: ambient rest-state routes at 11 countries | Visual polish (conditional) | Low or none | Medium | — | 🔴 |
| Visual QA: 3.2× emphasis cap across all 11 countries | Visual polish | Low | Medium | — | 🔴 |
| Permanent CC BY 4.0 attribution | Bug (compliance) | Low | **Medium** *(reprioritised)* | `components/layout/footer.tsx` | 🔴 |
| Complete the legend | UX improvement | Low | Medium | — | 🔴 *(moved up)* |
| Remove founder-tool language | Visual polish | Low | Low | — | 🔴 *(moved up)* |

**Touch/tap complexity note:** the review didn't estimate this; a blank read would suggest High. Calling it Medium instead — `components/sections/route-map-hero.tsx` already solves the identical problem (its own comment: "tap targets too fine below sm") with an established `lg:hidden` chip-selector pattern. This is adapting a proven in-repo pattern, not inventing one.

**Keyboard focus — challenging the original finding:** the review stated flatly that no focus styling exists. That's not quite right — `app/globals.css` already defines a global `:focus-visible { outline: 2px solid #C8932E; outline-offset: 3px; }` rule via a universal selector, and `components/ui/button.tsx` confirms this is the established site-wide mechanism, not a per-component one. It should already apply to the SVG circles. What's genuinely unverified is whether `outline` renders cleanly on a transparent-fill SVG `<circle>` hit-target across browsers — that's had inconsistent support historically. Reclassified from "build new" to "verify and adjust if needed," so Impact drops from the review's implicit High to Medium.

**Attribution — reprioritised from the review's P1 "should happen" tier:** this is a licence obligation, not a nice-to-have — it should gate any public launch regardless of how small its user-facing impact is.

**Legend and copy cleanup — moved up from "shortly after"/P2:** both are cheap. The legend gap works directly against "honest data only," one of the five architecture principles this rebuild protects; the copy cleanup happens naturally while editing the same file for un-gating.

## Phase 2 — UX improvements

Real gaps, but none block a safe, honest launch.

| Finding | Type | Complexity | Impact | Depends on | Timing |
|---|---|---|---|---|---|
| Onboarding cue for first-time visitors | UX improvement | Low | Medium | touch interaction mode | 🟡 |
| Consistent link-label verbs | Visual polish | Low | Low | — | 🟡 |
| One deliberate pass on the destination panel | UX improvement | Low–Medium | Medium | seasonal/network-note legibility check | 🟡 |

**Onboarding — partial challenge:** India is pre-selected on load, so the panel and one full country are already populated on arrival — this isn't a blank-state problem. Literal instructional copy ("hover to explore") also risks undercutting the premium-editorial tone protected all session. Worth testing a subtle idle-state motion cue on unexplored countries before assuming text is the right fix.

## Phase 3 — Visual polish

| Finding | Type | Complexity | Impact | Timing |
|---|---|---|---|---|
| Legibility check: seasonal badge and network-evidence line | Visual polish | Low | Low–Medium | 🟡 |

## Phase 4 — Future enhancements & rejected

| Finding | Type | Complexity | Impact | Timing |
|---|---|---|---|---|
| Shortcut the two-step interaction for single-destination countries | Future enhancement | n/a | Low | ⚪ **Reject** |

**Why reject:** six of eleven countries (UAE, Qatar, Spain, Portugal, Greece, Italy) reveal exactly one destination; the review suggested skipping straight to the destination view for those. Earlier this session, while building the size-emphasis system, the explicit instruction was: *"I don't want different interaction patterns for different countries… The behaviour should stay consistent… Just make small countries receive proportionally more visual emphasis."* A per-country interaction shortcut is exactly the exception that instruction ruled out, and it would make the pattern less predictable — visitors would need to learn two different interaction depths depending on a fact (destination count) they can't see in advance. Nothing is actually broken by the two-step pattern behaving identically everywhere.

---

*No code has been written. Waiting for approval on Finding 0, and on which findings above are accepted, cut, or reprioritised. Once approved, Phase 1 becomes the actual implementation plan — everything else stays queued.*
