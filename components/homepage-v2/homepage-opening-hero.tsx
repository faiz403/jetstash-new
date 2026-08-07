import { PageHero } from '@/components/sections/page-hero';
import { LinkButton } from '@/components/ui/button';
import { routes } from '@/data/routes';
import { getPublishableObservationsByRoute } from '@/data/fare-observations';

/**
 * The homepage's opening hero — added above the Route Atlas so a new
 * visitor knows what JetStash is, why it's different, and what to do next
 * before being asked to read a map. Raised from a real mobile review
 * (Samsung Galaxy Z Fold 7): the Atlas alone doesn't explain itself on
 * arrival. The Atlas remains the homepage's signature feature immediately
 * below, unchanged — this is a compact, single PageHero (the same shared
 * component every secondary page already uses, in `size="compact"`), not a
 * second full-screen block.
 *
 * First-screen restructuring (August 2026, founder-reviewed homepage
 * review): the Atlas — the actual "wow" feature — sits directly below this
 * hero in the DOM (journey-desk-home.tsx) and always has; the measured
 * problem was never section ordering, it was that this hero's own content
 * (three proof-point chips plus a closing line, on top of the eyebrow/
 * title/description/CTAs/trust-line stack) consumed nearly a full mobile
 * viewport (781 of 812px measured) before the Atlas heading could appear at
 * all. The three proof points were also a near-duplicate, differently-worded
 * restatement of WhyJetStash's own three DIFFERENCE_POINTS, which renders
 * immediately after the Atlas — saying the same thing in two different
 * three-word sets before a visitor ever reaches the product reads as a
 * manifesto, not a tool. Removed the proof-point chip row and the closing
 * "When the journey is clear..." line entirely (WhyJetStash is now the one
 * place that explanation lives); kept eyebrow, title, description, both
 * CTAs and the trust line. Added a single live-computed stat via PageHero's
 * own `stats` prop instead — the "smaller proof section" the review asked
 * for, never a hardcoded figure that could drift (see PageHero's own doc
 * comment and CLAUDE.md "No invented stats").
 */

// Short-viewport-only tightening (e.g. 320x720): reduces PageHero's own section
// padding and both CTA buttons down to the existing "md" size tokens, freeing enough
// height for the trust line to sit fully inside the initial viewport. 800px sits
// between the 720px case this targets and the 844px+ heights of every other tested
// mobile width, so it doesn't touch anything but the shortest viewport. Headline,
// body copy and CTA wording are untouched — only spacing shrinks.
//
// Written as full literal class strings, not built from a shared constant via
// template-literal interpolation — Tailwind's JIT scanner does static text
// extraction from source files and can't see a class name assembled at runtime,
// so an interpolated `${VAR}:py-8` silently never generates any CSS at all.
const SHORT_VIEWPORT_HERO_PADDING = '[@media(max-height:800px)]:py-8';
const SHORT_VIEWPORT_BUTTON = '[@media(max-height:800px)]:h-11 [@media(max-height:800px)]:px-5 [@media(max-height:800px)]:text-[15px]';

export function HomepageOpeningHero() {
  // Live-computed, same function and phrasing convention as /deals's own
  // hero stat — never a hand-typed figure that could silently drift from
  // what's actually tracked.
  const nowIsoForCoverage = new Date().toISOString().slice(0, 10);
  const routesWithTrackedFare = routes.filter((r) => getPublishableObservationsByRoute(r.slug, nowIsoForCoverage).length > 0).length;

  return (
    <PageHero
      eyebrow="Before you book a flight"
      title="Check the whole journey before you book."
      description="Choose your UK airport and destination. JetStash shows which routes are operating, what has changed, what travel requirements apply and when the information was last checked."
      heroKey="routes"
      size="compact"
      className={SHORT_VIEWPORT_HERO_PADDING}
      stats={[{ value: `${routesWithTrackedFare} of ${routes.length}`, label: 'UK routes with tracked fares' }]}
    >
      <div className="flex flex-wrap items-center gap-3">
        <LinkButton href="#your-journey" variant="primary" size="lg" className={SHORT_VIEWPORT_BUTTON}>
          Check a journey
        </LinkButton>
        <LinkButton href="#route-atlas" variant="outline" size="lg" className={SHORT_VIEWPORT_BUTTON}>
          Explore the Route Atlas
        </LinkButton>
      </div>
      {/* text-ink-300, not the site's usual ink-400 for this kind of small print — still
          visually secondary, but ink-400 was too low-contrast over the dimmed photo on
          both mobile and desktop. ink-300 matches PageHero's own description text, already
          proven readable over this exact HeroBackdrop treatment elsewhere on the site.
          Mobile-only bump (base classes, overridden at sm:): a real trust statement
          reading as slightly too small/faint on a phone. One modest step up in both
          size and contrast — text-sm/ink-200, not bold or a bigger jump — reverting
          to the exact proven desktop treatment at sm: and up. Wording unchanged. */}
      <p className="mt-3 text-sm text-ink-200 sm:text-xs sm:text-ink-300">
        Checked against airline and official sources. Booking links come last.
      </p>
    </PageHero>
  );
}
