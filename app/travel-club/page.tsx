import type { Metadata } from 'next';
import { Mail, Bell, ShieldCheck, MapPinned } from 'lucide-react';
import { PageHero } from '@/components/sections/page-hero';
import { NewsletterSection } from '@/components/sections/newsletter-section';

export const metadata: Metadata = {
  alternates: { canonical: '/travel-club' },
  // Root layout's title template already appends " | JetStash" — no manual suffix here.
  title: 'Travel Club',
  description: 'Human-curated route and fare intelligence for international journeys from UK airports, focused on the routes JetStash actively verifies.',
};

export default function TravelClubPage() {
  return (
    <>
      <PageHero
        heroKey="travel-club"
        eyebrow="Travel Club"
        title="One email, when it's actually worth opening"
        description="JetStash Travel Club exists for one reason: to tell you when we've found a fare on a route you care about that's genuinely worth knowing about. No daily digest, no padding it out with filler."
      />

      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <FeatureCard
              icon={<Bell className="h-5 w-5" strokeWidth={2} />}
              title="Checked by us, not an algorithm"
              body="We don't run automated live price tracking. Fares are researched and updated by hand, and you'll hear from us when we've found something genuinely worth flagging, not on a fixed schedule."
            />
            <FeatureCard
              icon={<Mail className="h-5 w-5" strokeWidth={2} />}
              title="Focused on your routes"
              body="Tell us your nearest airport and which region or cabin you're tracking, and that's what shapes what lands in your inbox, not every update we make."
            />
            <FeatureCard
              icon={<MapPinned className="h-5 w-5" strokeWidth={2} />}
              title="Told when a new route launches"
              // Trust fix (6 Sept 2026, independent audit): this previously
              // cited "Ahmedabad's Gatwick service" as a settled example of
              // an added direct/improved route. JetStash's own canonical
              // presentation for london-gatwick-ahmedabad is "Verification
              // pending" (Route Verification Refresh Batch 1-2 + Rolling
              // Reverification Batch 4: Air India's own current surfaces
              // genuinely conflict on which London airport this service
              // uses — see data/routes.ts), so citing it here as an example
              // of a route already added contradicted the route's own badge.
              // Rewritten generically so the proposition (Travel Club hears
              // about new/improved routes first) no longer depends on any
              // one route's current, possibly-unresolved status.
              body="When we add a newly verified direct route or a meaningful route improvement in a region you've told us you care about, Travel Club hears about it first."
            />
            <FeatureCard
              icon={<ShieldCheck className="h-5 w-5" strokeWidth={2} />}
              title="Free, and easy to leave"
              body="No subscription, no catch. Unsubscribe in one click from any email, any time."
            />
          </div>
        </div>
      </section>

      <NewsletterSection />
    </>
  );
}

/**
 * Heading-structure fix (6 Sept 2026, full-site crawl finding, residual
 * defect completed on founder instruction): promoted h3 -> h2. This grid
 * has no section heading of its own between it and the page's H1 —
 * structurally the same shape as /airports' card grid (PR #238) and
 * /deals' card grid (this same PR): each card is effectively its own
 * top-level entry following H1, not a subordinate of an established
 * section, so h2 is correct here too. FeatureCard is page-local, used
 * only on this page.
 */
function FeatureCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-md border border-ink-100 bg-sand-50 p-7 transition-all hover:-translate-y-1 hover:shadow-card-hover">
      <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-terracotta-50 text-terracotta-600">{icon}</div>
      <h2 className="mt-4 font-display text-lg text-ink-900">{title}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{body}</p>
    </div>
  );
}
