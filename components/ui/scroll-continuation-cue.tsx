/**
 * A restrained "there's more below" cue for pages that open with one
 * self-contained section (hero + About-style block) before their most
 * useful content — fares, tips, destination facts — actually starts.
 * Deliberately not a button, not sticky, not animated: matches the same
 * "one small, quiet line" treatment as the existing route-page continuation
 * cue (`app/routes/[slug]/page.tsx`'s "More JetStash intelligence below…"),
 * just restyled for a white section background instead of a dark hero.
 *
 * Callers are responsible for only rendering this where real content
 * genuinely follows — this component has no way to know that itself.
 */
export function ScrollContinuationCue() {
  return (
    <p
      data-testid="scroll-continuation-cue"
      className="mt-10 border-t border-ink-100 pt-5 text-center text-xs leading-relaxed text-ink-400"
    >
      Scroll down for more destination information ↓
    </p>
  );
}
