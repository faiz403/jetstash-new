import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/sections/page-hero';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Affiliate Disclosure',
  description: 'How JetStash earns money and what that means for the prices and recommendations on this site.',
  alternates: { canonical: `${siteConfig.url}/affiliate-disclosure` },
};

const sections: { title: string; body: React.ReactNode }[] = [
  {
    title: 'How JetStash is funded',
    body: 'JetStash earns a commission on some bookings made through links on this site, typically when you click through to an airline, travel agent or booking platform and complete a purchase. This is how JetStash is funded.',
  },
  {
    title: 'It never changes your price',
    body: 'This arrangement does not affect the price you pay. Commission is paid to JetStash by the partner business, not added to your fare.',
  },
  {
    title: 'It never changes what we say',
    body: 'We aim to show fares and routes based on what\'s genuinely useful to UK travellers on the international routes we cover, not based on which partner pays the highest commission. Where we feature a specific operator or fare, it\'s because we believe it\'s relevant, not because of the size of the commission involved.',
  },
  {
    title: 'Prices are indicative, always',
    body: 'Prices shown across this site are indicative, based on fares checked at a specific point in time (shown on each listing), and are subject to change. Always confirm the final price directly with the airline or operator before completing a booking.',
  },
  {
    title: 'Questions?',
    body: (
      <>
        If you have any questions about how a specific page or fare is sourced, contact us via the{' '}
        <Link href="/contact" className="font-medium text-terracotta-600 underline">
          contact page
        </Link>
        .
      </>
    ),
  },
];

export default function AffiliateDisclosurePage() {
  return (
    <>
      <PageHero
        eyebrow="Affiliate disclosure"
        title="How we make money, plainly"
        description="Some links on JetStash pay us a commission. Here's exactly how that works, and exactly what it does and doesn't influence."
      />

      <section className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-2xl px-5 sm:px-8">
          <div className="flex flex-col gap-10">
            {sections.map((section, i) => (
              <div key={section.title} className="grid gap-3 border-l-2 border-brass-200 pl-6 sm:grid-cols-[2.5rem_1fr] sm:gap-5">
                <span className="font-display text-2xl leading-none text-ink-200 sm:pt-0.5" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <h2 className="font-display text-xl text-ink-900">{section.title}</h2>
                  <p className="mt-2 leading-relaxed text-ink-600">{section.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
