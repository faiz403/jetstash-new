import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/sections/page-hero';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Terms & Conditions',
  description: 'The terms that apply to using JetStash: what this site is, what it isn\'t, and what happens once you click through to book with a partner.',
  alternates: { canonical: `${siteConfig.url}/terms` },
};

const sections: { title: string; body: React.ReactNode }[] = [
  {
    title: 'What JetStash is',
    body: 'JetStash is a UK travel-intelligence website. We research and publish route status, fare patterns, booking timing and travel-readiness guidance for international journeys from UK airports. Using this site means you accept these terms.',
  },
  {
    title: 'What JetStash is not',
    body: (
      <>
        JetStash is not a travel agent, tour operator or booking platform, and we do not take payment or process
        bookings on this site. We are not ATOL or ABTA protected because we do not sell flights, package holidays
        or any other travel arrangement directly — that protection sits with the airline, agent or platform you
        actually book with. When you click through to a partner such as TravelUp and complete a booking, your
        contract is with that partner, not with JetStash. Their terms, their payment, their customer service, and
        their financial protection (if any) apply, not ours. See our{' '}
        <Link href="/affiliate-disclosure" className="font-medium text-terracotta-600 underline">
          affiliate disclosure
        </Link>{' '}
        for how that relationship works and what it does and doesn&apos;t influence.
      </>
    ),
  },
  {
    title: 'Accuracy of information',
    body: 'Route, fare, schedule and document information on this site is researched and dated, not live. Fares are indicative and checked at a specific point in time shown on each listing; airline schedules, visa rules and document requirements can change after we\'ve checked them. Always confirm the current price, schedule and entry requirements directly with the airline, operator or relevant government before booking or travelling. We correct genuine errors when we find them, but we don\'t guarantee this site is complete, current or error-free at every moment.',
  },
  {
    title: 'Travel Ready Check and document guidance',
    body: 'Travel Ready Check and any passport, visa or document guidance on this site are sourced from official government pages and dated when we last checked them, but they are general guidance, not personal immigration or legal advice, and they don\'t cover every nationality, document type or personal circumstance. Before you travel, always confirm your specific requirements directly with the relevant embassy, consulate or official government source.',
  },
  {
    title: 'Acceptable use',
    body: 'Don\'t use this site to do anything unlawful, to scrape or systematically extract its content for republication, to attempt to disrupt or gain unauthorised access to it, or to impersonate JetStash or misrepresent your relationship with us.',
  },
  {
    title: 'Intellectual property',
    body: 'The route intelligence, written content, design and branding on this site are JetStash\'s own work, built from real research over time. You\'re welcome to link to JetStash; you don\'t have permission to copy, republish or systematically reproduce our content elsewhere without asking first.',
  },
  {
    title: 'Liability',
    body: 'Because we don\'t take bookings or handle payments, JetStash is not liable for the acts, omissions, pricing, service quality or financial protection of any airline, agent or platform you book with after leaving this site. We provide this site "as is," and to the fullest extent the law allows, we\'re not liable for losses arising from using it or relying on information on it. Nothing in these terms excludes or limits liability where the law doesn\'t allow it to be excluded or limited, including liability for death or personal injury caused by negligence, or for fraud.',
  },
  {
    title: 'Changes to these terms',
    body: 'We may update these terms as the site or our services change. The date below shows when this page was last updated; continuing to use the site after an update means you accept the current version.',
  },
  {
    title: 'Governing law and contact',
    body: (
      <>
        These terms are governed by the law of England and Wales. If you have any questions about them, contact us
        via the{' '}
        <Link href="/contact" className="font-medium text-terracotta-600 underline">
          contact page
        </Link>
        .
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <>
      <PageHero
        eyebrow="Terms"
        title="The terms behind using this site, written the same way as everything else here: plainly"
        description="JetStash is a travel-intelligence site, not a booking agent. Here's exactly what that means for you, and what happens once you click through to book with a partner."
      />

      <section className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-2xl px-5 sm:px-8">
          <p className="text-sm text-ink-400">Last updated: July 2026</p>
          <div className="mt-8 flex flex-col gap-10">
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
