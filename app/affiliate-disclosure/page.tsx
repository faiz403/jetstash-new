import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Affiliate Disclosure',
  description: 'How JetStash earns money and what that means for the prices and recommendations on this site.',
};

export default function AffiliateDisclosurePage() {
  return (
    <section className="bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-2xl px-5 sm:px-8">
        <h1 className="font-display text-4xl text-ink-900">Affiliate disclosure</h1>
        <div className="mt-8 flex flex-col gap-5 text-ink-600">
          <p className="leading-relaxed">
            JetStash earns a commission on some bookings made through links on this site — typically when you
            click through to an airline, travel agent or booking platform and complete a purchase. This is how
            JetStash is funded.
          </p>
          <p className="leading-relaxed">
            This arrangement does not affect the price you pay. Commission is paid to JetStash by the partner
            business, not added to your fare.
          </p>
          <p className="leading-relaxed">
            We aim to show fares and routes based on what's genuinely useful to UK travellers heading to Pakistan,
            India, the Gulf and beyond — not based on which partner pays the highest commission. Where we feature
            a specific operator or fare, it's because we believe it's relevant, not because of the size of the
            commission involved.
          </p>
          <p className="leading-relaxed">
            Prices shown across this site are indicative, based on fares checked at a specific point in time
            (shown on each listing), and are subject to change. Always confirm the final price directly with the
            airline or operator before completing a booking.
          </p>
          <p className="leading-relaxed">
            If you have any questions about how a specific page or fare is sourced, contact us via the{' '}
            <a href="/contact" className="font-medium text-terracotta-600 underline">
              contact page
            </a>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
