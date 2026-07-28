# Visual Review Checklist

A reusable checklist for reviewing any visual asset on JetStash — a photograph, an interactive
system, or a proposed replacement for either. Governed by `docs/visual-identity.md`, specifically
Design Decision DD-003: **a visual asset is evaluated by whether it fulfils its documented
responsibility before its aesthetic quality is discussed at all.**

Work through the sections in order. Do not skip to "Visual quality" first — if an asset fails
Responsibility or Trust, its aesthetic score doesn't matter yet.

## 1. Responsibility

- [ ] Does this asset have a documented purpose in `docs/visual-identity.md` Part IV? If not,
      that's the first gap to close — not the image itself.
- [ ] Does it actually fulfil that documented purpose, or does it do a different job than the one
      written down?
- [ ] If it's an interactive system, does it satisfy Part III's "Responsibility" principle —
      would the user understand less if this motion or transition were removed?

## 2. Consistency

- [ ] Does it belong to the correct visual discipline — Part II (Editorial Photography) or
      Part III (Interactive Visual Systems)? Photography rules and interactive-system rules are
      not interchangeable (DD-004).
- [ ] Does it follow JetStash's established visual language — Ink & Brass grade, golden hour
      (photography) or the restraint/motion principles (interactive)?
- [ ] For photography specifically: is the aircraft unbranded (DD-005)? Is a sacred/religious
      site handled per DD-006 if applicable?
- [ ] Does its Lifecycle Status in Part IV match reality — is it actually In Production, or is it
      quietly running on the generated fallback (Placeholder) while claiming otherwise?

## 3. Trust

- [ ] Does it honestly represent the product and the journey — no fabricated scale, no implied
      confirmation of something unverified?
- [ ] Does it avoid exaggeration or manufactured urgency?
- [ ] If it represents live or ledger-backed data (Route Status, fares, readiness checks), does
      it visibly distinguish verified data from illustrative graphics, and never imply more
      certainty than the underlying data actually carries?

## 4. Technical quality

- [ ] **Accessibility**: legible without fine colour distinction; usable with reduced motion;
      keyboard-reachable if interactive; visible focus states; adequate contrast.
- [ ] **Performance**: no unnecessary layout shift; animation driven efficiently (not forcing a
      re-render per frame where a ref/imperative update would do); reasonable cost on a
      mid-range mobile device.
- [ ] **Responsiveness**: mobile-safe composition — for photography, is the landmark/aircraft
      inside the central 60% so a portrait crop doesn't lose the story? For interactive systems,
      does the mobile layout preserve the same information hierarchy as desktop?
- [ ] **Implementation quality**: does the code path match what's documented (correct manifest
      key, correct fallback behaviour, no silent divergence between brief and build)?

## 5. Visual quality and aesthetics

Only reach this section once 1–4 are satisfied.

- [ ] First impression
- [ ] Premium feel
- [ ] Emotional impact
- [ ] Cinematic or interaction quality
- [ ] Long-term durability as a benchmark, if this asset is meant to set a pattern for others

An asset that scores well here but poorly in sections 1–3 is not ready — fix the responsibility
or trust problem first. An asset that scores modestly here but passes 1–4 cleanly may still be
shippable; aesthetic refinement is the last mile, not the gate.
