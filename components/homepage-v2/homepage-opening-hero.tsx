import { SearchCheck, FileCheck2, Receipt } from 'lucide-react';
import { PageHero } from '@/components/sections/page-hero';
import { LinkButton } from '@/components/ui/button';

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
 * Icons deliberately reuse WhyJetStash's and WhatWeCheck's own vocabulary
 * (SearchCheck for "route first", FileCheck2 for the travel-ready check,
 * Receipt for dated fares) rather than inventing new ones. The three proof
 * points render as a compact chip row — the same pill idiom the Atlas's own
 * airport selector uses — specifically to stay short enough for a narrow
 * phone screen, and to read as a quick orientation strip rather than a
 * restatement of WhyJetStash's fuller "JetStash difference" section further
 * down the page.
 */
const PROOF_POINTS = [
  { icon: SearchCheck, label: 'Route first' },
  { icon: FileCheck2, label: 'Travel ready' },
  { icon: Receipt, label: 'Price with context' },
] as const;

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
  return (
    <PageHero
      eyebrow="Before you book a flight"
      title="Check the whole journey before you book."
      description="Choose your UK airport and destination. JetStash shows which routes are operating, what has changed, what travel requirements apply and when the information was last checked."
      heroKey="routes"
      size="compact"
      className={SHORT_VIEWPORT_HERO_PADDING}
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
          proven readable over this exact HeroBackdrop treatment elsewhere on the site. */}
      <p className="mt-3 text-xs text-ink-300">Checked against airline and official sources. Booking links come last.</p>

      <div className="mt-6 flex flex-wrap gap-2 border-t border-white/10 pt-6" role="list" aria-label="Why JetStash is different">
        {PROOF_POINTS.map(({ icon: Icon, label }) => (
          <span
            key={label}
            role="listitem"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-sand-100"
          >
            <Icon className="h-3.5 w-3.5 text-brass-300" strokeWidth={2} aria-hidden="true" />
            {label}
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs text-ink-300">When the journey is clear, JetStash points you to a booking partner.</p>
    </PageHero>
  );
}
