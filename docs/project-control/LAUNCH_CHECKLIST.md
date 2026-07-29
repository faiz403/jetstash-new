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
- [ ] **C1.** Either add a verified TravelUp deep link for the Madinah route (verify a real
      destination-specific page exists by visiting it directly, following the same method already
      documented in `lib/booking-providers.ts`), or update the Madinah route page's CTA wording so
      it accurately describes landing on TravelUp's generic search rather than implying a
      Madinah-specific page.
- [ ] **D1.** Assess the 3 high-severity `npm audit` advisories (PostCSS, sharp — both transitive
      via `next`) and document a safe remediation path. **Never run `npm audit fix --force`** —
      it downgrades Next.js to `9.3.3`, an unrelated breaking regression. The fix is most likely a
      future Next.js minor release that bundles patched versions; check before assuming one exists.
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
