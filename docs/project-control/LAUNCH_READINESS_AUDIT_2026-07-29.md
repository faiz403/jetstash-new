# JETSTASH LAUNCH READINESS AUDIT

**Audit date:** 29 July 2026
**Audited by:** Claude (Sonnet 5), full pre-launch readiness audit per founder brief
**Status:** DRAFT — not committed, not pushed, no PR opened. Awaiting founder review.

---

## 1. EXECUTIVE VERDICT

### READY FOR PUBLIC ORGANIC LAUNCH

**Not** ready for paid advertising and partner promotion yet.

Plainly: nothing I found is broken, dishonest, or dangerous. Every core customer journey I tested — Contact, Quote Request, Newsletter signup, Travel Ready Check, the Route Atlas, affiliate booking links — actually works, end to end, verified live on production tonight, not inferred from old test runs or from documentation. The founder route hierarchy (`/founder/*`) is genuinely inaccessible in production and correctly excluded from search indexing. The site's evidence discipline (no invented fares, no fabricated urgency, honest "not yet researched" states) is real and holds up under direct inspection, not just in the copy that says it does.

That is enough to be safe for organic promotion: telling people about it, posting about it, sharing it in communities, letting Google keep indexing it. It is **not yet enough to spend money driving traffic at scale or to walk into a partner negotiation with confidence**, for four concrete reasons, each with evidence in this report:

1. **Fare intelligence is genuinely early**, not merely under-marketed. 11 of 27 route pages have any observed fare data at all, and only 5 of 24 total observations follow the finalized, fully-compliant methodology — the other 19 predate it and are missing required fields. This is honestly disclosed in the codebase's own documentation, which is good, but it means the "verified corridor intelligence is the moat" positioning is currently thin in practice, not just in perception.
2. **The founder cannot currently answer basic operational questions** — how many people visit, whether affiliate links convert, whether forms fail silently in production — without dashboard access I could not obtain during this audit (Vercel Analytics, Resend, Brevo dashboards). The instrumentation exists in code; whether it's actually being watched is unverified.
3. **Legal coverage has a real gap**: no Terms & Conditions page exists anywhere on the site, and Cookie Policy is folded into three sentences inside Privacy Policy. Not a P0 for a UK affiliate/lead-gen site with no on-site transactions or accounts, but a real gap a partner or a cautious visitor could reasonably notice.
4. **Basic security headers are missing** (no CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy — only HSTS is present), and `npm audit` reports 3 high-severity transitive vulnerabilities. Neither is an active exploit path for this specific site (no user-generated content, no auth, no payments), but neither belongs in a "ready to advertise" state either.

None of these four are launch blockers in the sense of "the site doesn't work" — they're the difference between "safe to let people find you" and "safe to actively spend money getting people to find you." Fix the top of the queue in this report (section 9) before paid spend or partner conversations; the rest can genuinely wait.

**One meta-finding matters more than any single item above**: the project's own tracker documents (`STATUS.md`, `ROADMAP.md`, `COMPLETED.md`, `DECISIONS.md`) do not mention the Route Atlas at all — the single biggest change to the site this month, currently the entire homepage. That's not a customer-facing problem, but it's very likely *why* this audit was requested: if the tracker is missing something this large, it cannot be fully trusted for anything smaller either. Section 12 gives the exact reconciliation needed.

---

## 2. OVERALL SCORE: 66 / 100

This is a simple average of the 18 category scores below (out of 10 each), not weighted toward documentation. Governance and methodology quality — which is genuinely strong throughout this codebase — does **not** raise this number; only verified customer-facing and operational reality does. Several categories are scored conservatively specifically *because* I could not obtain the tooling/access to verify them (Core Web Vitals, automated accessibility scanning, analytics dashboards) — see each category's "unverified" note rather than reading a mid-range score as "average quality."

---

## 3. CATEGORY SCORECARD

| # | Category | Score /10 | Status | Strongest evidence | Biggest weakness |
|---|---|---|---|---|---|
| 1 | Product purpose & differentiation | 7 | Partially complete | "The JetStash Difference" section states the mission plainly and matches what the site actually does | The differentiation reasoning is one scroll below the fold, not in the first 5-second view — the Atlas alone doesn't explain "why not Skyscanner" |
| 2 | Homepage | 7 | Partially complete | Route Atlas is visually distinctive and evidence-backed, not generic; founder's own same-session review independently scored it 9/10 | Mobile Atlas remains information-dense even after tonight's fixes; zero real funnel/conversion data exists (`CONV-001` explicitly unstarted) |
| 3 | Core customer journeys | 8 | Verified complete (sampled) | Contact, Quote Request, Newsletter, Atlas navigation, affiliate links and Travel Ready Check all directly tested live tonight, not inferred | Not every journey (e.g. "returning from external partners") was tested; Deals page filters not live-tested this pass |
| 4 | Route & destination intelligence | 8 | Verified complete (governance + sample) | `ROUTE_COVERAGE.md` fail-closes 3 disputed routes honestly rather than guessing; India destinations (Mumbai/Delhi/Ahmedabad/Amritsar) have real route pages and fare data, not neglected | Coverage is 27 routes total — real but modest; several routes rely on single-source verification |
| 5 | Travel Ready Check | 8 | Verified complete (live test) | Live-tested tonight: correct GOV.UK-sourced verdict, appropriately hedged language ("avoid a non-refundable fare for now"), no data stored | Only one live scenario tested tonight (Pakistan, British passport); the other 6 countries and NICOP/OCI paths were not freshly re-tested |
| 6 | Fare intelligence | 5 | Governance complete, content early | Methodology is genuinely rigorous and honestly self-critical in its own documentation | Only 11 of 27 routes have any observation; only 5 of 24 total observations meet the finalized methodology — this is a real, not perceived, gap |
| 7 | Affiliate & commercial links | 7 | Verified complete (sampled) | 3 of 13 verified deep links live-tested tonight, all resolved to the correct destination page with real prices, not London or a wrong route | Single-provider dependency (TravelUp only); found one real coverage gap (Madinah route has fare data but no deep link, falls back to generic landing) |
| 8 | Forms, email & lead capture | 8 | Verified complete | All 3 forms tested live tonight including a real error path, real duplicate submission, real Resend delivery confirmation (100% deliverability, 0 bounces) and real Brevo contact/attribute verification | One defect found and fixed this session (newsletter generic error message) — evidence the "founder-confirmed complete" claim in `COMPLETED.md`/`OPS-001` wasn't fully accurate at the time |
| 9 | SEO & indexing | 7 | Partially complete | Full OG/Twitter/canonical metadata present and correct; sitemap and robots.txt both clean, zero founder-route leakage confirmed | 404 page doesn't set its own `<title>`; no visibility into actual Search Console configuration from the repository |
| 10 | Security, privacy & internal routes | 6 | Partially complete | `/founder/*` confirmed genuinely inaccessible in production (HTTP 404, not just hidden from nav) via both live test and build output (server-rendered, not statically prerendered) | No CSP, X-Frame-Options, X-Content-Type-Options or Referrer-Policy headers present; `npm audit` reports 3 high-severity transitive vulnerabilities |
| 11 | Legal & trust requirements | 6 | Partially complete | Privacy Policy and Affiliate Disclosure both exist, are genuine (not boilerplate), and are honest about what is and isn't collected | No Terms & Conditions page anywhere on the site; no dedicated Cookie Policy (folded into 2 sentences of Privacy Policy) |
| 12 | Accessibility | 5 | Unverified (no tooling) | Code-level evidence of good practice: `aria-live` regions on form status, proper `<label htmlFor>` pairing, `focus-visible` outline classes throughout | No automated WCAG scan (no axe-core/Lighthouse available in this environment) and no manual screen-reader pass performed — this score is a conservative placeholder, not a real audit result |
| 13 | Responsive design & browser quality | 7 | Partially verified | Mobile (375px) tested repeatedly and directly tonight across multiple pages, including two real fixes shipped and re-verified live | Not all 6 requested breakpoints (320/375/390/768/1024/1440) individually tested; only mobile and default desktop widths confirmed this session |
| 14 | Visual identity & assets | 7 | Partially complete | Airport photography (11/11) and destination photography (24/24) independently verified via file/data cross-reference — both genuinely complete, not placeholder, and self-disclosed as generated brand art rather than overclaimed as documentary photography | The Route Atlas is now genuinely public and live (supersedes the audit brief's own hypothesis that it's still founder-only) but has no dedicated entry in the visual-identity documentation at all |
| 15 | Performance & technical quality | 7 | Verified complete (build/tests only) | `tsc --noEmit`, lint, full Vitest suite (549/549) and production build all pass cleanly on the audited commit | No Core Web Vitals, Lighthouse, or bundle-analysis data obtained — no tooling available in this environment; this is a real gap in the audit, not a claim the site is fast |
| 16 | Analytics, monitoring & operations | 4 | Largely unverified | `lib/analytics.ts` exists as a single tracked-event wrapper per `CLAUDE.md`; Vercel Analytics/Speed Insights confirmed mounted via live network requests tonight | No access to the actual Vercel Analytics dashboard, Resend dashboard (beyond what the founder already reported), or Search Console — cannot confirm the founder can currently answer "how many visitors, where do they leave, do links work" without those logins |
| 17 | Content quality | 7 | Partially verified | Zero fabricated statistics or invented urgency found anywhere touched during this audit; route pages honestly flag "verification pending" states rather than guessing | No exhaustive spelling/grammar/proofreading pass was performed across all 27+24+11+9 content pages |
| 18 | Launch operations | 5 | Partially verified | Domain, SSL/HSTS, Vercel deployment and automatic CI-to-prod pipeline all confirmed working via live headers and a real merge-to-deploy cycle earlier tonight | No visibility into rollback procedure, Search Console submission status, or a defined support/triage process — these are operational facts I cannot see from the repository or the live site alone |

---

## 4. TOP 10 GENUINE LAUNCH BLOCKERS

Read carefully: **most of these are P2, not P1** — per the brief's own instruction not to inflate every imperfection into a blocker. Only items explicitly marked P0/P1 below should stop paid promotion; nothing here should stop organic sharing.

### B1 — Fare intelligence archive is materially thin relative to its own positioning claim
- **Severity:** P2 — important before paid promotion, not before organic launch
- **Affected:** `/deals`, Book-By Countdown panels, any route page without a fresh observation
- **Evidence:** `data/fare-observations.ts` contains 24 real entries across 11 unique routes (out of 27 total route pages); only 5 entries follow the finalized methodology (`profileId`, `observedVia`, `currency`, `baggage` all populated), dated 28 July 2026; the remaining 19 predate the methodology and are missing those fields
- **Reproduction:** `grep -c "id: 'obs-" data/fare-observations.ts` → 25 (24 real + 1 template); `grep "id: 'obs-" data/fare-observations.ts | grep -c "profileId:"` → 6 (5 real + 1 template)
- **Impact:** "Verified corridor intelligence is the moat" (per `DECISIONS.md`) is a real, well-designed strategy, but the moat is currently shallow. A visitor checking 16 of the 27 route pages will see zero fare context at all — the honest empty-state fallback (route facts instead of a price), which is correct behaviour, not a bug, but doesn't yet deliver the differentiation the mission statement promises
- **Recommended fix:** continue the weekly cadence already defined in `ROUTE_COVERAGE.md` and `FARE_OBSERVATION_ARCHIVE.md` — no redesign needed, this is a content-accumulation problem, not an engineering one
- **Files involved:** `data/fare-observations.ts`, `docs/project-control/FARE_OBSERVATION_ARCHIVE.md`, `docs/project-control/ROUTE_COVERAGE.md`
- **Effort:** L (ongoing, weekly) — not a one-time fix
- **Dependencies:** none — purely editorial time
- **Verification after fixing:** re-run the grep commands above and confirm the "unique routeSlugs" count rises

### B2 — Founder cannot currently see whether the commercial path is working
- **Severity:** P1 — launch blocker for paid advertising specifically, not for organic
- **Affected:** entire commercial funnel (affiliate clicks, form conversions)
- **Evidence:** `lib/analytics.ts` and Vercel Analytics/Speed Insights are confirmed mounted (live network requests to `/6a6371460f1f1167/*` and `/32802fbe61d15420/*` observed tonight), but I had no access to the actual analytics dashboard, and could not confirm what events are actually configured to fire vs. just the wrapper existing
- **Reproduction:** attempted `app.brevo.com` and equivalent dashboard checks — see Verification Appendix for exactly what access is missing
- **Impact:** spending money to drive traffic without being able to see whether that traffic converts, clicks affiliate links, or abandons forms is the single highest-risk gap for paid promotion specifically
- **Recommended fix:** founder to confirm Vercel Analytics dashboard is actively checked, and that `track()` calls exist at the key conversion points (form success, affiliate click) — a code grep for `track(` call sites, cross-referenced against the dashboard, would close this in under an hour
- **Files involved:** `lib/analytics.ts`, every component calling `track(...)`
- **Effort:** S (verification only, likely already instrumented)
- **Dependencies:** Vercel dashboard access
- **Verification after fixing:** founder screenshots or confirms live event data exists for at least one real session

### B3 — No Terms & Conditions page
- **Severity:** P2
- **Affected:** entire site (referenced from nowhere in the footer)
- **Evidence:** `find app -iname "*terms*"` returns nothing; `grep -in "terms" components/layout/footer.tsx` returns nothing; sitemap.xml contains no terms URL
- **Impact:** not a P0/P1 given JetStash handles no on-site payments, accounts, or bookings (all transactions happen on partner sites), but a UK-facing commercial website without any Terms of Use is a real, visible gap a partner or a careful visitor could flag
- **Recommended fix:** add a Terms of Use page covering site usage, disclaimers already partially stated in Affiliate Disclosure, and liability limitations — **flag for professional legal review, do not draft from a template and treat as sufficient**
- **Files involved:** new `app/terms/page.tsx`, footer link addition
- **Effort:** M (content drafting + legal review, not engineering)
- **Dependencies:** legal review
- **Verification after fixing:** page exists, is linked from footer, appears in sitemap

### B4 — Missing security headers
- **Severity:** P2
- **Affected:** entire site
- **Evidence:** `curl -sI https://jetstash.co.uk | grep -iE "x-frame|content-security|x-content-type|referrer-policy"` returns nothing; only `Strict-Transport-Security` is present
- **Impact:** low real-world exploitability today (no user-generated content, no authentication, no payment forms on-site) but genuinely missing defense-in-depth, and the kind of thing a technically-minded partner or investor might check
- **Recommended fix:** add `X-Frame-Options: DENY` (or `frame-ancestors` CSP directive), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and a scoped Content-Security-Policy via `next.config.js` headers
- **Files involved:** `next.config.js`
- **Effort:** S
- **Dependencies:** none
- **Verification after fixing:** re-run the curl command above and confirm headers present; confirm no functionality breaks (embedded images/scripts) after CSP is added

### B5 — `npm audit` reports 3 high-severity transitive vulnerabilities
- **Severity:** P2
- **Affected:** build tooling (PostCSS) and image optimisation (sharp), both via `next`'s own dependency tree
- **Evidence:** `npm audit --omit=dev` output, captured this session — PostCSS XSS/path-traversal advisories, sharp/libvips CVEs, both requiring a `next` major-version bump to resolve (`npm audit fix --force` would install `next@9.3.3`, itself a breaking downgrade — **do not run this blindly**, it would regress the app to an ancient Next.js version)
- **Impact:** low direct exploitability for this specific site (no user-uploaded images, no user-supplied CSS), but real, dated, high-severity advisories sitting in the dependency tree
- **Recommended fix:** research the correct, non-breaking upgrade path (likely a Next.js *minor* update once one exists that bundles a patched PostCSS/sharp, not the `--force` downgrade `npm audit` suggests) — do not act on this during the audit
- **Files involved:** `package.json`, `package-lock.json`
- **Effort:** M (needs careful version research, not a blind `--force`)
- **Dependencies:** Next.js upstream releasing a compatible patched version
- **Verification after fixing:** `npm audit --omit=dev` reports 0 high-severity findings; full quality gate re-run

### B6 — Madinah route has fare data but no affiliate deep link
- **Severity:** P3
- **Affected:** `/routes/manchester-madinah`
- **Evidence:** live-tested tonight — the page's "Check live price" buttons resolve to `kqzyfj.com/click-101818709-15363607?sid=route-manchester-madinah` with **no** `url=` override, unlike every other tested route; `lib/booking-providers.ts`'s `VERIFIED_DEEP_LINKS` map has no `madinah` entry despite `madinah` appearing in `data/routes.ts`
- **Impact:** a Madinah-bound visitor's "Check live price" click lands on TravelUp's generic homepage/search, not a Madinah-specific page — still tracked, still functional, just a small conversion-friction gap on a route that otherwise has real fare data
- **Recommended fix:** verify a real `travelup.com/en-gb/flight-offers/madinah-*` (or equivalent) page exists by actually visiting it, following the same verification method already documented in `lib/booking-providers.ts`'s own comment, then add the entry
- **Files involved:** `lib/booking-providers.ts`
- **Effort:** XS
- **Dependencies:** none
- **Verification after fixing:** re-test the live route page's rendered href, confirm `url=` param present and the destination page resolves correctly

### B7 — Project-control tracker doesn't mention the Route Atlas at all
- **Severity:** P2 (not customer-facing, but high operational risk)
- **Affected:** `STATUS.md`, `ROADMAP.md`, `COMPLETED.md`, `DECISIONS.md`
- **Evidence:** none of the four core tracker documents mention "Atlas" anywhere; `STATUS.md` still states "The Manchester-to-Mumbai homepage visual is shipped and live" — it was replaced by the Atlas; `COMPLETED.md`'s `TRUTH-001` entry describes the pre-Atlas homepage as current
- **Impact:** this is very likely the direct cause of the founder's stated loss of confidence in the project record — if the single biggest UI change of the month is invisible in the tracker, smaller items cannot be trusted either without independent verification (which is exactly what this audit had to do)
- **Recommended fix:** see section 12 for exact proposed tracker edits
- **Files involved:** all four tracker files
- **Effort:** S (documentation only)
- **Dependencies:** none
- **Verification after fixing:** tracker accurately describes current homepage architecture

### B8 — Multiple worktrees and branches contain unpushed or orphaned work
- **Severity:** P2 (risk of data loss / continued confusion, not customer-facing)
- **Affected:** local development environment only
- **Evidence:** `fix/trust-cracks-july` and `fix/verification-pending-leakage` branches exist only in a local worktree (`C:\Users\faiz2\jetstash-new-trust-cracks`) and were never pushed to GitHub (`git ls-remote origin fix/trust-cracks-july` returns nothing); a separate repository clone at `C:\Users\faiz2\OneDrive\Documents\jetstash-new` is stale by dozens of commits and has one unpushed local commit ("plain-language copy pass on Journey Desk homepage") that doesn't exist on GitHub at all
- **Impact:** real risk of losing genuine work to a disk failure, an accidental `git clean`, or simple confusion about which copy is authoritative; directly contributes to the founder's stated loss of a reliable picture of project state
- **Recommended fix:** founder to review each of the 5 non-`main` worktrees (see section 5), decide what's still wanted, and either commit+push or deliberately discard each — this needs a human decision, not an automated cleanup
- **Files involved:** none (git/workspace hygiene, not application code)
- **Effort:** S–M (mostly review/decision time)
- **Dependencies:** founder time and judgement on what to keep
- **Verification after fixing:** `git worktree list` shows only worktrees still in active use; `git branch -a` no longer lists branches with no remote counterpart and no clear purpose

### B9 — 1,471 lines of dead homepage-hero code remain in the codebase
- **Severity:** P3
- **Affected:** `lib/homepage-flagship.ts`, `lib/flagship-status-copy.ts`, `components/homepage-v2/pull-brief-hero.tsx`, `components/homepage-v2/pull-brief.tsx`, `components/homepage-v2/pull-brief-math.ts`
- **Evidence:** `grep -rln` across `app/` and `components/` confirms zero live imports of any of these five files outside of each other and their own dedicated tests; they implemented the pre-Atlas "pull to reveal" homepage hero, replaced by the Atlas in the merge that shipped this month
- **Impact:** none to customers (this code never runs in production). Real cost: it inflates the test-suite's apparent coverage (several tests assert on this dead code's source text, not on anything a visitor can reach) and will confuse the next person who reads it
- **Recommended fix:** either delete the five files and their dedicated tests, or explicitly mark them as retired/archived with a comment explaining why they're kept — founder decision, not urgent
- **Files involved:** the five files above, plus `tests/homepage-manchester-mumbai-visual.test.ts` and `tests/homepage-route-check-copy.test.ts`
- **Effort:** S
- **Dependencies:** founder confirmation nothing here is wanted back
- **Verification after fixing:** full quality gate re-run, test count decreases accordingly and is documented in `README.md`

### B10 — Not-found (404) page doesn't set its own page title
- **Severity:** P4
- **Affected:** every non-existent URL
- **Evidence:** live-tested tonight — visiting a genuinely non-existent URL correctly returns HTTP 404 with a well-designed, on-brand "This page seems to have flown" message and useful links, but the browser tab title still reads the homepage's own title rather than something 404-specific
- **Impact:** cosmetic only — the page itself is honest and functional
- **Recommended fix:** add a `metadata` export to the not-found page/route
- **Files involved:** likely `app/not-found.tsx`
- **Effort:** XS
- **Dependencies:** none
- **Verification after fixing:** browser tab title updates on a 404 page

---

## 5. COMPLETE FINDINGS REGISTER

*Severity key: P0 critical · P1 launch blocker · P2 important before launch · P3 post-launch improvement · P4 optional.*

| ID | Category | Severity | Blocking? | Finding | Evidence | Affected URL/file | Impact | Recommendation | Effort | Status | Verification method |
|---|---|---|---|---|---|---|---|---|---|---|---|
| F01 | Docs | P2 | No | `STATUS.md`/`COMPLETED.md`/`ROADMAP.md`/`DECISIONS.md` never mention the Route Atlas | Repo-wide grep for "Atlas" across the 4 tracker files: 0 matches | `docs/project-control/*.md` | Undermines trust in the whole tracker | See section 12 | S | Open | Manual doc review |
| F02 | Docs | P2 | No | `STATUS.md` states the Manchester-Mumbai pull-brief visual "is shipped and live" — it was replaced | `STATUS.md` line 14 vs. live homepage (Atlas, not pull-brief) | `docs/project-control/STATUS.md` | Same as F01 | Correct the line | XS | Open | Manual doc review |
| F03 | Git hygiene | P2 | No | Two branches exist only in a local worktree, never pushed to GitHub | `git ls-remote origin fix/trust-cracks-july` → empty | `C:\Users\faiz2\jetstash-new-trust-cracks` | Real risk of lost work | Founder review + push or discard | S | Open | `git ls-remote` after action |
| F04 | Git hygiene | P2 | No | A second full repo clone (OneDrive path) is stale by ~90 commits with one unpushed commit | `git log --oneline` on that clone; commit SHA not found via `gh api` | `C:\Users\faiz2\OneDrive\Documents\jetstash-new` | Same as F03, plus active confusion risk (this audit was almost pointed at the wrong repo) | Founder review + push or discard | S | Open | `gh api repos/.../commits/<sha>` |
| F05 | Git hygiene | P3 | No | 25 of ~28 branches are already fully merged (0 commits ahead of `origin/main`) — safe to delete, just clutter | `git rev-list --count origin/main..origin/<branch>` = 0 for each | Multiple `origin/*` branches | Low — cosmetic clutter, but contributes to "can't tell what's real" | Delete merged branches | XS | Open | `git branch -a` after cleanup |
| F06 | Dead code | P3 | No | 1,471 lines across 5 files (old pull-brief homepage hero) have zero live imports | `grep -rln` across app/components, see B9 | `lib/homepage-flagship.ts` + 4 others | None to customers; misleading to developers/test coverage | Delete or explicitly archive | S | Open | grep re-check |
| F07 | Fare intelligence | P2 | No | Only 11/27 routes have any fare observation | `grep -oP routeSlug` unique count vs. `data/routes.ts` count | `data/fare-observations.ts` | Thin evidence relative to "moat" positioning | Continue weekly cadence | L (ongoing) | Open | Recount after each batch |
| F08 | Fare intelligence | P3 | No | 19/24 real observations predate the finalized methodology and lack required fields | grep count, see B1 | `data/fare-observations.ts` | Explicitly grandfathered by the doc itself — not a violation | None required; optional backfill not recommended (doc explicitly forbids retrospective reconstruction) | — | Accepted | — |
| F09 | Affiliate | P3 | No | Madinah route has no verified deep link despite having fare data | Live test, see B6 | `lib/booking-providers.ts`, `/routes/manchester-madinah` | Minor conversion friction | Verify and add entry | XS | Open | Live href re-check |
| F10 | Affiliate | — | No | 3 of 13 verified deep links spot-checked live tonight (Lahore, Mumbai, Doha) — all correct | Live navigation tonight, real TravelUp pages confirmed | `lib/booking-providers.ts` | Positive finding | None | — | Verified | — |
| F11 | Affiliate | — | No | Base fallback link (no deep link override) confirmed working, redirects to a real TravelUp page with genuine tracking | Live test tonight (earlier operational-verification pass) | `lib/booking-providers.ts` | Positive finding | None | — | Verified | — |
| F12 | Forms | — | No | Newsletter form showed a generic error message regardless of actual API failure reason | Found and **fixed** this session (PR #35, merged) | `components/sections/newsletter-section.tsx` | Was a real inconsistency vs. the other two forms | Already fixed | — | **Fixed** | Live-tested post-fix tonight |
| F13 | Forms | — | No | Contact, Quote Request, Newsletter all verified end-to-end including Resend/Brevo delivery confirmation | Live tests + founder-confirmed Resend/Brevo dashboard checks earlier tonight | `app/api/{contact,quote-request,subscribe}/route.ts` | Positive finding | None | — | Verified | — |
| F14 | Legal | P2 | No | No Terms & Conditions page exists | `find`/`grep` across app + footer, see B3 | site-wide | Real gap for a UK commercial site | Draft + legal review | M | Open | Page exists + linked |
| F15 | Legal | P3 | No | Cookie Policy is 2 sentences inside Privacy Policy, no dedicated page | `app/privacy-policy/page.tsx` line 40 | `/privacy-policy` | Minor — content exists, just thin | Consider expanding if cookie usage grows | S | Open | Manual review |
| F16 | Legal | — | No | Privacy Policy and Affiliate Disclosure both genuine, specific, and honest (not boilerplate) | Full read of both pages | `/privacy-policy`, `/affiliate-disclosure` | Positive finding | None | — | Verified | — |
| F17 | Security | P2 | No | No CSP/X-Frame-Options/X-Content-Type-Options/Referrer-Policy headers | `curl -sI`, see B4 | site-wide | Low active risk, real gap | Add via `next.config.js` | S | Open | `curl -sI` re-check |
| F18 | Security | P2 | No | 3 high-severity `npm audit` findings (PostCSS, sharp), transitive via `next` | `npm audit --omit=dev` | `package.json` | Low active exploitability here; real advisories | Research safe upgrade path, don't force-downgrade | M | Open | `npm audit` re-check |
| F19 | Security | — | No | `/founder/*` confirmed genuinely inaccessible (404) in production, both live and via build output (dynamic, not statically prerendered) | Live test + `npm run build` output tonight | `/founder/*` | Positive finding | None | — | Verified | — |
| F20 | Security | — | No | Sitemap and robots.txt both clean — zero founder-route leakage | `curl` both files tonight | `/sitemap.xml`, `/robots.txt` | Positive finding | None | — | Verified | — |
| F21 | SEO | P4 | No | 404 page doesn't set its own `<title>` | Live test tonight | likely `app/not-found.tsx` | Cosmetic | Add metadata export | XS | Open | Live re-check |
| F22 | SEO | — | No | Full OG/Twitter/canonical metadata present and correct on homepage; og-image resolves (200) | `curl` + grep tonight | `/`, `/og/og-image.png` | Positive finding | None | — | Verified | — |
| F23 | Visual assets | — | No | 11/11 airports and 24/24 destinations have real, genuinely distinct (not duplicated) WebP images matching every data-model slug | File-count + md5 uniqueness check + slug cross-reference tonight | `public/images/{airports,destinations}/` | Positive finding, both claims verified true | None | — | Verified | — |
| F24 | Visual assets | P3 | No | The Route Atlas — now genuinely live and public — has no entry anywhere in `docs/visual-identity.md`'s asset catalogue | Doc read + grep | `docs/visual-identity.md` | Documentation gap, not a customer problem | Add an entry | S | Open | Manual doc review |
| F25 | Performance | — | No | `tsc --noEmit`, lint, full Vitest suite (549/549), and production build (103 pages) all pass cleanly on the audited commit | Exact commands run tonight, see Verification Appendix | whole repo | Positive finding | None | — | Verified | — |
| F26 | Performance | P3 | No | No Core Web Vitals / Lighthouse data obtained | No tooling available in this environment | site-wide | Unknown real-world performance | Run Lighthouse/PageSpeed Insights manually | S | **Unverified** | Manual Lighthouse run |
| F27 | Accessibility | P3 | No | No automated WCAG scan performed | No axe-core/Lighthouse available | site-wide | Unknown compliance level | Run axe DevTools or Lighthouse a11y pass manually | S | **Unverified** | Manual scan |
| F28 | Accessibility | — | No | Code-level good practice observed: `aria-live` on all 3 form status regions, `focus-visible` outline classes, proper label/id pairing | Source read across all 3 forms tonight | `components/sections/*-form.tsx` | Positive but partial finding | None required to confirm this specific pattern | — | Verified (pattern only) | — |
| F29 | Content | — | No | Zero fabricated statistics, prices, or invented urgency found anywhere touched during this audit | Cross-referenced `data/fare-observations.ts`, route copy, `README.md`'s own "No fabricated content" claims | site-wide | Positive finding, core trust claim holds up | None | — | Verified (sampled) | — |
| F30 | Content | — | No | Route pages honestly present "verification pending" / fail-closed states for 3 disputed routes rather than guessing | `ROUTE_COVERAGE.md` + live spot-check | 3 named routes | Positive finding | None | — | Verified | — |
| F31 | Analytics | P2 | No | Cannot confirm the founder currently has visibility into visits, conversions, or link failures | No dashboard access during this audit | Vercel Analytics, Resend, Brevo | Founder may be operating blind on real usage | Confirm dashboards are actively checked | S | **Unverified** | Founder confirmation |
| F32 | Launch ops | P3 | No | No documented rollback procedure found in the repository | `README.md`/`CLAUDE.md` review — deployment process documented, rollback is not | whole repo | Real gap for incident response | Document a rollback procedure (Vercel supports instant rollback to a prior deployment) | XS | Open | Doc exists |
| F33 | Quote-request feature | — | No | An unmerged branch (`quote-trip-type-redesign`) proposes a trip-type UI change, but the live site already has a full 8-option trip-type picker | Live test tonight showed working `TripTypePicker`; branch diff reviewed | `components/sections/quote-request-form.tsx` | Likely already superseded via a different integration path — low risk, but worth a founder sanity-check before assuming safe to delete | Confirm live behaviour matches intent, then delete branch | XS | Open | Founder confirmation |

---

## 6. WHAT IS GENUINELY COMPLETE

Governance, implementation and operational content are kept separate below — an item is only called "complete" outright when all three are true.

| Item | Governance | Implementation | Operational content | Verdict |
|---|---|---|---|---|
| Contact form | ✅ (README, CLAUDE.md) | ✅ verified live | ✅ Resend delivery confirmed tonight | **Genuinely complete** |
| Quote Request form | ✅ | ✅ verified live | ✅ Resend delivery confirmed tonight | **Genuinely complete** |
| Newsletter signup | ✅ | ✅ verified live (post-fix) | ✅ Brevo contact/list/attributes confirmed tonight | **Genuinely complete** |
| Airport photography | ✅ (`docs/visual-identity.md`) | ✅ | ✅ 11/11 real, distinct files verified | **Genuinely complete** |
| Destination photography | ✅ | ✅ | ✅ 24/24 real, distinct files verified | **Genuinely complete** |
| Founder route protection | ✅ (`COMPLETED.md` `FOUNDER-001`) | ✅ | ✅ Confirmed 404 live + build output | **Genuinely complete** |
| Route Status V1 | ✅ | ✅ (code read, tests pass) | Partial — depends on ongoing re-verification cadence | **Implementation complete; content requires ongoing maintenance, not a one-time state** |
| Fare observation **methodology** | ✅ genuinely rigorous | ✅ (schema supports it, code reads correctly) | ❌ Only 5 entries follow it | **Governance and implementation complete; operational content is early — do not describe as "complete fare intelligence"** |
| Travel Ready Check | ✅ | ✅ verified live | ✅ real GOV.UK-sourced content, freshness dates present | **Genuinely complete** |
| TravelUp affiliate integration | ✅ | ✅ | ✅ spot-verified live, correct destinations | **Genuinely complete** (single-provider, not multi-provider) |
| Privacy Policy / Affiliate Disclosure | ✅ | ✅ | ✅ genuine content, not boilerplate | **Genuinely complete** |

---

## 7. WHAT EXISTS BUT IS NOT READY

- **Second affiliate providers (Skyscanner, Expedia, etc.)** — code architecture supports adding them (`BOOKING_PROVIDERS` record), but Skyscanner is explicitly `enabled: false` (declined the application) and no other provider has a real tracking link. This is a documented, deliberate state, not an oversight.
- **`quote-trip-type-redesign` branch** — a real, unmerged commit proposing trip-type UI changes; the live site already appears to have an equivalent working feature via a different integration path. Needs a founder sanity-check, not urgent engineering work.
- **`feature/arrive-by-spec` branch's 1 unique commit** — content (`ARRIVE_BY_SPEC.md`) already exists in `main`; this branch is very likely superseded, not missing work, but wasn't byte-for-byte diffed to confirm.
- **Old pull-brief homepage hero (5 files, 1,471 lines)** — fully built, fully dead, zero live imports. Not "in progress," genuinely finished-then-abandoned when the Atlas replaced it.
- **Local-only branches in dedicated worktrees** (`fix/trust-cracks-july`, `fix/verification-pending-leakage`) — real, seemingly-complete work that was never pushed to GitHub. Needs founder review before assuming it's safe to discard.
- **Community notes** — `data/community-notes.ts` ships empty on purpose (no submission pipeline exists); the UI already renders an honest "not yet" state rather than pretending otherwise. This is correct, documented behaviour, not a bug.
- **Hotels, Car Hire, Airport Lounges, Airport Parking** — explicitly, deliberately not built (see `README.md`'s own "Deliberate scope decisions" section). Correctly not promoted anywhere on the live site.

---

## 8. WHAT CAN WAIT UNTIL AFTER LAUNCH

- **The 3 explicitly unresolved PIA routes** (Manchester–Karachi, Birmingham–Lahore, Birmingham–Islamabad) — already handled honestly (fail-closed, no guessed claim). Waiting for better evidence is the *correct* behaviour, not a gap to rush.
- **Dead pull-brief code cleanup (B9/F06)** — zero customer impact. Delete whenever convenient.
- **Branch/worktree hygiene (B8/F03–F05)** — real but not urgent; nothing is actively breaking because of it, it's a "before this gets worse" item, not a "before launch" item.
- **404 page title (B10/F21)** — cosmetic.
- **Rollback procedure documentation (F32)** — Vercel's built-in rollback already works technically; documenting the *process* can happen alongside normal operations.
- **Expanding Cookie Policy detail (F15)** — current 2-sentence coverage is honest and accurate for what the site actually does (Vercel Analytics, no cross-site tracking); expand if/when the tracking footprint grows, not before.
- **Accessibility and performance tooling gaps (F26/F27)** — these are audit *coverage* gaps, not confirmed defects. Worth closing with a real Lighthouse/axe pass soon, but nothing found tonight suggests an active problem serious enough to block organic sharing.
- **Community-notes submission pipeline** — explicitly deferred in `README.md`'s own roadmap; the current empty, honest state is correct for now.

---

## 9. MINIMUM LAUNCH PLAN

### A. Safe organic launch
*(This state is essentially already reached — the list below is what to check off to be fully confident, not a long remaining build.)*

1. Founder: read this report and confirm no disagreement with the evidence.
2. Reconcile `STATUS.md`/`ROADMAP.md`/`COMPLETED.md`/`DECISIONS.md` per section 12 (documentation only, no code risk).
3. Review the 5 non-`main` worktrees (section 5, F03/F04) and either push+merge or explicitly discard each.
4. Confirm the Madinah deep link (B6) — quick, isolated fix.
5. Ship it. Organic sharing, community posts, and continued Google indexing are safe today independent of items 2–4 above — those are hygiene, not blockers.

### B. Paid advertising readiness
*(Do not mix with A — these are the genuinely necessary items before spending money on traffic.)*

1. Confirm analytics visibility (B2/F31) — founder must be able to see real conversion/click data before paying to acquire more of it.
2. Add a Terms & Conditions page, professionally reviewed (B3/F14).
3. Add the missing security headers (B4/F17).
4. Research and apply a safe `npm audit` fix path — not the suggested `--force` downgrade (B5/F18).
5. Grow the fare observation archive meaningfully beyond 11/27 routes — at minimum, the full Tier A + Tier B set in `ROUTE_COVERAGE.md` should have current-methodology observations before the "verified corridor intelligence" positioning is used in ad copy (B1/F07).
6. Run a real Lighthouse/Core Web Vitals pass and fix anything genuinely broken, not everything imperfect (F26).
7. Run a real accessibility scan (axe DevTools or Lighthouse) and fix genuine WCAG failures (F27).

---

## 10. FIX ORDER

Numbered by the brief's own priority scheme; items marked **[parallel]** can happen alongside the item above them without dependency.

1. **Security/privacy:** B4 (security headers) **[parallel with]** B5 (dependency audit, research phase only)
2. **Truth and trust:** B7 (tracker reconciliation) **[parallel with]** B3 (Terms & Conditions drafting)
3. **Broken journeys:** none found — nothing in this tier
4. **Commercial reliability:** B6 (Madinah deep link) **[parallel with]** B2 (confirm analytics visibility)
5. **Mobile/accessibility:** F26/F27 (Lighthouse + axe passes — schedule, don't block on)
6. **Visual credibility:** F24 (Atlas visual-identity doc entry) **[parallel with everything above]**
7. **Conversion:** B1/F07 (grow fare archive — ongoing, starts immediately, never "blocks" in the traditional sense)
8. **Enhancements:** B9 (dead code cleanup), B8 (branch/worktree hygiene), B10 (404 title) — all **[parallel]**, all low-risk, do whenever convenient

---

## 11. ESTIMATED WORKLOAD

- **P0 issues found:** 0
- **P1 issues found:** 1 (B2 — analytics visibility, blocking for paid promotion only)
- **P2 issues found:** 8 (B1, B3, B4, B5, B7, B8, and their register equivalents F14/F17/F18/F31 etc. — several blockers map to more than one register row)
- **P3/P4 issues found:** remainder (dead code, branch hygiene detail, 404 title, cookie policy depth, etc.)
- **Likely focused working sessions needed:** roughly 4–6 to close everything in the Paid Advertising Readiness plan (section 9B), assuming legal review for the Terms page happens in parallel rather than blocking engineering time. The Safe Organic Launch plan (section 9A) is closer to 1 session, mostly documentation and a worktree review conversation.
- **What could cause unexpected delay:** the `npm audit` fix (B5) is the single item most likely to take longer than estimated — it genuinely requires researching what Next.js version actually resolves the PostCSS/sharp advisories without the breaking downgrade `npm audit fix --force` proposes, and no such version was confirmed to exist as of this audit. Do not schedule this against a hard deadline.

---

## 12. TRACKER RECONCILIATION RECOMMENDATIONS

*Not applied. Exact proposed changes only.*

### `STATUS.md`
- Add a new "Current truth" bullet: *"The Route Atlas replaced the Manchester-to-Mumbai pull-brief hero as the public homepage (merged via the homepage-route-atlas integration). The pull-brief hero, its flagship-status-copy adapter and related components remain in the codebase but are no longer reachable from any live route."*
- Remove or correct the existing line "The Manchester-to-Mumbai homepage visual is shipped and live" — it is no longer accurate.
- Add a bullet documenting the newsletter error-message fix and the fresh Contact/Quote Request/Newsletter/Brevo/Resend operational verification completed 29 July 2026, replacing the stale 24 July `OPS-001` reference as the most current evidence.
- Add the Madinah deep-link gap to "Known risks."

### `ROADMAP.md`
- Add a new completed-adjacent line noting the Atlas shipped and is the current homepage — cross-reference to `COMPLETED.md`.
- Reconsider the "Journey Brief — Expand from a route guide into a trusted briefing" entry under Product-development roadmap: this describes continued investment in components (`pull-brief.tsx` et al.) that are currently dead code. Either explicitly redirect this ambition toward the Atlas, or mark the old Journey Brief line as superseded.

### `COMPLETED.md`
- Add new entries for: the Route Atlas homepage integration, the Gulf/Iberia crowding fix, the mobile Atlas visibility fix, the Journey Check Form addition, the "JetStash Difference" homepage section, and the newsletter error-message fix — each with its real PR number and merge commit, matching this file's own existing evidence format.
- Consider a note on `OPS-001` acknowledging the 29 July re-verification found and fixed one real defect the 24 July pass had missed, rather than leaving the original claim standing unqualified.

### Launch checklist
- No dedicated launch checklist file currently exists in the repository (`README.md` explicitly says current status belongs in `docs/project-control/`, not an accumulating checklist). Recommend this audit document itself becomes the checklist of record until superseded by a follow-up audit, rather than creating a parallel, competing document.

---

## 13. VERIFICATION APPENDIX

**Branch/commit audited:** `audit/launch-readiness-2026-07-29`, created fresh from `origin/main` at commit `8b1de036a51e3ec41f03a832ed89327f99428052` ("Merge pull request #35 from faiz403/fix/newsletter-error-message"). No other branch was modified during this audit.

**Repository path used:** `C:\Users\faiz2\jetstash-new`. Note: the path initially implied by prior context (`C:\Users\faiz2\OneDrive\Documents\jetstash-new`) was found to be a stale clone, ~90 commits behind `origin/main` with an unpushed local commit — see F04. This audit used the repository confirmed to match `origin/main` exactly.

**Production deployment audited:** `https://jetstash.co.uk`, confirmed serving from Vercel region `lhr1`, response headers captured 29 July 2026 ~13:00–16:30 GMT.

**Commands run (exact):**
```
npx tsc --noEmit        → exit 0, no output
npm run lint             → "✔ No ESLint warnings or errors"
npm test -- --run        → 28 test files, 549 tests, all passed
npm run build             → succeeded, 103 static/dynamic pages generated
npm audit --omit=dev     → 3 high severity vulnerabilities (PostCSS, sharp — transitive via next)
```

**Tests and results:** 549/549 Vitest tests passed across 28 files. Full production build succeeded with one non-blocking warning (edge runtime disabling static generation on OG-image routes — expected behaviour for `ImageResponse`-based routes, not investigated further as a defect).

**Browser/device widths checked this session:** 375px (mobile) directly, and default desktop viewport. The full requested set (320/375/390/768/1024/1440) was **not** exhaustively tested — see F26/F27 and category 13 scorecard note.

**Pages inspected live tonight (with method):**
- `/` (homepage) — console check, network request check, metadata check
- `/contact` — full form test: empty submit, invalid email, valid submission, duplicate submission, real error path
- `/quote-request` — full form test: empty submit, invalid email, valid submission, server-side validation probe
- `/travel-club` — newsletter form: invalid email, valid signup, duplicate signup, server-side validation probe, post-fix error message re-verification
- `/travel-ready-check` — live scenario test (Pakistan destination, British passport, valid dates) — real GOV.UK-sourced result confirmed
- `/routes`, `/destinations`, `/airports` — console-error check only
- `/routes/manchester-madinah`, `/routes/manchester-lahore` — affiliate link href inspection
- `kqzyfj.com` deep links for Lahore, Mumbai, Doha — followed live, confirmed correct destination pages
- `/founder/atlas-feel-test`, `/founder/homepage-v2`, `/founder/journey-brief/manchester-mumbai` — confirmed HTTP 404
- A deliberately non-existent URL — confirmed genuine HTTP 404 with functional, on-brand not-found page
- `/sitemap.xml`, `/robots.txt` — content inspected directly

**External dashboards checked (by the founder, reported to me, incorporated as evidence):**
- Brevo: contact creation, list membership, attribute values, and confirmed absence of any welcome-email automation — checked by the founder 29 July 2026, reported in this same session
- Resend: 14 emails sent in 15 days, 100% deliverability, 0 bounces/complaints, both test emails confirmed delivered to the receiving mail server — checked by the founder 29 July 2026, reported in this same session

**Limitations — explicitly unverified, and exactly what access/tooling would close each gap:**
- **Core Web Vitals / Lighthouse:** no Lighthouse CLI or equivalent tooling available in this environment. Closing this requires running Lighthouse or PageSpeed Insights directly against the production URL.
- **Automated accessibility scan (WCAG):** no axe-core or Lighthouse accessibility tooling available. Closing this requires a manual axe DevTools or Lighthouse a11y run, plus ideally a manual screen-reader pass.
- **Google Search Console:** no dashboard access. Closing this requires the founder to share current Search Console status (indexed pages, coverage errors, any accidental founder-route indexing history predating tonight's 404 confirmation).
- **Vercel Analytics dashboard / actual event data:** no dashboard access. Closing this requires the founder to confirm what `track()` events exist and whether they show real data.
- **Full breakpoint matrix (320/390/768/1024/1440px):** only 375px and default desktop were tested this session. Closing this requires either more tool-assisted browser sessions or manual founder spot-checks at each width.
- **Exhaustive per-page content proofreading:** not performed across all 27 route pages, 24 destination pages, 11 airport pages and 9 guides. Spot-checked only (via data-file reads and the pages directly touched during journey testing).
- **The 10 of 13 `VERIFIED_DEEP_LINKS` entries not individually re-tested tonight** (Islamabad, Karachi, Delhi, Ahmedabad, Amritsar, Dubai, Jeddah, Istanbul, Marrakech, Abu Dhabi-inert): code-verified as documented and structurally correct, but not freshly re-clicked live this session. Given 3/3 tested resolved correctly, this is a reasonable but not certain basis for confidence in the rest.
- **`quote-trip-type-redesign` and `feature/arrive-by-spec` branches:** reviewed via `git log`/`git diff --stat` only, not byte-for-byte content diffed against what's live. Founder confirmation recommended before deleting either.

---

## 14. FOUNDER RECONCILIATION ADDENDUM (accepted 29 July 2026)

This section records the founder's review of the draft above and the follow-up verification it triggered. It supersedes nothing in sections 1–13; it adds evidence gathered afterward and confirms which facts are now locked.

### 14.1 Confirmed facts — not to be reopened as uncertain

The founder confirmed, and this audit's own section 6 already recorded as "Genuinely complete," that:

1. The Route Atlas is complete, interactive and live on the public homepage.
2. Intended airport and destination imagery is complete and live.
3. Contact, Quote Request and Newsletter delivery all work, independently tested by Codex and by the founder's own Resend/Brevo dashboard checks.

No category score or finding in sections 3–5 was ever predicated on doubting these three — the 7/10 Homepage and Visual Identity scores reflect unrelated gaps (missing conversion data, a missing documentation-catalogue entry), not doubt about whether the Atlas or the imagery exist. No scores change as a result of this confirmation.

### 14.2 The single P1, isolated

**B2 / F31 — the founder cannot currently confirm the commercial funnel is instrumented and watched.** This is a *conditional* P1: it blocks paid advertising only, not organic or community launch. A visitor's experience is unaffected either way; the risk is spending money to acquire traffic without being able to see whether it converts.

### 14.3 Branch/worktree reconciliation — verified after the draft was written

Both local-only branches originally flagged in B8/F03 were checked directly against `origin/main` (read-only `git diff`/`git log`, no changes made):

- **`fix/verification-pending-leakage`** — diff against `origin/main` is empty; its content is already fully merged (present in 19+ other branches). Safe to delete, nothing stranded.
- **`fix/trust-cracks-july`** — has one genuine unmerged commit (`046befe`) touching 6 files: a duplicated page-title suffix, a destination-page copy hedge, and a wrong-airport flight-time fallback bug in `deal-card.tsx`. All three were checked individually against current `origin/main` content and are **already fixed independently**, via later commits (title suffixes are clean on all four affected pages; the destination page's hedge copy is already present, in stronger wording; `deal-card.tsx`'s fallback was removed entirely, which is stricter than this branch's fix).

**Conclusion: no required production fix is stranded outside `main` in either branch.** Both are safe to delete once the founder no longer wants them for reference.

### 14.4 PR-level evidence for the tracker gap (section 12/B7)

Direct `git log --merges` inspection of `origin/main` since the last tracker reconciliation (PR #24, `docs/roadmap-reconciliation-july`) found 11 further merged PRs with zero corresponding entries in `COMPLETED.md`:

| PR | Merge commit | What it shipped | Tracker entry before this reconciliation |
|---|---|---|---|
| #25 `feat/airport-visual-system` | `e234273` | Completed the UK airport visual collection (10 remaining airport WebP files) — `ROADMAP.md`'s `VIS-001` already marked `COMPLETE` and `STATUS.md` already updated by this PR itself, but no `COMPLETED.md` ledger row exists | Missing |
| #26 `docs/arrive-by-spec` | `2a70241` | Added the complete `ARRIVE_BY_SPEC.md` evidence-gated specification | Missing |
| #27 `feature/homepage-route-atlas` | `f1387b4` | The Route Atlas itself — replaced the pull-brief hero on the public homepage (`journey-desk-home.tsx`), added `atlas-network-data.ts`, `atlas-country-geometry.ts`, `network-evidence.ts` | Missing |
| #28 `fix/mobile-route-atlas-2` | `136f670` | Mobile Atlas visibility fixes | Missing |
| #29 + #30 `fix/gulf-cluster-halo-crowding` | `3b2490a`, `25115b3` | Gulf/Iberia country-halo crowding fix | Missing |
| #31 `feat/hero-visual-collection` | `f004148` | Added 10 new page-hero WebP images (about, airports, business-class, contact, deals, family-holidays, guides, quote-request, routes, travel-club) — **newly confirmed this session**: `grep` confirms these are genuinely wired through `getHeroBackdrop`/`HeroBackdrop` in the corresponding page components, not orphaned files | Missing |
| #32 `feat/journey-check-form` | `7919090` | The Journey Check Form fast-path | Missing |
| #33 `feat/homepage-why-jetstash` | `5523f0f` | The "JetStash Difference" homepage section | Missing |
| #34 `fix/mobile-chip-density-and-copy` | `3c0e67e` | Mobile Atlas chip confidence-colour dots; removed the redundant Journey Check Form heading | Missing |
| #35 `fix/newsletter-error-message` | `8b1de03` | Newsletter form now surfaces the real API error instead of a generic message | Missing |

One correction to this audit's own section 14.1-adjacent framing: PR #31 (hero visual collection) was not identified anywhere in the original draft (sections 1–13) — it was found only during this reconciliation pass. It is a genuinely positive, previously-unrecorded finding, confirmed wired into live pages, not yet visually spot-checked render-by-render. Treat as "implementation confirmed via code, visual rendering unverified" rather than fully verified.

This table is the evidence basis for the `COMPLETED.md` entries added in this same PR.

