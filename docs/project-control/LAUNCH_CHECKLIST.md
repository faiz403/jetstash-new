# JetStash Launch Checklist

**Established:** 29 July 2026, following founder review and acceptance of
`LAUNCH_READINESS_AUDIT_2026-07-29.md`.

This is the single checklist of record for launch readiness. Do not create a competing or
duplicate checklist elsewhere — update this file as items close, and add newly discovered items
here rather than starting a fresh document.

## Confirmed facts (do not reopen as uncertain)

- The Route Atlas is complete, interactive and live on the public homepage.
- Intended airport and destination imagery is complete and live.
- Contact, Quote Request and Newsletter delivery all work — freshly re-verified live 29 July 2026.
- Fare-observation governance and methodology are complete; fare *coverage* (how many routes have
  logged observations) remains an ongoing, ever-growing series, not a one-time deliverable.
- JetStash is ready for public organic launch after the short hardening pass below (section A).
- Paid advertising remains blocked until analytics and conversion events are verified in the real
  dashboard (section F).
- No required production fix is stranded in `fix/verification-pending-leakage` or
  `fix/trust-cracks-july` — both were checked directly against `origin/main` on 29 July 2026 and
  contain nothing that isn't already live via later, independent commits.

## Verdict

**READY FOR PUBLIC ORGANIC LAUNCH.** Not yet ready for paid advertising or partner promotion — see
section F for the specific, verifiable reason.

Full detail, scoring, and evidence: `LAUNCH_READINESS_AUDIT_2026-07-29.md`.

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
      during this PR.
- [ ] **B1.** Draft JetStash Terms & Conditions and route to professional legal review before
      publishing. Do not draft from a generic template and treat that as sufficient.
- [x] **C1.** ~~Fix the Madinah affiliate-link wording~~ **Done, PR pending review** — no genuine
      route-specific TravelUp page could be verified for Madinah (unlike every other route
      destination), so per the decision rule the generic tracked link was kept and the CTA/caption
      wording was corrected instead, on both Madinah route pages (`manchester-madinah`,
      `birmingham-madinah`) and both Madinah deal cards. New `hasVerifiedDeepLink()` helper in
      `lib/booking-providers.ts` drives the route-hero wording generically (safe today — Madinah is
      the only route destination without a deep link); the deal-card fix is deliberately scoped to
      `deal.toDestinationSlug === 'madinah'` only, since the same gap exists for several
      Mediterranean/North-Africa deals and fixing those too would be a broader refactor outside
      this task's scope — flagged as a separate follow-up, not fixed here.
- [x] **D1.** ~~Assess the npm audit advisories~~ **Investigated and resolved for organic-launch
      purposes, 29 July 2026** — see PR. `npm audit fix` was run **without** `--force`.
      `brace-expansion` `5.0.7` (nested under `@typescript-eslint/typescript-estree`) was patched
      to `5.0.8`, the version the official advisory (GHSA-mh99-v99m-4gvg) marks as fixed. A second,
      legacy `brace-expansion` copy (`1.1.17`, reached via `eslint@8.57.1` → `minimatch@3.1.5`)
      remains — no patched release exists in that 1.x line; the advisory was only ever fixed in
      5.x. Fully removing it would require a major `eslint` upgrade (`eslint@10.8.0`), which is
      **deferred**, not attempted, since it has no customer or revenue benefit before launch. The
      top-level development `postcss` and `nanoid` copies also received safe patch-level updates
      (`postcss` to `8.5.25`, past `8.5.18`, the version GHSA-r28c-9q8g-f849 marks as fixed).
      Next.js's own nested `postcss` (`8.4.31`) and `sharp` (`0.34.5`) advisories remain — no
      Next.js release, including the latest, bundles patched versions of either. **Do not run
      `npm audit fix --force`** — it suggests downgrading to `next@9.3.3`, an unrelated breaking
      regression, not a real fix. No dependency overrides were added.
      **Accepted and monitored, not fully eliminated:** JetStash has no attacker-controlled CSS or
      image-processing input path today — no user-uploaded images, no remote image URLs, no user
      styles or theming, nothing that would let a visitor's input reach `postcss` or `sharp` at
      runtime. Both remaining production-tree advisories (`postcss`, `sharp`, both nested under
      `next`) and the one remaining dev-only `brace-expansion` instance are being monitored, not
      chased further, for this reason. **Reassess immediately** if JetStash later accepts
      user-uploaded images, remote image URLs, user-supplied styles, or any other untrusted
      CSS/image input — monitor upstream Next.js, sharp, PostCSS and ESLint releases for a version
      that resolves these without a breaking change.
- [ ] **E1.** Fix the 404 (not-found) page's missing `<title>` metadata export so the browser tab
      doesn't keep showing the homepage title.
- [ ] **E1.** Fix the 404 (not-found) page's missing `<title>` metadata export so the browser tab
      doesn't keep showing the homepage title.

## F–G — Paid-advertising readiness

Do not begin paid spend or partner-promotion conversations until these close. Keep this list
separate from section A — organic readiness does not require these.

- [ ] **F1.** Confirm real Vercel Analytics events exist and are visible in the dashboard for:
      page visits, Route Atlas interaction, Travel Ready Check completion, affiliate-link clicks,
      and all three lead-capture successes (Contact, Quote Request, Newsletter). If any event isn't
      currently instrumented, add a `track()` call via the existing `lib/analytics.ts` wrapper —
      never call the vendor SDK directly from a component.
- [ ] **G1.** Add genuine fare observations, following the existing methodology in
      `FARE_OBSERVATION_ARCHIVE.md`, prioritising the specific routes intended for paid promotion
      before that spend begins. Never backfill a price for a day that wasn't actually checked.

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
