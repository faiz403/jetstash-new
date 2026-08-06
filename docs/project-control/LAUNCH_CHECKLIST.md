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
- [x] **E1.** ~~Fix the 404 page's missing title~~ **Done 29 July 2026** — `app/not-found.tsx` had
      no `metadata` export, so the tab fell back to the root layout's default title (the
      homepage's). Added `title: 'Page Not Found'`, resolving through the layout's `%s | JetStash`
      template to "Page Not Found | JetStash". No layout, copy or behaviour change; still a genuine
      HTTP 404. Verified live in dev and covered by `tests/not-found-page-title.test.ts`.

## F–G — Paid-advertising readiness

Do not begin paid spend or partner-promotion conversations until these close. Keep this list
separate from section A — organic readiness does not require these.

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
      drifted stale, not the instrumentation. **What's genuinely still open:** confirming real
      visitor events are actually landing in the Vercel Analytics dashboard — that needs the
      founder's own dashboard access, not a code change; not confirmed as of this note.
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
- **6 August 2026** — F1's code-side instrumentation re-audited and confirmed complete (it had
  actually landed 31 July–5 August via `db459c9`/`8bb6883`, but this checklist was never updated to
  reflect it). F1 stays open — only the real-dashboard-data confirmation remains, which needs the
  founder's own Vercel access.
