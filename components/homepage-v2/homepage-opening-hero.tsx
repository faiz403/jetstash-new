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

export function HomepageOpeningHero() {
  return (
    <PageHero
      eyebrow="UK travel intelligence"
      title="Know the journey before you book the fare."
      description="JetStash checks routes, travel requirements, timing, baggage and dated fare evidence for international journeys from UK airports."
      heroKey="routes"
      size="compact"
    >
      <div className="flex flex-wrap items-center gap-3">
        <LinkButton href="#your-journey" variant="primary" size="lg">
          Check my journey
        </LinkButton>
        <LinkButton href="#route-atlas" variant="outline" size="lg">
          Explore the Route Atlas
        </LinkButton>
      </div>
      <p className="mt-3 text-xs text-ink-400">Checked, dated and sourced. Booking links come last.</p>

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
      <p className="mt-3 text-xs text-ink-400">When the journey is clear, JetStash points you to a booking partner.</p>
    </PageHero>
  );
}
