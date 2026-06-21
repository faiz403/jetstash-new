import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About JetStash',
  description: 'JetStash is a UK travel site focused on routes to Pakistan, India, the Gulf and beyond.',
};

export default function AboutPage() {
  return (
    <section className="bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-2xl px-5 sm:px-8">
        <h1 className="font-display text-4xl text-ink-900">About JetStash</h1>
        <div className="mt-8 flex flex-col gap-5 text-ink-600">
          <p className="leading-relaxed">
            Most UK travel sites treat flights to Pakistan, India and the Gulf as a footnote — a handful of pages
            bolted onto a site built primarily around Spain and the Mediterranean. JetStash starts from the
            opposite assumption: these routes deserve the same depth of coverage as anywhere else, because for a
            huge number of people in the UK, they're the trip that actually matters most.
          </p>
          <p className="leading-relaxed">
            We track flight and package prices from UK airports, organise the site around how people actually
            travel — family visits, Umrah, business trips, holidays — and try to be honest about what we don't
            know. Where a fare is indicative, we say so. Where a price was last checked, we show the date.
          </p>
          <p className="leading-relaxed">
            JetStash earns a commission on some bookings made through partner links on this site. This is how the
            site is funded, and it never changes the price you pay or which routes we choose to cover. You can read
            the full detail on our{' '}
            <a href="/affiliate-disclosure" className="font-medium text-terracotta-600 underline">
              affiliate disclosure page
            </a>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
