# JetStash Legal & Commercial Disclosure — Professional Review Pack

**Prepared:** 8 August 2026. **Purpose:** consolidate everything a qualified professional needs to
review and decide on, in one place, so that review is efficient rather than a scavenger hunt across
the repository. **This document is not legal advice, does not publish anything, and does not decide
anything on this repository's own authority** — every open item below is listed precisely so a human
can decide it, never guessed or filled in here. See `docs/project-control/LAUNCH_CHECKLIST.md` item
**B2** for the formal tracker this pack exists to unblock — no separate checklist ID was created for
this work, since B2 already names this exact scope (confirmed trading/legal identity, confirmed
operator/contact details, professional legal review, and an explicit publish decision); duplicating
it under a new ID would only fragment tracking.

---

## 1. What already exists

### Live and published today
- **Privacy Policy** (`/privacy-policy`, `app/privacy-policy/page.tsx`) — live, last updated 31 July
  2026. Substantially complete: covers what's collected per form/product, what's deliberately not
  collected, legal basis per purpose, sub-processors named (Vercel, Resend, Brevo, a Microsoft 365
  mailbox via GoDaddy), individual rights, ICO complaint routing, and a "no cookies" statement. It
  also self-flags its own open items in plain text (see §3).
- **Affiliate Disclosure** (`/affiliate-disclosure`, `app/affiliate-disclosure/page.tsx`) — live.
  Five short sections: how JetStash is funded, that commission never changes the visitor's price or
  what's recommended, that prices are indicative, and a contact route for questions. Written in
  general terms — no specific partner is named on this page itself (Trip.com is named only in the
  Privacy Policy's "other websites you link to" section and in the Terms draft).

### Repository-only, not published
- **Terms & Conditions** (`docs/legal/TERMS_DRAFT.md`) — explicitly marked as a working draft, not
  linked, served, or presented as binding on jetstash.co.uk, and no `/terms` route exists (confirmed:
  not present in `lib/site-config.ts`'s `footerNav`, not linked from any page). The draft already
  contains its own detailed, self-maintained "Unresolved information" section (§3 below is compiled
  directly from it, cross-checked against the current live pages) and a substantive 9-section body
  covering what JetStash is/isn't, accuracy of information, Travel Ready Check's advisory status,
  acceptable use, IP, liability (explicitly marked "not approved language"), and governing
  law/contact (both explicitly unresolved).

---

## 2. Where affiliate/commission notices actually appear today

Audited directly against the current code, not assumed:

- **Sitewide footer** (`components/layout/footer.tsx`, every page): an explicit statement — "JetStash
  earns a commission on some bookings made through partner links. This never affects the price you
  pay." — linking to `/affiliate-disclosure`.
- **`/about` page**: also links to `/affiliate-disclosure`.
- **Individual Trip.com click-through points** — three call sites render a "Compare flights on
  Trip.com" button (`components/ui/deal-card.tsx`, `components/ui/no-fare-fallback.tsx`, and the
  route-guide hero in `app/routes/[slug]/page.tsx`), all via the shared
  `components/ui/tracked-outbound-link.tsx`:
  - All three carry `rel="nofollow sponsored noopener noreferrer"` (`lib/booking-providers.ts`,
    `PROVIDER_REL`) — a **search-engine-facing** signal (Google's own affiliate-link convention),
    invisible to a human visitor.
  - All three carry a caption beneath the button: "Check the itinerary, baggage allowance and
    booking terms before paying." — a booking-caution note, not a commission disclosure.
  - **Only the route-guide hero variant** additionally appends "Partner link, opens Trip.com in a
    new tab." `deal-card.tsx` (used on destination, airport and region-hub pages, and `/deals`) and
    `no-fare-fallback.tsx` (shown wherever no fare has been logged yet) do **not** carry this or any
    other partner-relationship wording next to the button itself.
  - **No CTA anywhere links directly to `/affiliate-disclosure` at the point of clicking through** —
    the only human-visible, sitewide commission disclosure is the footer statement, which sits below
    the fold on every page that has a Trip.com CTA above it.

This is a factual placement audit only — not a legal opinion on whether current placement is
sufficient. UK advertising/consumer-protection practice increasingly expects a commercial
relationship to be clear "at the point of the recommendation," not solely in a footer-linked page;
whether JetStash's current placement meets that bar, and whether the `deal-card`/`no-fare-fallback`
CTAs should gain the same "Partner link" wording the route-hero already has, is listed as an open
item for review (§3) — not changed here.

---

## 3. Open decisions requiring external input

Compiled from `docs/legal/TERMS_DRAFT.md`'s own "Unresolved information" section, cross-checked
against the current live Privacy Policy and the placement audit above. None of these has been
guessed, inferred, or filled in anywhere in the repository.

1. **Trading/legal identity wording.** The Privacy Policy currently names the operator by a
   founder-approved public name only ("[public trading name], trading as JetStash" — the exact
   wording lives in `app/privacy-policy/page.tsx` and is regression-tested by
   `tests/privacy-notice-completion.test.ts`). The founder's full legal name is deliberately excluded
   from every public-facing file — enforced by a dedicated test asserting it never appears in `app`,
   `components`, `lib` or `data`. This public-safe wording appears in exactly **one** place
   (Privacy Policy) — it is not repeated on `/about`, the footer, or anywhere else. Needs a decision:
   is single-page disclosure sufficient, and is the current wording itself approved for wider use
   (e.g. in eventual published Terms)?
2. **Public contact/postal address.** None is published anywhere on the site today (confirmed: no
   match in `app/contact/page.tsx` or `components/sections/contact-form.tsx`). The Terms draft
   explicitly leaves this open rather than inventing one.
3. **Jurisdiction.** The Terms draft assumes England and Wales as a "working placeholder," not yet
   confirmed correct or sufficient by a professional.
4. **Contact email for legal notices.** Three distinct addresses are already live and referenced from
   different places: `contact@jetstash.co.uk` (`lib/site-config.ts`, the form-routing fallback),
   `hello@jetstash.co.uk` (hardcoded in the footer's "Get in touch" link), and
   `privacy@jetstash.co.uk` (Privacy Policy). The Privacy Policy states all mail to "published
   addresses" lands in one Microsoft 365 mailbox — worth confirming all three are genuinely live and
   monitored, and deciding which (if any) should be named specifically for legal notices in eventual
   Terms.
5. **Liability wording.** Terms draft §7 is explicitly marked "not approved language" — needs review
   against JetStash's actual insurance position (if any) and current UK consumer-protection law.
6. **ATOL/ABTA phrasing.** Terms draft §2 states JetStash holds neither because it doesn't sell
   flights or package holidays itself — the precise regulatory-safe phrasing for this disclaimer
   needs professional confirmation, not assumption.
7. **Consumer Rights Act 2015 / Consumer Contracts Regulations applicability.** Not yet assessed.
8. **Retention periods.** The Privacy Policy explicitly states: "Setting exact retention periods for
   each type of data is still on our to-do list and needs a formal decision." No specific period is
   invented anywhere (regression-tested — `tests/privacy-notice-completion.test.ts` asserts no
   specific day/month/year figure appears).
9. **International-transfer mechanism.** The Privacy Policy states JetStash "takes reasonable and
   proportionate steps" and "relies on the contractual and legal safeguards available for the
   relevant processing" for Vercel/Resend/Brevo/Microsoft 365 — deliberately generic. No specific
   mechanism (Standard Contractual Clauses, an adequacy decision, Binding Corporate Rules) is claimed
   in place anywhere, because none has been independently assessed. This is honestly under-specified,
   not silently resolved — flagged here for that assessment to actually happen.
10. **Affiliate-disclosure wording and placement.** See §2's placement audit — specifically whether
    `deal-card.tsx`/`no-fare-fallback.tsx` should gain inline partner wording matching the route-hero,
    and whether the existing footer/`/affiliate-disclosure` wording itself is approved as final.
11. **The explicit go/no-go decision to publish Terms.** Per `LAUNCH_CHECKLIST.md` B2: do not publish
    public Terms and do not recreate a `/terms` route until items 1–7 above are resolved and a
    qualified professional has reviewed `docs/legal/TERMS_DRAFT.md` section by section.

---

## 4. Consistency findings (no code changed for any of these — recorded for the reviewer)

- **Operator identity appears in exactly one place** (Privacy Policy) — see §3 item 1.
- **Three distinct email addresses in active use** — see §3 item 4.
- **No cookie-consent mechanism exists anywhere in the codebase**, consistent with the Privacy
  Policy's "JetStash does not use cookies" claim (Vercel Web Analytics and Speed Insights are both
  cookieless) — checked directly, no inconsistency found.
- **No `/terms` route exists and none is linked** from the footer, main nav, or any page — consistent
  with B1/B2's "not published" instruction. No accidental leakage found.
- **The Affiliate Disclosure page never names Trip.com specifically** — it speaks generally of "an
  airline, travel agent or booking platform." Only the Privacy Policy and the (unpublished) Terms
  draft name Trip.com directly. Worth deciding whether the public Affiliate Disclosure page should
  name the actual current partner.

---

## 5. What this pack deliberately does not do

- Does not publish Terms, create a `/terms` route, or link one from anywhere.
- Does not invent a postal address, a retention period, a legal name, liability wording, or a
  transfer mechanism.
- Does not decide affiliate-disclosure wording or placement changes.
- Does not constitute legal advice, and is not presented as a substitute for it anywhere in this
  repository.
- Changes no code, no live page, and no published content — this is audit and organisation only.

---

## 6. Recommended reviewer checklist

For the external professional review referenced in `LAUNCH_CHECKLIST.md` B2:

- [ ] Review and approve/amend `docs/legal/TERMS_DRAFT.md` section by section
- [ ] Confirm trading/legal identity wording for public use (§3.1)
- [ ] Decide the public contact/postal-address position (§3.2)
- [ ] Confirm jurisdiction wording (§3.3)
- [ ] Decide the contact address for legal notices, and confirm all three current addresses are live
      and monitored (§3.4)
- [ ] Approve liability wording (§3.5)
- [ ] Approve ATOL/ABTA disclaimer phrasing (§3.6)
- [ ] Assess Consumer Rights Act 2015 / Consumer Contracts Regulations applicability (§3.7)
- [ ] Set retention periods per data category (§3.8)
- [ ] Confirm or assess an international-transfer mechanism (§3.9)
- [ ] Approve affiliate-disclosure wording, and decide on per-CTA placement (§3.10, §2)
- [ ] Make the explicit go/no-go decision to publish Terms and link `/terms` (§3.11)

Once every item above has a recorded decision, update `LAUNCH_CHECKLIST.md` B2 accordingly — do not
mark B2 complete on partial progress.
