# JetStash Visual Identity — Photography Language & Image Implementation Plan

This is the single source of truth for every photograph on JetStash. It exists so that
fifty images commissioned or generated months apart still read as one brand. Read the
photography language and the master prompt before producing any image; the per-page
tables then specify exactly what each file must contain.

The site works fully without any of these files: every slot falls back to the on-brand
generated `<DestinationMark />` panel or the standard hero gradient. Images go live by
dropping correctly named files into `/public/images/` — no code changes (see
"Implementation" at the end).

---

## 1. The photography language

One sentence: **the quiet moment of arrival, at golden hour, with the aircraft as a
guest in the scene — never the subject.**

Every JetStash image obeys all nine rules:

1. **Aircraft as narrative, not hero.** A commercial passenger aircraft appears
   naturally — distant on approach, taxiing beyond a fence line, a wing over a city,
   contrails above a landmark. Small in frame (5–15% of width). Never a brochure-style
   close-up, never nose-on. **No visible airline livery or logos** — generic white/grey
   fuselage only (trademark safety + timelessness).
2. **The landmark anchors the story.** Each destination is identified by one iconic,
   unmistakable landmark, placed on a rule-of-thirds intersection.
3. **Golden hour only.** Warm low sun (within ~40 minutes of sunrise/sunset), long soft
   shadows, gentle atmospheric haze. Night, midday and blue-hour images are off-brand.
4. **Premium travel-magazine aesthetic.** Editorial, calm, human-scale. No HDR punch,
   no drone gimmicks, no fisheye, no Instagram saturation.
5. **Consistent grade — "Ink & Brass".** Shadows lifted toward deep ink blue
   (`#0B0E14`), highlights rolled toward warm brass (`#C8932E`), midtone saturation
   −15 to −25%, subtle film grain, no crushed blacks. This mirrors the site palette so
   photography and UI feel like one object.
6. **Headline-safe composition.** The upper third of every frame is calm negative
   space (sky, haze, gradient light) — headings sit there. Detail lives in the lower
   two thirds.
7. **16:9 masters at 2400×1350 minimum.** Export JPEG quality ~80 (or AVIF/WebP).
8. **Mobile-safe centre.** All critical content (landmark + aircraft) inside the
   central 60% of frame width — phones crop 16:9 to roughly 4:5 via centre crop.
9. **One story per frame.** One landmark, one aircraft, one light direction. If a
   frame needs a caption to explain itself, it fails.

### Master AI prompt template

Every prompt below is a `[SUBJECT]` clause dropped into this template:

> Cinematic editorial travel photograph, golden hour, [SUBJECT], a distant commercial
> passenger aircraft with plain unbranded livery [AIRCRAFT], premium travel magazine
> aesthetic, warm amber highlights and deep ink-blue shadows, muted colour grade,
> soft directional light, gentle atmospheric haze, subtle film grain, clean
> uncluttered composition, calm negative space across the upper third of the frame
> for a headline, landmark positioned on a lower rule-of-thirds intersection,
> shot on medium format, photorealistic, 16:9 — no text, no logos, no airline
> branding, no people looking at camera

Negative prompt (where supported): `logo, airline livery, text, watermark, HDR,
oversaturated, fisheye, night, neon, crowds facing camera, lens flare spots`

### Alt text policy

Alt text in code is derived automatically from the data layer (see Implementation) in
the form **"{landmark or scene}, {city}"** for destinations and **"{airport name}"**
for airports; hero backdrops are decorative (`alt=""`, `aria-hidden`) because the
heading beside them carries the meaning. The per-image alt below is what the derived
text will effectively say — keep filenames matched to slugs and it stays correct.

---

## 2. File system & naming convention

```
public/images/
  heroes/        <key>.jpg          page hero backdrops (keys listed below)
  destinations/  <slug>.jpg         one per destination (24)
  airports/      <slug>.jpg         one per UK airport (11)
  guides/        <slug>.jpg         one per guide (9, optional tier)
```

Accepted extensions in priority order: `.avif`, `.webp`, `.jpg`, `.jpeg`, `.png`.
The build scans these folders and wires everything automatically. **Deal cards reuse
the destination image of their `toDestinationSlug`** — deals never need their own
files, which is what keeps the brand coherent as fares rotate.

---

## 3. Homepage

| | |
|---|---|
| **Filename** | `heroes/homepage.jpg` |
| **Subject** | High-altitude view across a sea of golden-hour cloud, the sun low on the horizon |
| **Landmark** | None — this is the brand frame, not a destination |
| **Aircraft** | Single aircraft crossing lower-right third, seen from slightly above, faint contrail |
| **Lighting** | Sun just above cloud horizon, amber-to-ink gradient sky |
| **Composition** | Upper two-thirds calm gradient sky (the hero headline and route map sit over it); cloud texture confined to lower third |
| **Prompt subject** | `vast sea of golden clouds at sunset seen from cruising altitude, sun low on the horizon` / aircraft: `crossing the lower right of frame above the clouds, leaving a faint contrail` |
| **Alt** | Decorative backdrop (`alt=""`) — headline carries meaning |

Used as a heavily dimmed backdrop behind the ink hero; the interactive route map
remains the hero's focal object.

---

## 4. Region & vertical heroes (`heroes/<key>.jpg`)

All decorative backdrops (`alt=""`), dimmed under the standard ink overlay.

| Key | Subject & landmark | Aircraft | Composition note |
|---|---|---|---|
| `pakistan` | Badshahi Mosque's domes and minarets from a Lahore rooftop, kite birds circling | Tiny, high, on approach far left | Minarets lower-right third; hazy amber sky upper half |
| `india` | Humayun's Tomb, Delhi, seen across its char bagh garden | Distant contrail crossing upper-left | Dome on right third line; garden geometry leads the eye |
| `gulf` | Dubai Creek with traditional abras crossing, skyline soft in haze behind | Descending far beyond the skyline, small | Creek water lower third catching gold light |
| `umrah` | The Makkah skyline at dusk-gold from a respectful elevated distance, Abraj Al Bait clock tower in haze | None (deliberate — reverence; the only exception to rule 1) | Skyline in lower quarter, vast calm sky above |
| `family-holidays` | Wide empty beach at golden hour, two distant families walking at the waterline, gentle surf | High and small, climbing out over the sea | Horizon on lower-third line |
| `business-class` | Aircraft wing over golden cloud from a window seat, warm cabin light edge in frame corner | The wing itself — closest the brand ever gets to the aircraft | Wing diagonal from lower-left; sky calm above |
| `travel-club` | Dawn airport apron seen through a rain-flecked terminal window, warm interior reflection | One aircraft at a distant gate, tail catching first light | Strong upper negative space |
| `deals` | Departures board style abstraction: warm-lit terminal architecture, long shadows, one traveller with a trolley walking away | Visible through the terminal glass, taxiing | Architecture lines converge lower-right |
| `routes` | Great-circle view: coastline and city lights fading into golden haze from altitude | Wingtip entering frame corner | Curvature of coast echoes the site's route-arc motif |
| `guides` | Flat-lay-free alternative: open kraft notebook, boarding pass and passport on a warm wooden café table by a window, airport beyond | Blurred through the window glass | Objects lower half; window light upper half |
| `airports` | UK airport pier at sunrise, wet tarmac reflecting amber sky | Two aircraft nose-to-tail at gates, unbranded | Reflections double the golden light |
| `about` | Empty premium cabin row bathed in window light, seatbelt neat on the seat | Interior — implied | Honest, quiet, unstaged |
| `contact` | Warm-lit writing desk by a window at dusk, city and distant airfield lights outside | Landing lights of one aircraft descending, tiny | Desk lower-left; sky negative space |
| `quote-request` | Family luggage lined in a hallway at dawn, front door open to warm light | None — the trip is about to begin | Doorway light on right third |

---

## 5. UK airport pages (`airports/<slug>.jpg`)

Language for all eleven: **the airport as the community's doorstep** — always from a
human vantage point (fence line, terrace, car park roof, approach road), never sterile
airside stock. Aircraft unbranded. Alt derives as "{Airport name}".

| Slug | Subject & local anchor | Aircraft positioning | Note |
|---|---|---|---|
| `manchester` | Viewing park fence line at sunset, families silhouetted, Pennine haze behind | Wide-body rotating on take-off, centre-right, climbing left-to-right | The brand's flagship airport image |
| `birmingham` | Approach over suburban Midlands rooftops and gardens at golden hour | Low on final, gear down, upper-centre, small | Rooftop chimneys lower third |
| `london-heathrow` | Myrtle Avenue-style green with picnicking plane-watchers, west London haze | Heavy wide-body overhead on approach, high in frame | The classic — kept calm, not looming |
| `london-gatwick` | Sussex field edge with oak tree, terminal glowing far beyond | Climbing out above the tree line, distant | Rural-meets-runway contrast |
| `birmingham-east-midlands` | Flat East Midlands horizon, freight sheds catching last light | One aircraft on distant roll, silhouette | Honest about its cargo character |
| `leeds-bradford` | High Yorkshire ridge line, dry-stone wall leading to the airfield plateau | Lifting off into a big Pennine sky, left third | Highest airport in England — show it |
| `glasgow` | Wet apron reflections, Kilpatrick Hills behind in amber haze | Turboprop and jet nose-to-tail at gates, far side | Scottish light: soft, silver-gold |
| `bristol` | Rolling North Somerset fields, hot-air-balloon speck on the horizon | Departing jet banking gently right, small | Balloon nods to Bristol without cliché |
| `liverpool` | Mersey estuary glinting beyond the runway threshold | On short final over the water, centre | Water light does the work |
| `newcastle` | Northumberland fields, distant Cheviot line, golden stubble | Climbing north, tail catching sun, right third | Big-sky composition |
| `edinburgh` | Firth of Forth shimmer with the bridges as silhouettes far off | Descending over the water toward camera-left | Bridges tiny — landmark discipline |

---

## 6. Destination pages (`destinations/<slug>.jpg`)

The core set. Alt derives as "{tagline} — {city}, {country}". Every prompt = subject
clause + aircraft clause in the master template.

### Pakistan
| Slug | Landmark | Aircraft | Subject clause |
|---|---|---|---|
| `lahore` | Badshahi Mosque | High contrail crossing upper-left | `the red sandstone domes and minarets of Badshahi Mosque, Lahore, glowing at golden hour, kite birds circling` |
| `islamabad` | Faisal Mosque against the Margalla Hills | On distant approach below the ridge line, right | `the white tent-form of Faisal Mosque with the green Margalla Hills rising behind, Islamabad, late golden light` |
| `karachi` | Mazar-e-Quaid mausoleum's white dome | Climbing out over the haze, upper-right, small | `the white marble dome of Mazar-e-Quaid rising above Karachi's amber evening haze` |

### India
| Slug | Landmark | Aircraft | Subject clause |
|---|---|---|---|
| `delhi` | Humayun's Tomb | Faint contrail, upper-left | `Humayun's Tomb in warm sandstone light across its Mughal garden, Delhi, soft haze` |
| `mumbai` | Gateway of India from the harbour | Distant departure climbing over the sea, left | `the Gateway of India basalt arch from the harbour water at sunset, Mumbai, ferries as silhouettes` |
| `amritsar` | Golden Temple (Harmandir Sahib) | None in frame — reverence, like Umrah | `the Golden Temple reflected in the Amrit Sarovar at first light, Amritsar, morning mist` |
| `ahmedabad` | Sabarmati riverfront with Ellis Bridge | Small, high, crossing upper-right | `Ellis Bridge's steel arches over the calm Sabarmati river at golden hour, Ahmedabad` |

### Gulf & Saudi Arabia
| Slug | Landmark | Aircraft | Subject clause |
|---|---|---|---|
| `dubai` | Burj Khalifa needle in haze from the desert edge | Descending across the middle distance, tiny | `Burj Khalifa rising from Dubai's golden evening haze seen from the desert dunes` |
| `doha` | Museum of Islamic Art with West Bay behind | Climbing out over the bay, upper-left | `the stepped geometry of the Museum of Islamic Art on Doha's corniche at sunset, West Bay towers soft behind` |
| `jeddah` | Al-Balad coral-stone houses with wooden rawasheen balconies | High and faint, upper-third | `the historic coral-stone facades and wooden balconies of Al-Balad old town, Jeddah, warm evening light` |
| `madinah` | The Prophet's Mosque green dome, respectful distance | None — reverence | `the green dome and minarets of the Prophet's Mosque in soft golden dusk, Madinah, from a distant rooftop` |

### Turkey
| Slug | Landmark | Aircraft | Subject clause |
|---|---|---|---|
| `istanbul` | Süleymaniye Mosque skyline over the Golden Horn | Crossing the Bosphorus, small, mid-right | `Istanbul's Süleymaniye Mosque skyline above the Golden Horn at sunset, ferries crossing below` |
| `antalya` | Old harbour (Kaleiçi) cliffs and Taurus Mountains | On approach along the coast, left, small | `Antalya's Kaleiçi old harbour beneath sandstone cliffs, Taurus Mountains hazy behind, golden Mediterranean light` |
| `dalaman` | Ölüdeniz blue lagoon and its sand spit | High above the bay, tiny, with contrail | `the turquoise lagoon and white sand spit of Ölüdeniz from a high viewpoint, pine slopes in warm light` |
| `bodrum` | Bodrum Castle and the yacht harbour | Distant departure over the Aegean, upper-left | `the stone ramparts of Bodrum Castle above a golden Aegean harbour, gulets at anchor` |
| `izmir` | Clock Tower at Konak Square | Faint, high, upper-right | `Izmir's ornate Ottoman clock tower in Konak Square at golden hour, palm shadows long across the marble` |

### Morocco
| Slug | Landmark | Aircraft | Subject clause |
|---|---|---|---|
| `marrakech` | Koutoubia Mosque minaret above the medina | Small on approach over the palm groves, right | `the Koutoubia minaret rising above Marrakech's pink medina rooftops at sunset, Atlas Mountains faint behind` |
| `agadir` | The kasbah hill ("God, Country, King" hillside) above the bay | Climbing out over the Atlantic, left | `Agadir's long crescent beach and kasbah hill at golden hour, Atlantic surf lines catching the light` |
| `casablanca` | Hassan II Mosque minaret over the Atlantic | High contrail, upper-left | `the Hassan II Mosque rising from the Atlantic shoreline at sunset, waves breaking at its base, Casablanca` |
| `tangier` | Kasbah walls looking across the Strait of Gibraltar | Tiny, crossing the strait, centre-high | `Tangier's white kasbah walls above the Strait of Gibraltar at dusk-gold, Spanish coast faint on the horizon` |

### Mediterranean
| Slug | Landmark | Aircraft | Subject clause |
|---|---|---|---|
| `barcelona` | Sagrada Família spires above the Eixample grid | Distant, upper-right | `the spires of the Sagrada Família above Barcelona's grid at golden hour, Mediterranean glinting beyond` |
| `faro` | Ria Formosa lagoon sandbars | Low over the lagoon on approach, left, small | `the winding sandbars and turquoise channels of the Ria Formosa lagoon at sunset near Faro` |
| `athens` | The Acropolis and Parthenon | High and faint above Hymettus, right | `the Parthenon crowning the Acropolis in honey-gold evening light, Athens spread soft below` |
| `rome` | St Peter's dome across the Tiber | Faint contrail, upper-left | `St Peter's Basilica dome across the Tiber at golden hour, bridge lamps just lighting, Rome` |

---

## 7. Guides (`guides/<slug>.jpg` — optional tier)

Guides are editorial-first; images are backdrop texture, not information
(decorative, `alt=""`). Ship these last.

| Slug | Subject (all: warm window light, shallow depth, no faces) |
|---|---|
| `visa-processing-booking-date` | Passport with application receipt on a desk calendar, morning light |
| `eid-diwali-vs-school-holiday-pricing` | Two wall calendars side by side, one page mid-turn, festival dates circled in pencil |
| `direct-vs-gulf-connecting-fares` | Window-seat view of a Gulf hub apron during a layover, golden apron light |
| `what-umrah-package-actually-includes` | Neatly packed ihram cloth and travel documents on a bed, soft light |
| `when-business-class-sales-happen` | Flat-bed seat in window light, blanket folded, cabin empty |
| `esim-vs-local-sim` | Phone showing signal bars on a café table, foreign street soft behind |
| `travel-insurance-family-visit-trips` | Reading glasses on printed policy pages, tea cooling beside |
| `checked-baggage-allowances` | Bathroom-scale weighing of a packed suitcase in hallway light |
| `comparing-airlines-same-route` | Two boarding passes fanned on a tray table |

---

## 8. Deals

**No dedicated deal photography.** Deal cards automatically inherit
`destinations/<toDestinationSlug>.jpg`. This is deliberate: fares rotate weekly,
destinations don't, and one image per destination is what keeps a wall of deal cards
looking like a brand rather than an aggregator. The `heroes/deals.jpg` backdrop
(section 4) covers the /deals page itself.

---

## 9. Implementation (how the code side works)

- `scripts/generate-image-manifest.mjs` scans `public/images/**` on every build
  (`prebuild`/`predev` hooks) and writes `lib/image-manifest.json`.
- `lib/brand-images.ts` resolves `getDestinationImage(slug)`, `getAirportImage(slug)`,
  `getHeroImage(key)`, `getGuideImage(slug)` against that manifest — returning `null`
  when no file exists.
- `<DestinationVisual />` renders the real photo (via `next/image`) when present,
  else the generated `<DestinationMark />` panel. `<HeroBackdrop />` does the same for
  page heroes (photo dimmed under the standard ink overlay + brass radial, so headline
  contrast is guaranteed regardless of the photo).
- **Therefore: drop a correctly named file into the right folder, deploy, done.**
  Delete the file to revert to the generated panel. No code changes, ever.
- The Founder Command Centre (`/founder`) counts real-photo coverage from the same
  manifest, so "Missing real photography" stays accurate automatically.

### Production order (impact-ranked)

1. `heroes/homepage.jpg` + the four region heroes (pakistan, india, gulf, umrah)
2. The 11 destination images for South Asia + Gulf (the revenue core)
3. `airports/manchester.jpg`, `london-heathrow.jpg`, `birmingham.jpg`
4. Remaining destinations (Turkey, Morocco, Mediterranean)
5. Remaining airports and vertical heroes
6. Guide backdrops
