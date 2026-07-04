import type { Metadata } from 'next';
import Link from 'next/link';
import { DealsExplorer } from '@/components/sections/deals-explorer';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Current Fares — UK to Pakistan, India, the Gulf & Umrah',
  description:
    'Example fares from UK airports to Pakistan, India, the Gulf and Umrah, each checked by hand on a stated date — never a live price claim.',
  alternates: { canonical: `${siteConfig.url}/deals` },
};

export default function DealsPage() {
  return (
    <>
      <section className="bg-ink-900 py-16 sm:py-20">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <h1 className="font-display text-4xl text-sand-50 sm:text-5xl">Fares we&apos;re tracking</h1>
          <p className="mt-3 max-w-xl text-lg leading-relaxed text-ink-300">
            Every fare below is an example a member of our team checked by hand on the date shown — never a
            live price, never an automated feed. Always confirm the final price before booking.{' '}
            <Link href="/about" className="font-medium text-brass-300 underline underline-offset-2 hover:text-brass-200">
              Read our standards
            </Link>
            .
          </p>
        </div>
      </section>

      <DealsExplorer />
    </>
  );
}
