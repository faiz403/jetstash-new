import type { Metadata } from 'next';
import { Mail, Bell, ShieldCheck, MapPinned } from 'lucide-react';
import { PageHero } from '@/components/sections/page-hero';
import { NewsletterSection } from '@/components/sections/newsletter-section';

export const metadata: Metadata = {
  alternates: { canonical: '/travel-club' },
  title: 'JetStash Travel Club',
  description: 'Join JetStash Travel Club for hand-picked fare tips on flights from the UK to Pakistan, India, the Gulf and beyond, curated for the route you actually care about.',
};

export default function TravelClubPage() {
  return (
    <>
      <PageHero
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
              body="We don't run automated live price tracking — fares are researched and updated by hand. You'll hear from us when we've found something genuinely worth flagging, not on a fixed schedule."
            />
            <FeatureCard
              icon={<Mail className="h-5 w-5" strokeWidth={2} />}
              title="Focused on your routes"
              body="Tell us your nearest airport and which region or cabin you're tracking, and that's what shapes what lands in your inbox — not every update we make."
            />
            <FeatureCard
              icon={<MapPinned className="h-5 w-5" strokeWidth={2} />}
              title="Told when a new route launches"
              body="When we add a new direct or improved route in a region you've told us you care about — like Ahmedabad's Gatwick service — Travel Club hears about it first."
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

function FeatureCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-md border border-ink-100 bg-sand-50 p-7 transition-all hover:-translate-y-1 hover:shadow-card-hover">
      <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-terracotta-50 text-terracotta-600">{icon}</div>
      <h3 className="mt-4 font-display text-lg text-ink-900">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{body}</p>
    </div>
  );
}
