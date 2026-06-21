import type { Metadata } from 'next';
import { Mail, Bell, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { NewsletterSection } from '@/components/sections/newsletter-section';

export const metadata: Metadata = {
  title: 'JetStash Travel Club',
  description: 'Join JetStash Travel Club for fare-drop alerts on flights from the UK to Pakistan, India, the Gulf and beyond.',
};

export default function TravelClubPage() {
  return (
    <>
      <section className="bg-ink-900 py-16 sm:py-20">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <Badge variant="dark">Travel Club</Badge>
          <h1 className="mt-4 max-w-2xl font-display text-4xl leading-[1.08] text-sand-50 sm:text-5xl">
            One email, when it's actually worth opening
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-300">
            JetStash Travel Club exists for one reason: to tell you when a fare on a route you care about has
            genuinely dropped. No daily digest, no padding it out with filler.
          </p>
        </div>
      </section>

      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <div className="grid gap-6 sm:grid-cols-3">
            <FeatureCard
              icon={<Bell className="h-5 w-5" strokeWidth={2} />}
              title="Triggered by real price movement"
              body="We only send an alert when a route shows a genuine drop against its recent average — not on a fixed schedule."
            />
            <FeatureCard
              icon={<Mail className="h-5 w-5" strokeWidth={2} />}
              title="Focused on your routes"
              body="Tell us which UK airport and which region you care about, and that's what shapes what lands in your inbox."
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
    <div className="rounded-md border border-ink-100 bg-sand-50 p-7">
      <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-terracotta-50 text-terracotta-600">{icon}</div>
      <h3 className="mt-4 font-display text-lg text-ink-900">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{body}</p>
    </div>
  );
}
