import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { PageHero } from '@/components/sections/page-hero';
import { JourneyCheckForm, type JourneyCheckData } from '@/components/homepage-v2/journey-check-form';

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
 * Homepage hero integration (September 2026 — "make the hero itself the
 * product"): the actual Flying from / Going to journey finder now renders
 * inside this hero, in a premium console card sitting on the photographic
 * backdrop — reusing JourneyCheckForm exactly as it already worked (no
 * change to its selection logic, its analytics, or where a submit sends the
 * visitor), just relocated and given a proper container instead of
 * appearing in a separate plain section beneath the hero once a visitor
 * scrolled or clicked the old hero CTA button that pointed at it. That
 * standalone section (and the now-redundant button that used to scroll down
 * to it) is gone — see journey-desk-home.tsx's own doc comment. The card
 * styling itself isn't new invented brand language: it's the same
 * `rounded-lg border border-white/10 bg-ink-900/70 backdrop-blur-md` glass
 * treatment already proven on this exact dark-photo backdrop in the
 * Manchester–Mumbai Journey Brief prototype (journey-brief-hero.tsx).
 * `id="your-journey"` moves here too, so the footer's "Check my trip" link
 * and the Atlas's own "Already know where you're going?" link keep working
 * unchanged — they now scroll back up to this hero instead of to a section
 * further down the page.
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
 * place that explanation lives). Coverage counts now sit below the product
 * explanation, rather than competing with the first action in the hero.
 */

// Short-viewport-only tightening (e.g. 320x720): reduces PageHero's own section
// padding down to the existing "md" size tokens, freeing enough height for the
// journey console to sit fully inside the initial viewport. 800px sits between
// the 720px case this targets and the 844px+ heights of every other tested
// mobile width, so it doesn't touch anything but the shortest viewport.
// Headline and body copy are untouched — only spacing shrinks.
//
// Written as a full literal class string, not built from a shared constant via
// template-literal interpolation — Tailwind's JIT scanner does static text
// extraction from source files and can't see a class name assembled at runtime,
// so an interpolated `${VAR}:py-8` silently never generates any CSS at all.
const SHORT_VIEWPORT_HERO_PADDING = '[@media(max-height:800px)]:py-8';

export function HomepageOpeningHero({ journeyCheck }: { journeyCheck: JourneyCheckData }) {
  return (
    <PageHero
      eyebrow="Before you book a flight"
      // Founder copy correction (August 2026): this exact headline reads in
      // font-sans, not the site's usual Fraunces display face — a deliberate,
      // one-off typographic break so the homepage's opening line doesn't look
      // like every other page's PageHero title. Scoped to a <span> around just
      // this text, not a change to PageHero's own h1 (which keeps font-display
      // for every other page and every other heading on this one) — see
      // PageHero's own doc comment, still unchanged.
      title={<span className="font-sans">Understand your journey before you pay.</span>}
      description="Choose your UK airport and destination. See the route, what has changed and what you still need to check before booking."
      heroKey="routes"
      size="compact"
      className={SHORT_VIEWPORT_HERO_PADDING}
      // Real-user validation, Stage A (30 Aug 2026): this is the very first
      // thing every visitor sees, on every device, every time — the one
      // PageHero caller where the headline and primary CTAs must never
      // start invisible. See PageHero's own doc comment for exactly what
      // this does and doesn't change. The journey console below inherits
      // this same "visible from first paint" treatment — it's the primary
      // action now, not a separate CTA that used to defer to it.
      immediate
    >
      {/* id="your-journey": the anchor target for the footer's "Check my
          trip" link and the Atlas's own "Already know where you're going?"
          link — both point at #your-journey and previously scrolled down to
          the standalone section this console replaces.

          Mobile pull-up margin (September 2026, consent-overlay fix):
          PageHero wraps every caller's children in its own fixed `mt-7`
          (28px) — shared by 13 other pages, not something this component
          can change. That wrapper has no padding/border of its own, so its
          margin and this div's margin are adjoining and collapse per normal
          CSS rules: parent +28px against this div's -16px nets to a smaller
          real gap above the console, on mobile only (sm:mt-0 cancels it
          back to PageHero's untouched 28px at sm: and up — desktop is
          pixel-identical to before, confirmed via getComputedStyle).
          JourneyCheckForm and PageHero are both untouched.

          Deliberately a plain fixed -16px, not tied to the consent banner's
          own state or to env(safe-area-inset-bottom) (2 Sep 2026, founder
          review, reverting an earlier draft that coupled the two): this
          margin is a static CSS rule with no way to know whether the
          banner is even visible, so a safe-area-dependent version would
          have stayed pulled up by the same amount after the visitor
          dismisses it — a real latent bug, not just unneeded complexity.
          JetStash currently does not use viewport-fit=cover, so
          env(safe-area-inset-bottom) is 0 on every real device today
          anyway (see cookie-consent-banner.tsx's own comment); if that
          config is ever adopted, it needs a proper site-wide safe-area
          review, not a homepage-specific coupling landed years earlier. */}
      <div id="your-journey" className="-mt-4 max-w-2xl sm:mt-0">
        {/* Mobile-only spacing trim (September 2026, consent-overlay fix):
            only the two gaps ABOVE the form's submit button are tightened —
            the card's own top padding and the label-to-form gap — since
            those are the only spacing in this component that actually
            affects the button's vertical position; a first pass here
            mistakenly also trimmed spacing below the button (the trust
            line, the secondary CTA row), which does nothing for clearance
            and was reverted. sm: values are untouched, so desktop is
            pixel-identical to before. This exists solely to buy back
            headroom the fixed-bottom consent banner needs at 390×844 to
            clear the console without shrinking its 12px text or its 44px
            buttons — see cookie-consent-banner.tsx's own comment. No copy,
            heading, or control changed here. */}
        <div className="rounded-lg border border-white/10 bg-ink-900/70 px-5 pb-5 pt-1.5 shadow-[0_24px_70px_-24px_rgba(0,0,0,0.65)] backdrop-blur-md sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brass-200">Check your journey</p>
          <div className="mt-1 sm:mt-3">
            <JourneyCheckForm origins={journeyCheck.origins} destinations={journeyCheck.destinations} routeIndex={journeyCheck.routeIndex} />
          </div>
        </div>

        {/* text-ink-300, not the site's usual ink-400 for this kind of small print — still
            visually secondary, but ink-400 was too low-contrast over the dimmed photo on
            both mobile and desktop. ink-300 matches PageHero's own description text, already
            proven readable over this exact HeroBackdrop treatment elsewhere on the site.
            Mobile-only bump (base classes, overridden at sm:): a real trust statement
            reading as slightly too small/faint on a phone. One modest step up in both
            size and contrast — text-sm/ink-200, not bold or a bigger jump — reverting
            to the exact proven desktop treatment at sm: and up. Wording unchanged. */}
        <p className="mt-4 text-sm text-ink-200 sm:text-xs sm:text-ink-300">
          Checked against airline and official sources. Booking links come last.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link
            href="#route-atlas"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brass-300 underline decoration-brass-300/40 underline-offset-4 hover:text-brass-200"
          >
            Explore the Route Atlas
            <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </PageHero>
  );
}
