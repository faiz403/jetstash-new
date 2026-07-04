import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/sections/page-hero';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How JetStash collects, uses and protects your personal data.',
  alternates: { canonical: `${siteConfig.url}/privacy-policy` },
};

const sections: { title: string; body: React.ReactNode }[] = [
  {
    title: 'What we collect',
    body: 'If you sign up to JetStash Travel Club, we collect your email address and, if you choose to provide them, your nearest UK airport and which region or cabin you\'re interested in. Both preference fields are optional. If you use the contact form, we collect your name, email address, and the content of your message. We do not collect payment information — all bookings happen on the airline or partner\'s own website.',
  },
  {
    title: 'How we use it',
    body: 'Email addresses collected via Travel Club, along with any airport or interest preference you give us, are used to send occasional emails about fares and routes we think are relevant to you. These are reviewed and sent by a person, not generated automatically — we do not run live, automated price-tracking. Contact form submissions are used to respond to your enquiry and are not added to any marketing list unless you separately opt in.',
  },
  {
    title: 'Third parties',
    body: 'We use a third-party email service provider to send Travel Club emails and manage the subscriber list. We do not sell or share your email address with any other third party for marketing purposes.',
  },
  {
    title: 'Your rights',
    body: (
      <>
        You can unsubscribe from Travel Club emails at any time using the link in any email we send. To request
        deletion of your data entirely, contact us via the{' '}
        <Link href="/contact" className="font-medium text-terracotta-600 underline">
          contact page
        </Link>
        .
      </>
    ),
  },
  {
    title: 'Cookies',
    body: 'This site may use basic analytics cookies to understand site usage. We do not use cookies for cross-site advertising tracking.',
  },
];

export default function PrivacyPolicyPage() {
  return (
    <>
      <PageHero
        eyebrow="Privacy"
        title="Your data, handled the way everything else here is: plainly"
        description="No dark patterns, no pre-ticked boxes, no selling your email. This page says exactly what we collect and why — it's short because there isn't much."
      />

      <section className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-2xl px-5 sm:px-8">
          <p className="text-sm text-ink-400">Last updated: June 2026</p>
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
