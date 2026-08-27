# JetStash Launch Checklist

**Established:** 29 July 2026, following founder review and acceptance of
`LAUNCH_READINESS_AUDIT_2026-07-29.md`.

**Current-state reconciliation:** 27 August 2026 at
`4494fd3561ac533a9ba787c04ef77b6ae44626ad` (PR #187).

This is the single checklist of record for launch readiness. Do not create a competing or
duplicate checklist elsewhere — update this file as items close, and add newly discovered items
here rather than starting a fresh document.

## Confirmed facts (do not reopen as uncertain)

- The Route Atlas is complete, interactive and live on the public homepage.
- Intended airport and destination imagery is complete and live.
- Contact, Quote Request and Newsletter delivery work. Quote Request's role was clarified in PR
  #187: JetStash researches options but does not take payment or make bookings.
- Fare-observation governance and methodology are complete; fare *coverage* (how many routes have
  logged observations) remains an ongoing series. Current code-derived state is 226 append-only
  observations and 83 of 88 routes with a current Fare Signal.
- JetStash is ready for controlled public organic use.
- Google Ads Basic Consent Mode and conversion tracking are live. Missing instrumentation is no
  longer the paid-readiness blocker; meaningful settled conversion evidence is still absent.
- No required production fix is stranded in `fix/verification-pending-leakage` or
  `fix/trust-cracks-july` — both were checked directly against `origin/main` on 29 July 2026 and
  contain nothing that isn't already live via later, independent commits.

## Verdict

**READY FOR CONTROLLED PUBLIC ORGANIC USE.** Do not materially scale paid advertising or partner
promotion yet. The open gates are meaningful commercial evidence, B2's founder/professional legal
decisions and A6's distributed/WAF-backed rate limit — not a missing Google Ads tag.

Full detail, scoring, and evidence: `LAUNCH_READINESS_AUDIT_2026-07-29.md`.

### Current gate summary — 27 August 2026

- **Implemented/closed:** security headers; public trust corrections; consent and conversion-event
  code; promotion-specific fare evidence (G1); Quote Request role clarity; sitemap discovery
  follow-up; current affiliate disclosures.
- **Waiting on founder/professional input:** B2 public operator/address/retention/Terms decisions.
- **Waiting on infrastructure:** A6 distributed or WAF-backed rate limiting. The process-local
  limiter remains an honest limitation before meaningful paid scale.
- **Waiting on real evidence:** F1/commercial measurement. Instrumentation exists; the question is
  what real users and attributed commercial outcomes show, not whether another event can be added.
- **Deliberately deferred:** real assistive-technology certification/field Core Web Vitals, CSP
  enforcement/major dependency upgrade and post-launch housekeeping, each under its existing item.
- **Date-locked truth task:** Manchester–Mumbai/Manchester–Delhi verification is scheduled for
  31 August / 1 September. The pre-map audit is complete; no early conclusion is authorised.

---

## A — Organic-launch hardening

Not launch blockers in the sense that anything is broken today — these close real gaps before
wider organic promotion.

- [x] **A1.** ~~Add safe security headers~~ **Done 29 July 2026** — PR #37, merge `1c2e3f1`.
      `X-Content-Type-Options`, `X-Frame-Options: DENY` and `Referrer-Policy` are enforced;
      `Content-Security-Policy-Report-Only` is live in report-only mode. Verified: `tsc`, lint,
      549/549 tests, production build all clean; zero console CSP violations on the homepage
      (Atlas — heaviest dynamic-inline-style user) and `/contact` in dev.
      **Before switching to enforced CSP:** founder-flagged follow-up — browser-console spot
      checks only cover pages actually visited manually. Set up a real reporting mechanism
      (`report-to`/`report-uri`, or another deliberate monitoring method) so production violations
      across all traffic can be observed over time before enforcement, not just the pages checked
      during this PR. **Updated 16 August 2026:** the CSP cannot simply be switched to enforced
      unchanged any more — Google Ads Basic Consent Mode + conversion tracking (PR #135) now loads
      a gtag script and makes external connections that the current report-only policy's
      `script-src 'self'`/`connect-src 'self'` would block if enforced as-is. Any future enforcement
      pass must first add the correct Google Ads domains to the allowlist and verify tracking still
      fires, not just flip the header.
- [x] **B1.** ~~Draft JetStash Terms & Conditions~~ **Repository working draft complete** — see
      `docs/legal/TERMS_DRAFT.md` (PR #39, merged). This is a repository-only working draft: it is
      not published, linked, served or presented as binding Terms on jetstash.co.uk, and no
      `/terms` route exists on the site.
- [ ] **B2.** Finalise and publish JetStash Terms & Conditions. Requires: confirmed trading/legal
      identity; confirmed operator and contact details suitable for public publication;
      professional legal review of `docs/legal/TERMS_DRAFT.md`; and an explicit, separate decision
      to publish and link a public Terms page. These are external/legal dependencies, not a current
      repository-development task, and **do not block controlled organic launch**. **Do not
      publish public Terms, and do not recreate a `/terms` route, until all of the above are
      complete** — professional legal review in particular is not something this checklist can mark
      done on the repository's own authority.
      **Repository-side preparation complete, 8 August 2026** — see
      `docs/legal/A4_LEGAL_REVIEW_PACK.md` for the consolidated pack: current state of the Privacy
      Policy, Affiliate Disclosure and Terms draft; a direct-from-code audit of exactly where
      affiliate/commission notices appear (and don't) around every Trip.com click-through point; the
      full list of open decisions this item has always required, compiled and cross-checked, not
      newly invented; and a reviewer checklist. This closes the repository-side half of B2 — every
      remaining item is still an external professional decision, not something achievable by further
      code or documentation work. B2 stays open until those decisions are made and recorded.
- [x] **C1.** ~~Fix the Madinah affiliate-link wording~~ **Done (historical — superseded).** Original
      fix: no genuine route-specific TravelUp page could be verified for Madinah (unlike every other
      route destination), so per the decision rule the generic tracked link was kept and the
      CTA/caption wording was corrected instead, on both Madinah route pages (`manchester-madinah`,
      `birmingham-madinah`) and both Madinah deal cards, via a `hasVerifiedDeepLink()` helper in
      `lib/booking-providers.ts`. **TravelUp has since been removed from JetStash entirely** and
      replaced with Trip.com as the sole active provider; both Madinah routes now have a genuine,
      dashboard-generated Trip.com link like every other supported route, so the special-casing this
      item describes no longer exists in the code.
- [x] **D1.** Investigated 29 July 2026. Applied safe, non-forced lockfile patches: `brace-expansion`
      5.0.7 → 5.0.8; legacy `brace-expansion` 1.1.15 → 1.1.17 (still affected — no patched 1.x
      release identified); top-level development `postcss` 8.5.16 → 8.5.25; `nanoid` 3.3.15 →
      3.3.16. Remaining affected: Next.js's nested PostCSS, Sharp, and the dev-only legacy
      brace-expansion chain — no approved non-breaking remediation was available during this
      review. **Do not use `npm audit fix --force`.** JetStash currently has no user-uploaded
      images, remote user-controlled image URLs, or user-controlled CSS input. Monitor upstream
      releases and reassess if untrusted image or CSS input is introduced.
      **Superseded by A3 (below) as of 8 August 2026** — kept here as history; see A3 for the
      current advisory count, re-verified production relevance, and safe updates applied since.
- [x] **E1.** ~~Fix the 404 page's missing title~~ **Done 29 July 2026** — `app/not-found.tsx` had
      no `metadata` export, so the tab fell back to the root layout's default title (the
      homepage's). Added `title: 'Page Not Found'`, resolving through the layout's `%s | JetStash`
      template to "Page Not Found | JetStash". No layout, copy or behaviour change; still a genuine
      HTTP 404. Verified live in dev and covered by `tests/not-found-page-title.test.ts`.
- [ ] **A6.** Form/Brevo hardening: production PII logging, provider-failure handling, rate-limit
      architecture. **Partly closed 7 August 2026** — objectives 1–3 and 5 (below) are genuinely
      done; objective 4 is honest documentation of an existing limitation, not a fix, and remains
      open pending infrastructure the repository cannot provide on its own authority.
      - **1. Production logging/PII — done.** Every `console.error`/`console.warn` call reachable
        from a public form/API path (`lib/email.ts`'s `upsertBrevoContact`, `getBrevoContact`,
        `sendResendEmail`; the misconfigured-provider warnings in `app/api/contact`,
        `app/api/quote-request`, `app/api/subscribe`, `app/api/route-watch`) previously logged a raw
        Brevo/Resend response body, a raw caught `Error` object, or the submitted `name`/`email`
        directly — all of which can contain or echo back PII. Every one of these now logs only a
        fixed message, an internal operation name (`op`), and where relevant an HTTP status code —
        never a response body, a caught error's message, or a submitted field. `tripType`/`region`
        (internal classification values, not user data) and `airportSlug`/`destinationSlug`
        (internal route identifiers) are still logged; `name`, `email`, phone, message body and
        journey free-text never are. Regression-tested in `tests/email-lib-hardening.test.ts`.
      - **2 & 3. Brevo not-found vs. provider failure, and Route Watch preference safety — done.**
        `getBrevoContact()` previously returned `null` for both a confirmed HTTP 404 ("contact
        genuinely doesn't exist") and every other failure mode (auth failure, rate limit, malformed
        response, network error) — indistinguishable to its caller. It now returns a 3-state
        `BrevoContactLookupResult` (`found` / `not_found` / `uncertain`); only a literal HTTP 404
        resolves to `not_found`. `app/api/route-watch/route.ts` now branches on this explicitly: an
        `uncertain` lookup returns HTTP 503 immediately and calls `upsertBrevoContact` in neither
        that path nor before it — no create/update side effect and no discarding of a real
        contact's existing `WATCH_ROUTE` preferences. `found` merges the new route into the
        contact's existing preferences exactly as before (still capped at `MAX_WATCHED_ROUTES = 3`,
        unchanged); `not_found` proceeds to create a new contact exactly as before. Regression-tested
        in `tests/route-watch-brevo-hardening.test.ts`.
      - **5. Tests — done.** New `tests/email-lib-hardening.test.ts` (unit-level, real
        implementation against a stubbed `fetch`) and `tests/route-watch-brevo-hardening.test.ts`
        (route-level, mocked `lib/email`) cover: not_found vs. uncertain for every relevant fetch
        outcome (404, non-404 statuses, malformed/wrong-shaped body, thrown network error); no
        console call anywhere in this path ever contains a submitted email; an uncertain lookup
        causes zero `upsertBrevoContact` calls and returns 503; a confirmed existing contact's
        `WATCH_ROUTE` value is genuinely merged, not discarded, including the 3-route cap; a
        confirmed not-found still creates a contact as before; rate-limit rejection still causes no
        provider call at all (extending the existing coverage in
        `tests/public-form-hardening.test.ts`, whose `getBrevoContact` mock was updated to the new
        3-state contract). Full canonical suite green after this change — see change log entry.
      - **4. Rate-limit architecture — investigated, not changed; remains a genuine infrastructure
        limitation.** `lib/form-security.ts`'s `checkRateLimit()` is an in-memory, process-local
        fixed-window counter (`Map<string, {count, resetAt}>`, capped at 5,000 buckets with
        oldest-first eviction) — it does not share state across serverless instances or survive a
        cold start, and was already honestly documented as such in the module's own doc comment
        before this PR. Confirmed all four public write endpoints (`contact`, `quote-request`,
        `subscribe`, `route-watch`) already call `checkRateLimit()` as the first statement in their
        handler, before any provider call — a rejected request already causes zero Brevo/Resend
        side effect (now regression-tested, see objective 5). No distributed store, no paid
        infrastructure and no Vercel/DNS/environment change was introduced, per this task's explicit
        scope. **What remains required before paid acquisition traffic:** a distributed or
        WAF-backed rate limit (e.g. Vercel WAF / Upstash Redis-backed limiter / Cloudflare rule) —
        the current limiter only protects a single serverless instance's in-memory window, so a
        request pattern spread across instances or surviving a cold start is not actually
        rate-limited today. This is a pre-existing, already-documented limitation, not a regression
        introduced or newly discovered by this PR.
      - **Why this is "partly closed," not "closed":** every acceptance criterion this PR could
        genuinely satisfy in code is met, but objective 4's own stated closing condition — a real
        distributed/WAF-backed limiter — was explicitly out of scope for this PR (no paid
        infrastructure, no Vercel/DNS/environment change) and has not been built. Do not mark this
        item fully done until that follow-up lands.
- [ ] **A11.** Accessibility corrections: Atlas SVG semantics, dark-surface text contrast,
      route-page heading order, mouse-centric wording. **Partly closed 7 August 2026** — every
      automated/keyboard/browser-accessibility-tree finding from the production audit is fixed and
      regression-tested; real assistive-technology certification and field Core Web Vitals both
      remain outstanding for reasons outside this repository's own authority to close.
      - **1. Atlas SVG semantics — done.** The Route Atlas's interactive SVG (`components/founder/
        atlas-feel-test.tsx`) had `role="img"` while containing real, keyboard-focusable
        `role="button"` country/destination controls — an invalid nested-interactive ARIA structure
        (WCAG 4.1.2) that left those controls' exposure to screen readers undefined/inconsistent
        across assistive tech. Fixed by changing the SVG's own role to `role="group"` (a container
        role that carries its own accessible name without hiding or overriding its children's roles
        the way `role="img"` does) and shortening its label to `` `${airportName}'s route network` ``.
        Confirmed via live production axe-core scan (nested-interactive violation gone), a live
        keyboard walkthrough (Tab still reaches every country/destination circle with a visible
        brass focus ring, Enter/Space still activates the same reveal a mouse hover triggers,
        unchanged), and the browser accessibility tree (now reports `group "Manchester's route
        network"` with every button's full accessible name intact, where it previously reported
        `img "Manchester's real network..."` with those same buttons nested inside it). The map's
        interaction model, hit-radius geometry and analytics are byte-for-byte unchanged — only the
        SVG's outer ARIA semantics changed. The separate, already-accessible "Choose a country" /
        "Choose a destination" button groups (a redundant, properly-exposed alternative to the map
        itself) are untouched.
      - **2. Dark-surface text contrast — done.** `text-ink-400` (~4.14:1) and `text-ink-500`
        (~2.28:1) both fell short of WCAG AA (4.5:1) against the Atlas's dark surfaces (`bg-ink-950`
        header/legend, `bg-ink-900/90` destination panel) — 13 affected nodes, all within
        `atlas-feel-test.tsx`. Fixed by moving every dark-surface usage in that file to
        `text-ink-300`, computed at ~7.6–7.9:1 against both backgrounds (comfortably above AA, at
        AAA level) — the token this codebase had already established elsewhere as proven-readable on
        these exact surfaces (see `homepage-opening-hero.tsx`'s own doc comment), not a new token and
        not a global Tailwind config change. Unrelated `ink-400`/`ink-500` usage on light backgrounds
        elsewhere (e.g. `CommercialPaths`' sand-background copy) was left untouched — this fix is
        targeted to the actual affected dark-surface usages only, per the task's own instruction not
        to blindly change global colour tokens. Confirmed via live axe-core (zero color-contrast
        violations on the homepage, down from 13 flagged nodes) and a live visual check.
      - **3. Route-page heading order — done.** `TravellerTipList` (`components/route/
        traveller-tip-list.tsx`) rendered every tip title as `<h4>` directly under a parent `<h2>`
        section heading at all three call sites (`routes/destinations/airports [slug]` pages),
        skipping `<h3>`. Fixed by changing the shared list's heading level to `<h3>` — the correct
        next level under each page's own `<h2>` (`"Traveller tips for this route"`, `"Traveller tips
        for {dest.city}"`, `"Before you fly from {airport.city}"`), and consistent with the airport
        page's sibling `practicalNotes` list, which already renders at `<h3>`. Confirmed via live
        axe-core on `/routes/manchester-mumbai` (heading-order violation gone, down from 1).
      - **4. Mouse-centric Atlas wording — done.** The Atlas's desktop instruction read "Hover a
        country to explore its destinations," implying mouse-only interaction the map never actually
        required (confirmed by the keyboard walkthrough above). Replaced with the input-neutral
        "Select a country to explore its destinations," matching the mobile instruction's existing
        input-neutral wording.
      - **Tests.** New `tests/a11-atlas-corrections.test.ts` (24 assertions) proves: the Atlas root no
        longer uses `role="img"`, carries `role="group"` with a concise label instead, and is not
        itself `aria-hidden`; country/destination hit-circles keep `role="button"`, `tabIndex={0}`,
        Enter/Space activation, visible focus-visible styling and their full accessible names; no
        focusable element exists beneath any `aria-hidden` node in the file; every `text-ink-400`/
        `text-ink-500` usage in the Atlas is gone, replaced with `text-ink-300`, while confirming
        unrelated light-background usage elsewhere is untouched; the corrected `<h3>` heading level is
        asserted directly and cross-checked against all three call sites' actual `<h2>` structure; the
        input-neutral instruction text is asserted present and the old "Hover a country" wording is
        asserted absent. `tests/homepage-opening-hero.test.ts`'s two assertions that hardcoded the old
        `text-ink-400` attribution styling were updated to `text-ink-300` (wording/position assertions
        unchanged). Full canonical suite (1434/1434), `tsc --noEmit`, lint and production build all
        clean after this change.
      - **Live verification (production, then local build).** axe-core re-run on all four target
        pages after the fix: homepage 0 violations (was 2), `/routes/manchester-mumbai` 0 (was 1),
        `/destinations/dubai` 0 (unchanged), `/contact` 0 (unchanged). Keyboard walkthrough of the
        Atlas and the confirmed the same tab order, visible focus and Enter/Space activation as
        before. Browser accessibility-tree spot-check confirmed the `role="group"` structure and
        intact accessible names directly (not inferred from the automated scan alone).
      - **What remains genuinely outstanding — do not mark A11 fully complete:**
        - **Real assistive-technology certification.** Every accessibility check in this PR — the
          automated axe-core scan, the keyboard walkthrough, and the accessibility-tree spot-check —
          was performed without a real screen reader (no NVDA/JAWS/VoiceOver session). The
          accessibility tree closely predicts how most screen readers will expose this structure, but
          it is not a substitute for an actual assistive-technology pass, and none has been done.
        - **Field Core Web Vitals remain unavailable**, unrelated to this PR's scope: both Google
          Search Console and PageSpeed Insights report "No Data" for CrUX field data on
          jetstash.co.uk, because there isn't yet enough real-user traffic for Chrome's dataset to
          report on. Not fixable by testing harder — needs real traffic volume first. For the record,
          the current homepage Lighthouse **mobile lab** result (Slow 4G, Moto G Power emulation, 6
          August 2026): Performance 94, LCP 2.7s, CLS 0. A 2.7s synthetic LCP is a future observation
          for a later, separately-scoped performance PR — not a launch blocker, and not evidence
          gathered or acted on in this PR, which made no performance changes.
- [ ] **A3.** Dependency-security review (governance re-audit; supersedes D1 below as the current
      source of truth — D1's own findings from 29 July 2026 are kept as history, not restated here).
      **Partly closed 8 August 2026** — every advisory this repository can safely resolve without a
      major upgrade is resolved; the remaining 3 are documented with a defensible, re-verified
      mitigation and acceptance decision, not dismissed.
      - **Re-audited from scratch, not from the old report.** `npm audit --omit=dev` (production
        tree) and `npm audit` (full tree, 490 packages: 24 prod, 432 dev, 91 optional) both re-run
        against the current lockfile. Before this pass: 4 production-tree findings (`nanoid`, `next`,
        `postcss`, `sharp`, all high) and 6 full-tree findings (adding dev-only `brace-expansion` and
        `js-yaml`, both high) — one genuinely new production advisory (`nanoid`
        GHSA-2v37-7h3g-55p8) had appeared since D1's 29 July review, and one dev-only advisory
        (`brace-expansion` GHSA-rgw5-rvv9-x895) had replaced the one D1 investigated and accepted.
      - **Safe updates applied** (`npm audit fix`, no `--force`; previewed via `--dry-run` first;
        `package-lock.json` only, zero `package.json` changes): `nanoid` 3.3.16 → 3.3.18 (nested
        under both `next`'s bundled `postcss@8.4.31` and the top-level `postcss@8.5.25` — deduped to
        one shared install, both consumers resolved); `js-yaml` 4.3.0 → 4.3.1 (nested under
        `eslint@8.57.1`, dev-only); `brace-expansion` 1.1.17 → 1.1.18 (top-level, via `eslint`'s
        `minimatch`, dev-only — a patched 1.x release now exists, unlike at D1's review) and 5.0.8 →
        5.0.9 (nested under `@typescript-eslint/typescript-estree`'s `minimatch`, dev-only). All 4
        genuinely resolved — full audit dropped from 6 findings to 3, all dev-only advisories now
        clear.
      - **Remaining 3 (all high, all production-tree, all require `next@16.3.0` — a `isSemVerMajor`
        upgrade, correctly not performed here):**
        - `next` itself (flagged only because it depends on the two below).
        - `postcss` <=8.5.22, nested at `node_modules/next/node_modules/postcss@8.4.31` — Next's own
          bundled build-time CSS processor, a **separate install from the top-level devDependency
          `postcss@8.5.25`** (already patched, unaffected by these CVEs). Four CVEs: XSS via
          unescaped `</style>` in stringify output, and three arbitrary-file-read/path-traversal
          issues via attacker-controlled `sourceMappingURL` in CSS comments.
        - `sharp` <0.35.0 — Next's built-in image-optimization library (`next/image`'s server-side
          resize/reformat path), inherited libvips CVEs (CVE-2026-33327/33328/35590/35591).
      - **Production relevance, re-verified against the current code (not assumed from the prior
        review):** `next.config.js` was read directly — no `images.remotePatterns` or
        `images.domains` is configured (`// No remote image hosts: all destination imagery is
        rendered locally by <DestinationMark />`), so Next's Image Optimization API cannot fetch or
        process an attacker-supplied remote URL through the vulnerable `sharp`; `next/image` usage
        was checked across all 9 call sites (`app/airports/page.tsx`, `app/guides/page.tsx`,
        `components/homepage-v2/journey-brief-hero.tsx`, `pull-brief.tsx`,
        `components/routes/routes-catalogue.tsx`, `components/sections/route-map-hero.tsx`,
        `components/ui/destination-visual.tsx`, `hero-backdrop.tsx`, `hub-card.tsx`) — every one
        renders a static, repo-committed file under `public/images/`, never a remote or
        user-controlled source. The nested `postcss` only runs at build time compiling the site's
        own `globals.css`/Tailwind output on Vercel's build infrastructure from the repository's own
        source — there is no runtime endpoint, form field, or API route anywhere in this codebase
        (`app/api/contact`, `quote-request`, `subscribe`, `route-watch`, `cron/fare-check-reminder`)
        that accepts or renders freeform CSS or image bytes from an untrusted user. **Both remaining
        vulnerable code paths are present in the production dependency tree, but neither is reachable
        by an untrusted user given the current, re-verified absence of any user-controlled CSS or
        remote-image input.**
      - **Risk decision: temporarily accepted, not dismissed.** Explicitly not resolved because doing
        so requires `next@16.3.0`, a semver-major upgrade — out of scope for a dependency-governance
        PR per this task's own instruction not to combine major upgrades with routine remediation.
        Reassess immediately if either changes: (a) `images.remotePatterns`/`domains` is ever added,
        or (b) any user-controlled CSS or rich-text input path is introduced.
      - **Deferred major upgrade — Next.js 15.5.21 → 16.3.0.** Not performed in this PR. Requires its
        own dedicated branch and explicit decision, not a routine dependency PR, because: React 18 →
        19 compatibility across every component, App Router/Image Optimization/ISR-revalidate
        behavioural changes between majors, `next.config.js` option renames/removals, and
        `eslint-config-next` must move in lockstep (currently pinned to `15.5.21` exactly). **Areas
        requiring regression testing:** the Route Atlas's client-side interaction model
        (`components/founder/atlas-feel-test.tsx`), every ISR/`revalidate = 21600` page, all
        `next/image` call sites (static-only today, but the optimization pipeline itself changes
        version), the CSP report-only headers in `next.config.js`, and the full Vitest suite +
        production build against the new major before any merge. **Recommended branch name:**
        `chore/next-16-major-upgrade`. **Acceptance criteria:** zero new console/hydration errors on
        every route class (homepage, route/destination/airport `[slug]` pages, forms), full canonical
        test suite green, production build clean, and a manual pass confirming the Atlas and every
        public form still function identically — only then re-run `npm audit fix --force` (or the
        now-current major) to actually close the postcss/sharp advisories.
      - **Why this is "partly closed," not "closed":** every advisory this repository can safely
        resolve without a major upgrade has been resolved (0 dev-only findings remain). The 3
        remaining production-tree advisories are not silently accepted — each has a defensible,
        re-verified mitigation (no reachable input path) and an explicit deferral decision with named
        next steps. Do not mark this item fully closed until the Next.js major upgrade lands and
        `postcss`/`sharp` are genuinely patched, not just judged low-risk.
- [x] **A9.** ~~Reposition "Deals" as tracked fare evidence~~ **Done 8 August 2026.** "Deals" implies
      JetStash has proven a price is unusually good against historical data — it hasn't; every fare
      shown is a dated, hand-checked observation, never a claim of being the cheapest available (see
      `data/deals.ts` and `data/fare-observations.ts`). Audited every customer-facing surface first
      rather than assuming scope: the `/deals` page's own title, hero and card copy already used
      honest "tracked fare" language from prior work, as did `region-hub-page.tsx` and the
      business-class/family-holidays/umrah section headings. The three genuine gaps still saying
      "Deals" were the main nav label, the footer nav label (both `lib/site-config.ts`), and the
      "All deals" filter pill on the `/deals` page itself (`components/sections/deals-explorer.tsx`)
      — all three changed to "Tracked Fares" / "All fares". The `/deals` URL, route, `Deal` data
      type, and every analytics event name (`tripcom_click` and its `{ route, source: 'deal-card' }`
      properties) are unchanged. New `tests/a9-deals-reposition.test.ts` (11 assertions) plus updates
      to two existing tests that hardcoded the old labels (`tests/international-brand-positioning
      .test.ts`, `tests/travel-ready-discoverability.test.ts`). Full canonical suite (1445/1445),
      `tsc --noEmit`, lint and production build all clean; live-verified in dev (nav, footer and the
      `/deals` filter pill all render correctly, no console errors).
- [x] **A12.** ~~Public trust corrections: broken founder CTA, missing affiliate labels, credibility
      wording~~ **Done 8 August 2026.** Three genuine trust cracks fixed in one focused PR, following
      a full audit rather than a guess.
      - **1. Broken public homepage founder CTA — fixed.** The homepage's Economy card
        (`CommercialPaths`, inside `components/homepage-v2/homepage-sections.tsx`, rendered live via
        `journey-desk-home.tsx` → `app/page.tsx`) linked to `/founder/journey-brief/manchester-mumbai`
        — a founder-only surface (see its own doc comment in
        `components/journey-brief/journey-brief-manchester-mumbai.tsx`) that a public visitor could
        never actually reach. Root cause: the Journey Brief prototype was promoted onto the public
        homepage's Economy card without swapping its link for a public destination. Fixed by linking
        to the real public route guide for the same featured journey, `/routes/manchester-mumbai` —
        already the homepage's own flagship thread and a genuine, statically-generated public page
        (confirmed present in `data/routes.ts`, which `generateStaticParams` reads directly). Button
        label changed from "Start with the Journey Brief" to "See the Manchester–Mumbai route guide"
        so the wording matches where it actually goes. A second, pre-existing `/founder` reference in
        `components/homepage-v2/journey-brief-hero.tsx` was found during the audit and left
        untouched — confirmed to have zero importers anywhere in `app/` or `components/`, i.e.
        dead/retired code unreachable from any live route (the same class as the already-retired
        `pull-brief-hero.tsx`), not a live public link.
      - **2. Missing affiliate disclosure — fixed.** Audited every customer-facing Trip.com hand-off.
        The route-page hero CTA and Book-By Countdown CTA already showed "Partner link, opens
        Trip.com in a new tab." Three did not: `DealCard`, `NoFareFallback`, and the Travel Ready
        Check booking CTA (`components/travel-ready/travel-ready-check.tsx`) — all three now show
        the same wording. Every route-specific Trip.com URL, the shared `PROVIDER_REL` rel constant
        (`nofollow sponsored noopener noreferrer`), every analytics event name/property
        (`tripcom_click`, `ready_check_book_cta_click`), fail-closed behaviour on unsupported routes,
        and the footer's Affiliate Disclosure link are all unchanged — confirmed by dedicated
        regression tests, not just visual inspection.
      - **3. Credibility wording corrected.** "A member of our team" (implying paid staff a
        founder-led site doesn't have) removed from `app/deals/page.tsx`, `app/about/page.tsx` (whose
        own section title already said "checked by a person" — the body text contradicted its own
        heading) and `components/route/fare-history-panel.tsx`, without inventing a replacement claim
        — the underlying fact (fares are hand-checked and dated) stays exactly as true as before.
        "JetStash hands you a live-fare check" (implying JetStash itself supplies live fares) in the
        same homepage Economy card corrected to name Trip.com's own current partner search as the
        live/current part. No founder legal identity published anywhere.
      - **Tests.** New `tests/public-trust-corrections-aug2026.test.ts` (19 assertions): the actual
        rendered `CommercialPaths` component (not just source text) carries no `/founder` link and
        does link to `/routes/manchester-mumbai`; a real recursive scan of every `.tsx` file under
        `app/` and `components/` (excluding the genuine founder-only directories and the confirmed
        dead `journey-brief-hero.tsx`) for a literal `href="/founder"` finds none; all three newly
        fixed Trip.com CTAs show the partner-link wording; `PROVIDER_REL` is bound (not hardcoded) at
        every fixed call site and the shared constant itself still carries all four safe tokens;
        every analytics event name/property and fail-closed message is asserted unchanged; the
        footer's Affiliate Disclosure link is asserted unchanged; "our team" / "a member of" and the
        old "JetStash hands you a live-fare check" phrasing are asserted absent from every affected
        file. One pre-existing test (`tests/madinah-affiliate-link.test.ts`) hardcoded the old
        single-line DealCard caption text and was updated (whitespace-normalised) to match the new
        two-line, disclosure-prefixed wording — the underlying itinerary/baggage/booking-terms fact
        it checks for is unchanged. Full canonical suite (1464/1464), `tsc --noEmit`, lint and
        production build all clean.
      - **Explicitly not done, per this PR's own scope:** TravelUp was not reintroduced (it remains
        fully removed — see `lib/booking-providers.ts`'s own doc comment); no public Arrive By work
        was started (`/founder/arrive-by` remains the only Arrive By route, confirmed by directory
        scan); no route facts, fare observations, affiliate URLs, dependencies, DNS, environment
        variables or Vercel configuration were changed; no Terms were published; the homepage was not
        redesigned — only the specific broken link, three missing disclosures, and three sentences
        were corrected.

## F–G — Paid-advertising readiness

Do not materially scale paid spend or partner-promotion conversations until the genuinely open
gates close. Historical controlled pilots do not change this rule. Keep this list separate from
section A — controlled organic use does not require these.

**Current interpretation (27 August 2026):** conversion instrumentation is complete; F1 remains
open for meaningful settled evidence. G1's original promotion-specific fare requirement is closed,
while `FARE-001` remains an ongoing editorial maintenance programme in `STATUS.md`/`ROADMAP.md`.

- [ ] **F1.** Confirm real Vercel Analytics events exist and are visible in the dashboard for:
      page visits, Route Atlas interaction, Travel Ready Check completion, affiliate-link clicks,
      and all three lead-capture successes (Contact, Quote Request, Newsletter). If any event isn't
      currently instrumented, add a `track()` call via the existing `lib/analytics.ts` wrapper —
      never call the vendor SDK directly from a component.
      **Code-side instrumentation confirmed complete, 6 August 2026** — re-audited directly against
      this exact list: `<Analytics />`/`<SpeedInsights />` are mounted in `app/layout.tsx` (page
      visits); `atlas_origin_selected`/`atlas_destination_selected`/`atlas_route_opened` are wired
      with real call sites in `components/founder/atlas-feel-test.tsx`; `travel_ready_check_started`/
      `_completed`/`_verdict` are wired in `components/travel-ready/travel-ready-check.tsx`;
      `tripcom_click` fires from every affiliate hand-off via the shared `TrackedOutboundLink`
      (`deal-card.tsx`, `no-fare-fallback.tsx`, `app/routes/[slug]/page.tsx`); `contact_submit_success`,
      `quote_request_submit_success` and `newsletter_subscribe_success` are wired in their respective
      form components. All 23 typed events, the 2-property Vercel Pro ceiling, and PII exclusion are
      covered by `tests/analytics-events.test.ts`, `tests/analytics-property-limit.test.ts` and
      `tests/atlas-journey-check-analytics.test.ts` — 71/71 passing. This work actually landed
      31 July–5 August 2026 (`db459c9`, `8bb6883`) but was never reflected here — this checklist had
      drifted stale, not the instrumentation.
      **Dashboard reviewed 8 August 2026 — partly complete, closing this item's remaining question
      with an honest answer rather than leaving it open indefinitely.** Base traffic measurement
      (page views, landing pages) is confirmed live in the real Vercel dashboard — 24 visitors
      reaching the homepage, Deals, Manchester–Dubai, Manchester–Mumbai, Manchester–Lahore, Travel
      Ready Check and the route directory. Custom events (Atlas interaction, Travel Ready Check
      completion, `tripcom_click`, lead-capture successes) do not currently render in the dashboard
      — this is a **Vercel Hobby plan limitation, not a broken-tracking finding**: the code-side
      instrumentation confirmed above is unaffected, and "no custom events visible" does not mean no
      one interacted. With only 24 visitors, much of that activity may also be our own testing and
      production checks — far too small a sample for any redesign or conversion decision regardless
      of which numbers are visible. **Decision: stay on the Hobby plan for now.** Upgrading purely
      to unlock more numbers would be premature; revisit only once missing custom-event visibility
      is actually blocking a real product decision. In the meantime, page views/landing pages
      (Vercel), Search Console impressions/clicks, the Trip.com affiliate dashboard, successful
      contact/quote emails, and Brevo newsletter/Route Watch signups together give enough signal for
      the first ~100 visitors. This item stays open, not closed — it is the founder's own dashboard
      access and judgement that confirmed this, not a repository-side change, and the eventual
      upgrade decision remains theirs to make when the numbers actually warrant it.
      **Measurement process documented, 8 August 2026 (sometimes referred to as "A10" in founder
      shorthand — this is the same item as F1 above, not a separate checklist entry).** Two new
      docs formalise how the currently-available evidence actually gets read, rather than leaving
      that ad hoc: `FIRST_10_USER_TEST.md` (a founder-led, unmoderated-style test with 10 real
      people — task list, strict no-coaching/no-fixing-mid-session operating rules, and a
      privately-kept per-user record template with zero real participant data committed to this
      repository) and `FIRST_100_VISITORS_WORKSHEET.md` (a weekly template combining Vercel
      visitors/page views/top pages/device split, Search Console clicks/impressions/CTR/position/
      top queries/landing pages, Trip.com outbound activity and commissions where available,
      contact/quote/newsletter/Route Watch signups, and founder observations — explicitly
      restating that custom events are Hobby-plan-unavailable rather than zero, that traffic is too
      small for conversion-rate claims, and that no paid-advertising decision is made before a
      credible funnel and stop-loss rule exist). Both are process documents only — no code, no
      analytics event, no Vercel configuration change, and no real user-test or weekly-visitor
      results are recorded in either file yet. **This item remains partly complete, not closed,
      until real evidence is actually collected using this process** — writing the process down is
      not the same as having run it.
- [x] **G1.** ~~Add genuine fare observations for promoted routes.~~ **Closed by 27 August 2026.**
      The archive now contains 226 append-only observations and 83 current Fare Signals, including
      the controlled campaign corridors. No past fare was reconstructed to close this item. This
      closes the original paid-promotion evidence gap; it does not close the separate, ongoing
      `FARE-001` freshness cadence.

## H–J — Post-launch / housekeeping

Real, but genuinely non-blocking for either organic or paid readiness. No urgency.

- [ ] **H1.** Remove the dead pull-brief homepage code (`lib/homepage-flagship.ts`,
      `lib/flagship-status-copy.ts`, `components/homepage-v2/pull-brief-hero.tsx`,
      `components/homepage-v2/pull-brief.tsx`, `components/homepage-v2/pull-brief-math.ts`) and its
      dedicated tests, or explicitly mark it archived with a comment explaining why it's kept.
      Confirmed zero live imports as of 29 July 2026.
- [ ] **I1.** Delete `fix/trust-cracks-july` and `fix/verification-pending-leakage` (confirmed
      nothing stranded — see "Confirmed facts" above) once no longer wanted for reference. Review
      the two other flagged worktrees (`fix/trust-cracks-final`'s relationship to
      `prototype/atlas-feel-test`, and the stale OneDrive clone with one unpushed commit) and decide
      what to keep.
- [ ] **J1.** Continue the weekly fare-observation cadence defined in `ROUTE_COVERAGE.md` and
      `FARE_OBSERVATION_ARCHIVE.md` — ongoing, not a one-time task, and not blocking either launch
      track on its own (distinct from G1's promotion-specific prioritisation).

---

## Change log

- **29 July 2026** — checklist created following founder review and acceptance of the launch
  readiness audit.
- **6 August 2026** — F1's code-side instrumentation re-audited and confirmed complete (it had
  actually landed 31 July–5 August via `db459c9`/`8bb6883`, but this checklist was never updated to
  reflect it). F1 stays open — only the real-dashboard-data confirmation remains, which needs the
  founder's own Vercel access.
- **7 August 2026** — new **A6** item added and partly closed: production-log PII redaction and
  the Brevo not-found/uncertain-lookup fail-closed fix are done; distributed/WAF-backed rate
  limiting remains a documented, unresolved infrastructure gap ahead of paid acquisition traffic.
- **7 August 2026** — new **A11** item added and partly closed: Atlas SVG semantics
  (`role="img"` → `role="group"`), dark-surface text contrast (`ink-400`/`ink-500` →
  `ink-300`), route-page heading order (`h4` → `h3`) and mouse-centric Atlas wording are all
  fixed and regression-tested; real assistive-technology (NVDA/JAWS/VoiceOver) certification and
  field Core Web Vitals both remain outstanding, the latter blocked on real traffic volume rather
  than anything this repository can fix directly.
- **8 August 2026** — new **A3** item added, superseding D1: dependency-security re-audited from
  scratch (not the old report). `nanoid`, `js-yaml` and both `brace-expansion` instances safely
  patched via `npm audit fix` (no `--force`, lockfile-only). Full audit dropped 6 findings → 3, all
  dev-only advisories now clear. Remaining 3 (`next`/`postcss`-nested/`sharp`) all require
  `next@16.3.0` — re-verified against current code (no `images.remotePatterns` configured, no
  user-controlled CSS input path anywhere) and temporarily accepted with a documented, defensible
  mitigation, not dismissed. Major upgrade deferred to its own dedicated branch with named
  acceptance criteria — not performed in this PR.
- **8 August 2026** — **B2** (Terms & Conditions) repository-side preparation completed, item stays
  open. New `docs/legal/A4_LEGAL_REVIEW_PACK.md`: consolidates the current live Privacy
  Policy/Affiliate Disclosure state and the unpublished Terms draft, a direct-from-code audit of
  where affiliate/commission notices actually appear around every Trip.com click-through point
  (footer-only human-visible disclosure; only the route-guide hero CTA carries "Partner link"
  wording; `deal-card`/`no-fare-fallback` CTAs carry none), the full list of open decisions B2 has
  always required (trading/legal identity, contact/postal address, jurisdiction, legal-notices
  contact, liability wording, ATOL/ABTA phrasing, consumer-law applicability, retention periods,
  international-transfer mechanism, affiliate wording/placement, the publish go/no-go), and a
  reviewer checklist. No Terms published, no `/terms` route created, nothing invented — every open
  item is a named external/professional decision, not repository work.
- **8 August 2026** — F1's real Vercel dashboard reviewed for the first time (24 visitors). Base
  traffic measurement (page views, landing pages) confirmed live; custom events don't render on the
  Hobby plan — a plan limitation, not a broken-tracking finding. Decision recorded: stay on Hobby
  for now, revisit only once missing event visibility blocks a real product decision. F1 stays open
  pending that future revisit.
- **8 August 2026** — new **A9** item added and closed: "Deals" repositioned as "Tracked Fares"
  across the main nav, footer nav and the `/deals` page's own filter pill — the only three
  customer-facing surfaces still using the old language after a full audit (the page's title, hero
  and card copy already said "tracked fare"). URL, `Deal` type and every analytics event name
  unchanged.
- **8 August 2026** — F1 (the item also referred to as "A10" in founder shorthand) updated again:
  the first-users measurement pack is documented — `FIRST_10_USER_TEST.md` (founder-led 10-person
  test procedure) and `FIRST_100_VISITORS_WORKSHEET.md` (weekly template combining Vercel, Search
  Console, Trip.com, form-submission and Brevo signals). Process only, no results recorded yet, no
  code/analytics/Vercel-configuration change. F1 stays partly complete until the process has
  actually been run.
- **8 August 2026** — new **A12** item added and closed: public trust corrections. The homepage's
  Economy card linked to a founder-only `/founder/journey-brief/manchester-mumbai` page no public
  visitor could reach — fixed to link to the real public `/routes/manchester-mumbai` route guide.
  Three Trip.com CTAs (`DealCard`, `NoFareFallback`, Travel Ready Check) were missing the visible
  "Partner link" disclosure the route-hero and Book-By Countdown CTAs already had — all three now
  match. "A member of our team" and "JetStash hands you a live-fare check" corrected across four
  customer-facing files, without inventing a replacement claim. TravelUp remains fully retired and
  was not reintroduced; no public Arrive By work was started.
