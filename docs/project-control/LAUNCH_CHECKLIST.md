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
- **7 August 2026** — new **A6** item added and partly closed: production-log PII redaction and
  the Brevo not-found/uncertain-lookup fail-closed fix are done; distributed/WAF-backed rate
  limiting remains a documented, unresolved infrastructure gap ahead of paid acquisition traffic.
