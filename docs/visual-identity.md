# JetStash Visual Identity System v2

This is the single source of truth for every visual element on JetStash — still photography
and interactive product experiences alike. It exists so that fifty images and a handful of
interactive systems, built months apart by different people, still read as one product.

**This is v2 of this document.** v1 was photography-only. It stopped fitting once JetStash grew
an interactive proof-of-product (the Manchester–Mumbai pull interaction) that couldn't honestly
be governed by rules written for still frames. See "Migration notes" at the end for what changed
and why.

The site works fully without any photography file: every slot falls back to the on-brand
generated `<DestinationMark />` panel or the standard hero gradient. Images go live by dropping
correctly named files into `/public/images/` — no code changes (see "Implementation" near the
end).

**The governing question for every visual element, static or interactive:**

1. Why does this asset exist?
2. What responsibility does it have?
3. How should it behave?
4. How should it be evaluated?

A visual element is not judged primarily by whether it looks impressive in isolation. It is
judged first by whether it fulfils its documented responsibility. Aesthetic refinement is a
second, later conversation — see `VISUAL_REVIEW_CHECKLIST.md` for the review order this implies.

> **Interactive visual systems exist to demonstrate the product. Editorial photography exists to
> establish place, atmosphere and trust.** That one distinction is the reason this document has
> two separate parts rather than one set of rules stretched to cover both.

---

## Part I — Visual Principles

These apply to every visual element regardless of medium — a still photograph and an animated
data-driven interaction are both accountable to all seven.

1. **Purpose before aesthetics.** Every visual element must have a documented responsibility
   within the product before its execution is discussed. A beautiful asset performing the wrong
   job is still a poor design decision — see Part IV's Lifecycle Status column and Design
   Decision DD-003.
2. **Trust before spectacle.** Nothing on JetStash may claim more certainty, drama or urgency
   than the underlying evidence supports. This is the same rule that governs the site's written
   content (no invented fares, frequencies or urgency) applied to imagery: no fabricated scale,
   no implied confirmation of something unverified, no manufactured tension.
3. **Editorial honesty.** A visual element represents the product and the journey honestly. An
   interactive system representing live or ledger-backed data must never imply more certainty
   than that data actually carries (see Part III, "Live data").
4. **Visual restraint.** Calm, human-scale, editorial — never HDR punch, never gimmick, never
   spectacle for its own sake. This applies as much to an animation's easing curve as it does to
   a photograph's colour grade.
5. **Cohesive colour and material language.** Every visual element — photographed or rendered —
   is built from the same "Ink & Brass" language the rest of the product uses (`tailwind.config.js`
   / `app/globals.css`), so photography, UI and interaction read as one object, not three.
6. **Accessibility.** Every visual element must remain legible and usable for someone who cannot
   see fine colour distinction, cannot or does not want animation, or is not using a pointing
   device. This is a first-class requirement, not a later pass.
7. **Human-centred storytelling.** The subject is always the traveller's experience — arrival,
   anticipation, confidence, honesty about what's known and unknown — never the aircraft, the
   airline or the technology for its own sake.

Deliberately not included here: any principle about motion, transitions or animation. Those
govern interactive work specifically and belong to Part III, because a static photograph has no
motion to reason about — a principle that only applies to half of what this document covers isn't
actually shared, and listing it here would misstate what these seven rules are for.

---

## Part II — Editorial Photography

Governs every still photograph on the site. If you are producing or commissioning a photograph,
read this part and nothing else.

### 1. The photography language

One sentence: **the quiet moment of arrival, at golden hour, with the aircraft as a guest in the
scene — never the subject.**

Every JetStash photograph obeys all nine rules:

1. **Aircraft as narrative, not hero.** A commercial passenger aircraft appears naturally —
   distant on approach, taxiing beyond a fence line, a wing over a city, contrails above a
   landmark. Small in frame (5–15% of width). Never a brochure-style close-up, never nose-on.
   **No visible airline livery or logos** — generic white/grey fuselage only (trademark safety +
   timelessness). See Design Decision DD-005 for why this rule is non-negotiable rather than a
   style preference.
2. **The landmark anchors the story.** Each destination is identified by one iconic, unmistakable
   landmark, placed on a rule-of-thirds intersection.
3. **Golden hour only.** Warm low sun (within ~40 minutes of sunrise/sunset), long soft shadows,
   gentle atmospheric haze. Night, midday and blue-hour images are off-brand.
4. **Premium travel-magazine aesthetic.** Editorial, calm, human-scale. No HDR punch, no drone
   gimmicks, no fisheye, no Instagram saturation.
5. **Consistent grade — "Ink & Brass".** Shadows lifted toward deep ink blue (`#0B0E14`),
   highlights rolled toward warm brass (`#C8932E`), midtone saturation −15 to −25%, subtle film
   grain, no crushed blacks. This mirrors the site palette so photography and UI feel like one
   object.
6. **Headline-safe composition.** The upper third of every frame is calm negative space (sky,
   haze, gradient light) — headings sit there. Detail lives in the lower two thirds.
7. **16:9 masters at 2400×1350 minimum.** Export JPEG quality ~80 (or AVIF/WebP).
8. **Mobile-safe centre.** All critical content (landmark + aircraft) inside the central 60% of
   frame width — phones crop 16:9 to roughly 4:5 via centre crop.
9. **One story per frame.** One landmark, one aircraft, one light direction. If a frame needs a
   caption to explain itself, it fails.

**Documented exceptions to rule 1** (aircraft omitted entirely, out of reverence): the Umrah
region hero, Amritsar's Golden Temple, and Madinah's Prophet's Mosque. Applied identically
regardless of which faith's holy site is depicted — see Design Decision DD-006.

**Documented exception to the "aircraft as guest" framing**: `business-class` — "the wing itself
— closest the brand ever gets to the aircraft." A deliberate, single, explicit exception for the
one page where the aircraft interior is the actual product being described. It is not a licence
to bring the aircraft closer elsewhere.

### Master AI prompt template

Every prompt below is a `[SUBJECT]` clause dropped into this template:

> Cinematic editorial travel photograph, golden hour, [SUBJECT], a distant commercial passenger
> aircraft with plain unbranded livery [AIRCRAFT], premium travel magazine aesthetic, warm amber
> highlights and deep ink-blue shadows, muted colour grade, soft directional light, gentle
> atmospheric haze, subtle film grain, clean uncluttered composition, calm negative space across
> the upper third of the frame for a headline, landmark positioned on a lower rule-of-thirds
> intersection, shot on medium format, photorealistic, 16:9 — no text, no logos, no airline
> branding, no people looking at camera

Negative prompt (where supported): `logo, airline livery, text, watermark, HDR, oversaturated,
fisheye, night, neon, crowds facing camera, lens flare spots`

### Alt text policy

Alt text in code is derived automatically from the data layer (see Implementation) in the form
**"{landmark or scene}, {city}"** for destinations and **"{airport name}"** for airports; hero
backdrops are decorative (`alt=""`, `aria-hidden`) because the heading beside them carries the
meaning. The per-image alt in Part IV is what the derived text will effectively say — keep
filenames matched to slugs and it stays correct.

### File system & naming convention

```
public/images/
  heroes/        <key>.jpg          page hero backdrops (keys listed in Part IV)
  destinations/  <slug>.jpg         one per destination (24)
  airports/      <slug>.jpg         one per UK airport (11)
  guides/        <slug>.jpg         one per guide (9, optional tier)
```

Accepted extensions in priority order: `.avif`, `.webp`, `.jpg`, `.jpeg`, `.png`. The build scans
these folders and wires everything automatically. **Deal cards reuse the destination image of
their `toDestinationSlug`** — deals never need their own files, which is what keeps the brand
coherent as fares rotate.

---

## Part III — Interactive Visual Systems

Governs every animated, data-driven or gesture-based visual experience — the Manchester–Mumbai
pull interaction today, and whatever is built alongside or after it. **These are product UI, not
photography**, and are accountable to a different set of questions. Principles come first, worked
examples afterwards, so the standard stays independent of any one current implementation — see
Design Decision DD-002.

### Principles

**Responsibility.** An interactive visual system exists to improve understanding of the product.
Animation must never exist purely for decoration — if a motion or transition could be removed
without the user understanding less, it shouldn't be there.

**Information hierarchy.** At every point in an interaction, the user should be able to answer
three questions: what just changed, why did it change, and what should I notice next. If an
interaction can't answer all three at any given moment, its hierarchy needs rework, not better
polish.

**Motion.** Motion reinforces comprehension. It never competes with content and never exists to
distract from information the user actually needs. Easing and timing follow the same restraint
principle as photographic grading (Part I, principle 4) — motion is calm and legible, not showy.

**State transitions.** Every interactive system must have documented, deliberate behaviour for:
entering, leaving, expanding, collapsing, and — where relevant — pull or drag gestures and
progressive disclosure. "What happens when the user does nothing" and "what happens when the user
does the wrong thing" are both states that need an answer, not just the happy path.

**Live data.** Where a visual represents live or ledger-backed information (Route Status,
fare observations, readiness checks), the visual must never exaggerate or imply certainty that
does not exist, and must visibly distinguish verified data from illustrative or decorative
graphics. This is the interactive-systems equivalent of Part I's "editorial honesty," and it is
the one principle with a real enforcement mechanism already in the codebase: the Route Status
ledger is fail-closed by design (`lib/route-status-copy.ts`) — an interactive system consuming it
must never re-derive a more confident-looking state than the ledger actually returned.

**Accessibility.** Every interactive system must specify: behaviour under reduced motion,
keyboard reachability, touch-target sizing, visible focus states, and colour contrast. Not a
later audit pass — part of the system's own definition.

**Performance.** Every interactive system must specify: how it avoids layout shift, how it keeps
animation lightweight (imperative DOM writes driven by a ref rather than per-frame React state,
where applicable — see the Manchester–Mumbai example below), and what it costs on a mid-range
mobile device, not just on a development machine.

### Implementation examples (current implementations — not the definition of the standard above)

**Manchester → Mumbai pull interaction** (`components/homepage-v2/pull-brief.tsx` /
`pull-brief-hero.tsx`). *Lifecycle status: In Production.*

- **Responsibility**: prove the product, not set a mood. Every other image on the homepage is
  atmosphere; this one is evidence — it's the mechanism by which a first-time visitor watches
  JetStash verify a specific route's status live, sourced from the Route Status ledger. Nothing
  else in the visual system carries that job.
- **Structure**: three separate photographs (Manchester airport, a bridging composite, Mumbai)
  cross-faded and scaled against one continuous pull-progress value. The middle image is
  documented in the component's own code comment as "the visual bridge through the middle of the
  pull" — a transition device between two states, not a single frame depicting continuous flight.
  That distinction was deliberately verified against the actual implementation before being
  written here, rather than assumed (see Migration notes).
- **Live data**: the verdict text is generated entirely from `getEffectiveRoutePresentation()` /
  `FlagshipStatusCopy` — this component has no independent narrative of its own about the route's
  status, by design.
- **Performance**: progress and gesture state are held in refs and applied via direct attribute
  writes (`applyP()`), not React state, specifically so the animation doesn't re-render on every
  frame of a drag gesture.
- **Accessibility**: reduced-motion is checked once (`reducedRef`) and disables the drag pipeline
  in favour of an instant crossfade on click.

**Future interactive route map.** *Lifecycle status: Planned — concept only, not yet specified.*
Referenced here as a placeholder so the eventual specification has a home, not because a design
exists yet. Do not treat anything about it as decided until a real specification replaces this
paragraph.

**Travel Ready Check.** *Lifecycle status: not yet audited against these principles.*
`lib/travel-ready-check.ts` computes readiness as a small set of explicit states (including an
honest `not-enough-information` fallback rather than a guess), but this document has not yet
reviewed how those states are visually represented in `components/travel-ready/`. Flagged here as
a known follow-up rather than described speculatively.

---

## Part IV — Visual Asset Catalogue

Every entry below carries a **Lifecycle status**, not just a filename:

| Status | Meaning |
|---|---|
| In Production | Live — real asset, wired into the product, in use today |
| Placeholder | Documented and wired in code, but no real asset exists yet — currently rendering the generated fallback panel/gradient |
| Planned | Documented only — not yet wired into any code path |
| Deprecated | Scheduled for removal |
| Internal | Founder/internal tooling only, not customer-facing |

Purpose and responsibility are stated once per category (they're shared across every row in that
category) rather than repeated 24 times with the same words — see Migration notes for why.

### Homepage

| | |
|---|---|
| **Filename** | `heroes/homepage.jpg` |
| **Purpose** | Set the tone for the interactive route map beneath it — not to impress on its own. |
| **Responsibility** | Calm atmospheric backdrop only; the interactive route map is the actual hero object. |
| **Lifecycle status** | **Planned** — fully documented, zero code references anywhere in the app. Confirmed by direct search, not assumption. |
| **Subject** | High-altitude view across a sea of golden-hour cloud, the sun low on the horizon |
| **Landmark** | None — this is the brand frame, not a destination |
| **Aircraft** | Single aircraft crossing lower-right third, seen from slightly above, faint contrail |
| **Composition** | Upper two-thirds calm gradient sky (headline and route map sit over it); cloud texture confined to lower third |

### Region & vertical heroes (`heroes/<key>.jpg`)

Purpose: decorative backdrops that establish regional/topical mood beneath the ink hero overlay.
Responsibility: set atmosphere only — never carry information the heading beside them doesn't
already state.

| Key | Subject & landmark | Aircraft | Composition note | Lifecycle status |
|---|---|---|---|---|
| `pakistan` | Badshahi Mosque's domes and minarets from a Lahore rooftop, kite birds circling | Tiny, high, on approach far left | Minarets lower-right third; hazy amber sky upper half | In Production |
| `india` | Humayun's Tomb, Delhi, seen across its char bagh garden | Distant contrail crossing upper-left | Dome on right third line; garden geometry leads the eye | In Production |
| `gulf` | Dubai Creek with traditional abras crossing, skyline soft in haze behind | Descending far beyond the skyline, small | Creek water lower third catching gold light | In Production |
| `umrah` | The Makkah skyline at dusk-gold from a respectful elevated distance, Abraj Al Bait clock tower in haze | None (deliberate — reverence; see DD-006) | Skyline in lower quarter, vast calm sky above | In Production |
| `family-holidays` | Wide empty beach at golden hour, two distant families walking at the waterline, gentle surf | High and small, climbing out over the sea | Horizon on lower-third line | Placeholder |
| `business-class` | Aircraft wing over golden cloud from a window seat, warm cabin light edge in frame corner | The wing itself — closest the brand ever gets to the aircraft (documented exception, Part II) | Wing diagonal from lower-left; sky calm above | Placeholder |
| `travel-club` | Dawn airport apron seen through a rain-flecked terminal window, warm interior reflection | One aircraft at a distant gate, tail catching first light | Strong upper negative space | Placeholder |
| `deals` | Departures board style abstraction: warm-lit terminal architecture, long shadows, one traveller with a trolley walking away | Visible through the terminal glass, taxiing | Architecture lines converge lower-right | Placeholder |
| `routes` | Great-circle view: coastline and city lights fading into golden haze from altitude | Wingtip entering frame corner | Curvature of coast echoes the site's route-arc motif | Placeholder |
| `guides` | Flat-lay-free alternative: open kraft notebook, boarding pass and passport on a warm wooden café table by a window, airport beyond | Blurred through the window glass | Objects lower half; window light upper half | Placeholder |
| `airports` | UK airport pier at sunrise, wet tarmac reflecting amber sky | Two aircraft nose-to-tail at gates, unbranded | Reflections double the golden light | Placeholder |
| `about` | Empty premium cabin row bathed in window light, seatbelt neat on the seat | Interior — implied | Honest, quiet, unstaged | Placeholder |
| `contact` | Warm-lit writing desk by a window at dusk, city and distant airfield lights outside | Landing lights of one aircraft descending, tiny | Desk lower-left; sky negative space | Placeholder |
| `quote-request` | Family luggage lined in a hallway at dawn, front door open to warm light | None — the trip is about to begin | Doorway light on right third | Placeholder |
| `destinations` (hub) | *Not yet specified — documented here for the first time as part of this refactor.* | — | — | Planned (code-wired, no brief existed before this document) |
| `travel-ready-check` (hub) | *Not yet specified — documented here for the first time as part of this refactor.* | — | — | Planned (code-wired, no brief existed before this document) |

The last two rows are genuinely new — `heroKey="destinations"` and `heroKey="travel-ready-check"`
are both live in code with no file and, until this document, no brief at all. They need actual
art direction, not just a status label; flagged rather than invented here.

### UK airport pages (`airports/<slug>.jpg`)

Purpose: tell the story of that specific airport, not aviation in general.
Responsibility: **the airport as the community's doorstep** — always from a human vantage point
(fence line, terrace, car park roof, approach road), never sterile airside stock. Aircraft
unbranded. Alt derives as "{Airport name}". See Design Decision DD-001.

| Slug | Subject & local anchor | Aircraft positioning | Note | Lifecycle status |
|---|---|---|---|---|
| `manchester` | Viewing park fence line at sunset, families silhouetted, Pennine haze behind | Wide-body rotating on take-off, centre-right, climbing left-to-right | The brand's flagship airport image | In Production |
| `birmingham` | Approach over suburban Midlands rooftops and gardens at golden hour | Low on final, gear down, upper-centre, small | Rooftop chimneys lower third | Planned |
| `london-heathrow` | Myrtle Avenue-style green with picnicking plane-watchers, west London haze | Heavy wide-body overhead on approach, high in frame | The classic — kept calm, not looming | Planned |
| `london-gatwick` | Sussex field edge with oak tree, terminal glowing far beyond | Climbing out above the tree line, distant | Rural-meets-runway contrast | Planned |
| `birmingham-east-midlands` | Flat East Midlands horizon, freight sheds catching last light | One aircraft on distant roll, silhouette | Honest about its cargo character (documented exception to the passenger-community framing) | Planned |
| `leeds-bradford` | High Yorkshire ridge line, dry-stone wall leading to the airfield plateau | Lifting off into a big Pennine sky, left third | Highest airport in England — show it | Planned |
| `glasgow` | Wet apron reflections, Kilpatrick Hills behind in amber haze | Turboprop and jet nose-to-tail at gates, far side | Scottish light: soft, silver-gold | Planned |
| `bristol` | Rolling North Somerset fields, hot-air-balloon speck on the horizon | Departing jet banking gently right, small | Balloon nods to Bristol without cliché | Planned |
| `liverpool` | Mersey estuary glinting beyond the runway threshold | On short final over the water, centre | Water light does the work | Planned |
| `newcastle` | Northumberland fields, distant Cheviot line, golden stubble | Climbing north, tail catching sun, right third | Big-sky composition | Planned |
| `edinburgh` | Firth of Forth shimmer with the bridges as silhouettes far off | Descending over the water toward camera-left | Bridges tiny — landmark discipline | Planned |

Note: `glasgow`'s "wet apron reflections" and `liverpool`'s "runway threshold" lean closer to
airside language than the rest of this table's community-vantage framing — worth a deliberate
check against the doorstep rule when these are actually produced, not just carried forward
unexamined.

### Destination pages (`destinations/<slug>.jpg`)

Purpose: anchor arrival at a specific, real, recognisable place.
Responsibility: **arrival** — one iconic landmark, aircraft as a small guest, golden hour. Alt
derives as "{tagline} — {city}, {country}". All 24 are **In Production** — this is the one
category fully realized end to end, matching the founder-confirmed status in `STATUS.md`.

**Pakistan**: `lahore` (Badshahi Mosque), `islamabad` (Faisal Mosque / Margalla Hills), `karachi`
(Mazar-e-Quaid).
**India**: `delhi` (Humayun's Tomb), `mumbai` (Gateway of India), `amritsar` (Golden Temple — no
aircraft, reverence, see DD-006), `ahmedabad` (Sabarmati riverfront / Ellis Bridge).
**Gulf & Saudi Arabia**: `dubai` (Burj Khalifa from the desert edge), `doha` (Museum of Islamic
Art), `jeddah` (Al-Balad old town), `madinah` (Prophet's Mosque — no aircraft, reverence).
**Turkey**: `istanbul` (Süleymaniye Mosque), `antalya` (Kaleiçi old harbour), `dalaman` (Ölüdeniz
lagoon), `bodrum` (Bodrum Castle), `izmir` (Konak Square clock tower).
**Morocco**: `marrakech` (Koutoubia minaret), `agadir` (kasbah hill), `casablanca` (Hassan II
Mosque), `tangier` (kasbah walls / Strait of Gibraltar).
**Mediterranean**: `barcelona` (Sagrada Família), `faro` (Ria Formosa lagoon), `athens`
(Acropolis), `rome` (St Peter's dome).

Full per-slug subject clauses (landmark, aircraft position, prompt text) are unchanged from v1 —
carried forward without edits per the "don't rewrite what already works" rule; see the file
history for the complete table if the compact list above isn't enough detail for a specific slug.

### Guides (`guides/<slug>.jpg` — optional tier)

Purpose: editorial backdrop texture, not information.
Responsibility: decorative only (`alt=""`); warm window light, shallow depth, no faces. All 9 are
**In Production**.

`visa-processing-booking-date`, `eid-diwali-vs-school-holiday-pricing`,
`direct-vs-gulf-connecting-fares`, `what-umrah-package-actually-includes`,
`when-business-class-sales-happen`, `esim-vs-local-sim`, `travel-insurance-family-visit-trips`,
`checked-baggage-allowances`, `comparing-airlines-same-route`.

### Deals

**No dedicated deal photography.** Deal cards inherit `destinations/<toDestinationSlug>.jpg`
automatically. Deliberate: fares rotate weekly, destinations don't, and one image per destination
is what keeps a wall of deal cards looking like a brand rather than an aggregator.

### Internal tooling (not customer-facing — kept separate per Migration notes)

| Asset | Where | Lifecycle status |
|---|---|---|
| Founder Journey Brief visual pattern (`journey-brief-hero.tsx`, `journey-brief-manchester-mumbai.tsx`) | `/founder/journey-brief/manchester-mumbai` | Internal — resolves `getAirportImage('manchester')` + `getDestinationImage('mumbai')` directly rather than the composite; undocumented pattern, lower priority than customer-facing gaps above |

---

## Documentation audit appendix

Performed by cross-checking three independent sources against each other: this document, every
live `getHeroImage` / `getDestinationImage` / `getAirportImage` / `getGuideImage` / `heroKey` call
site in the codebase, and the actual file inventory in `public/images/**`. Not assumed from any
one source alone.

**Fully documented, wired and photographed:**
- Destination imagery — 24/24
- Guide imagery — 9/9
- Region heroes — `pakistan`, `india`, `gulf`, `umrah`

**Documented and wired, no file yet (Placeholder — silently rendering the generated fallback,
not broken, but not real photography either):** `family-holidays`, `business-class`,
`travel-club`, `deals`, `routes`, `guides` (hero), `airports` (hero), `about`, `contact`,
`quote-request` — 10 of the 15 documented hero briefs. Airport photography: 10 of 11 UK airports
(all but Manchester) — this specific gap is already tracked as `VIS-001` in `ROADMAP.md`, not new.

**Documented, not wired, no file (genuinely inert):** `homepage`.

**Wired and photographed, not documented before this refactor:**
`heroes/manchester-mumbai-journey` — now covered in Part III.

**Wired, not documented before this refactor, no file (also Placeholder):** `destinations` hub
hero, `travel-ready-check` hub hero — now listed in Part IV with briefs still to be written.

**Internal tooling, tracked separately:** the Founder Journey Brief pattern (see Part IV).

No further gaps were found beyond the above — every `getHeroImage`/`getDestinationImage`/
`getAirportImage`/`getGuideImage` call site in the app has been traced to a row in Part IV.
`app/**/opengraph-image.tsx` files were checked and confirmed out of scope — they use
`ImageResponse` directly and don't go through this manifest system at all.

---

## Design Decisions

A record of *why* this document is structured the way it is, for future contributors — not a
changelog of every edit.

**DD-001**: Airport hero images represent the airport as the community's doorstep, not as
aviation infrastructure. Established because the alternative — airside/operational imagery —
already has its own correct home (the `airports` hub hero) and forcing the same register onto
individual airport pages would make every one of them read as generic aviation stock rather than
a specific place.

**DD-002**: Interactive visual systems are governed separately from editorial photography, with
principles defined before any current implementation is shown as an example. Established to
prevent the standard from silently becoming "whatever the Manchester–Mumbai interaction currently
does" — the principles must be able to judge that implementation, not be derived from it.

**DD-003**: Visual assets are evaluated by documented responsibility before aesthetic preference.
A beautiful asset that performs the wrong job is still a poor design decision. This reframes
review from "does this look good" to "does this fulfil what it's for" — see
`VISUAL_REVIEW_CHECKLIST.md`.

**DD-004**: Photography and interaction are treated as different design disciplines with
different governing questions (camera/light/landmark/emotion vs.
understanding/state/motion/data), not as one ruleset stretched to cover both.

**DD-005**: Aircraft are never shown with airline livery or branding, anywhere on the site. Not a
style preference — JetStash's core positioning is multi-airline, verified route intelligence; a
hero image dominated by one airline's branding directly contradicts that neutrality regardless of
how well it's executed.

**DD-006**: Sacred and religious sites (Umrah, Amritsar's Golden Temple, Madinah's Prophet's
Mosque) are shown without an aircraft in frame, applied identically regardless of which faith's
site is depicted. A deliberate, repeated exception, not an inconsistency.

---

## Migration notes (v1 → v2)

**Why the structure changed.** v1 was organized by asset type (homepage, region heroes, airports,
destinations, guides) inside a single photography document. That worked while every visual asset
on the site was a still photograph. It stopped working once the Manchester–Mumbai pull
interaction — the site's most-viewed, most narratively important visual element — had no honest
place in a document whose every rule assumed a single fixed frame (golden hour, camera position,
landmark). Reorganizing by design discipline (Part I principles → Part II photography → Part III
interactive systems → Part IV catalogue) gives every future visual element, whatever medium it
uses, somewhere to live without triggering another restructure.

**What moved without being rewritten.** All of v1's photography rules, the master AI prompt, the
naming convention, and every existing per-asset table are carried forward with their original
wording intact — reorganized into Part II, not rewritten. Nothing in Part II's guidance was
found wrong during this refactor; only its position in the document changed.

**What's newly written.** Part I (generalized from v1's opening paragraph, with anything
photography-specific removed), all of Part III (the interactive-systems principles didn't exist
before; the Manchester–Mumbai example applies them, in accordance with DD-002, rather than
defining them), the Lifecycle Status column throughout Part IV, the Documentation audit appendix,
and this Migration notes section.

**What's newly documented but not newly built.** `manchester-mumbai-journey`, `destinations` hub
hero, `travel-ready-check` hub hero — all three already existed in code before this refactor;
they simply had no brief. This document does not change what they do, only records what they are.

**Why per-asset "purpose" isn't repeated on every catalogue row.** Purpose and responsibility are
genuinely shared within each category (every destination photo exists for the same reason: anchor
arrival at a real place) — restating identical language 24 times would be noise, not
documentation. Stated once per category instead, with per-row detail (subject, landmark,
lifecycle status) where it actually varies.

**Why the "one continuous journey" language from earlier drafts of the Manchester–Mumbai brief
was replaced with "visual bridge."** The original draft asserted the middle image needed to
depict "the same aircraft's journey... in one continuous frame." That claim was checked against
the component's own source before being written into this document, not assumed: the composite is
three separate photographs cross-faded against a pull-progress value, and the code's own comment
describes the middle image as "the visual bridge through the middle of the pull" — a transition
device, not a single continuous-flight frame. The document was corrected to match the verified
implementation detail rather than the more dramatic original phrasing.

---

## Implementation (how the code side works)

- `scripts/generate-image-manifest.mjs` scans `public/images/**` on every build
  (`prebuild`/`predev` hooks) and writes `lib/image-manifest.json`.
- `lib/brand-images.ts` resolves `getDestinationImage(slug)`, `getAirportImage(slug)`,
  `getHeroImage(key)`, `getGuideImage(slug)` against that manifest — returning `null` when no file
  exists.
- `<DestinationVisual />` renders the real photo (via `next/image`) when present, else the
  generated `<DestinationMark />` panel. `<HeroBackdrop />` does the same for page heroes (photo
  dimmed under the standard ink overlay + brass radial, so headline contrast is guaranteed
  regardless of the photo).
- **Therefore: drop a correctly named file into the right folder, deploy, done.** Delete the file
  to revert to the generated panel. No code changes, ever.
- The Founder Command Centre (`/founder`) counts real-photo coverage from the same manifest, so
  "Missing real photography" stays accurate automatically.

### Production order (impact-ranked)

1. `heroes/homepage.jpg` + the four region heroes (pakistan, india, gulf, umrah — already done)
2. The 11 destination images for South Asia + Gulf (already done — the revenue core)
3. `airports/manchester.jpg` (already done), `london-heathrow.jpg`, `birmingham.jpg`
4. Remaining destinations (already done — Turkey, Morocco, Mediterranean)
5. Remaining airports and vertical heroes
6. Guide backdrops (already done)
7. New from this refactor: `destinations` hub hero, `travel-ready-check` hub hero — need briefs
   written before they can be produced

---

## Glossary

Terminology introduced or formalized by this refactor, for contributors who weren't part of the
discussion that produced it.

| Term | Meaning |
|---|---|
| **Responsibility** | The specific product job a visual asset performs — why it exists, distinct from how it looks. See Part I, principle 1. |
| **Visual language** | The shared stylistic vocabulary an asset draws on — for photography, the Ink & Brass grade and golden-hour rules; for interactive systems, the restraint and motion principles in Part III. |
| **Lifecycle status** | Where an asset sits in production, not just whether it's finished today. One of: Planned, Placeholder, In Production, Deprecated, Internal — see Part IV for the full definitions. |
| **Placeholder** | A documented, code-wired asset with no real file yet — currently rendering the generated fallback panel or gradient. Not broken; intentionally incomplete with a known future state. |
| **Editorial photography** | Static imagery governed by Part II — one frame, one landmark, one light direction, no motion to reason about. |
| **Interactive visual system** | A motion- or state-based visual component governed by Part III — accountable to information hierarchy, state transitions and live-data honesty rather than composition and light. |
| **Golden hour** | Warm, low-sun light within roughly 40 minutes of sunrise or sunset — the only lighting condition editorial photography uses (Part II, rule 3). |
| **Ink & Brass** | JetStash's shared colour grade (`#0B0E14` shadows, `#C8932E` highlights) — the one thing photography and interactive UI have in common regardless of medium (Part I, principle 5). |
| **Design Decision (DD)** | A recorded architectural choice with its reasoning, not a changelog entry — answers "why is it built this way" for someone who wasn't in the room. |
| **Documented exception** | A deliberate, named departure from a stated rule (e.g. Business Class's closer aircraft framing, or the sacred-sites no-aircraft rule) — recorded explicitly rather than left to look like an oversight. |
