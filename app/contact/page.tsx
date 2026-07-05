import type { Metadata } from 'next';
import Link from 'next/link';
import { Mail, MessageSquareText, ShieldCheck } from 'lucide-react';
import { PageHero } from '@/components/sections/page-hero';
import { ContactForm } from '@/components/sections/contact-form';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Contact JetStash',
  description: 'Questions about a route, a fare, or anything else on JetStash — send us a message.',
  alternates: { canonical: `${siteConfig.url}/contact` },
};

export default function ContactPage() {
  return (
    <>
      <PageHero
        heroKey="contact"
        eyebrow="Contact"
        title="Talk to a person, not a ticket queue"
        description="Questions about a route, a destination, a fare that doesn't look right — send us a message and a real person reads it."
      />

      <section className="bg-white py-16 sm:py-24">
        <div className="mx-auto grid max-w-content gap-12 px-5 sm:px-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <h2 className="font-display text-2xl text-ink-900">Send a message</h2>
            <ContactForm />
            <p className="mt-6 text-sm text-ink-400">
              Prefer email?{' '}
              <a
                href="mailto:hello@jetstash.co.uk"
                className="font-medium text-ink-700 underline underline-offset-2 hover:text-brass-600"
              >
                hello@jetstash.co.uk
              </a>
            </p>
          </div>

          <div className="flex flex-col gap-5">
            <div className="rounded-md border border-ink-100 bg-sand-50 p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-white text-brass-600 shadow-card">
                <MessageSquareText className="h-5 w-5" strokeWidth={2} />
              </div>
              <h3 className="mt-4 font-display text-lg text-ink-900">Looking for real pricing?</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-500">
                For Umrah packages, family trips and group bookings, the quote request form gets you a
                researched answer from a person — faster than a general enquiry.
              </p>
              <Link
                href="/quote-request"
                className="mt-3 inline-block text-sm font-semibold text-terracotta-600 underline underline-offset-2 hover:text-terracotta-700"
              >
                Request a quote instead
              </Link>
            </div>

            <div className="rounded-md border border-ink-100 bg-sand-50 p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-white text-brass-600 shadow-card">
                <ShieldCheck className="h-5 w-5" strokeWidth={2} />
              </div>
              <h3 className="mt-4 font-display text-lg text-ink-900">Spotted something wrong?</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-500">
                If a fare, schedule or claim on this site doesn&apos;t hold up, tell us — corrections make the
                site better for everyone. That&apos;s a standing invitation, not a formality.
              </p>
              <Link
                href="/about"
                className="mt-3 inline-block text-sm font-semibold text-terracotta-600 underline underline-offset-2 hover:text-terracotta-700"
              >
                Read our standards
              </Link>
            </div>

            <div className="rounded-md border border-ink-100 bg-ink-900 p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-white/10 text-brass-300">
                <Mail className="h-5 w-5" strokeWidth={2} />
              </div>
              <h3 className="mt-4 font-display text-lg text-sand-50">One email, when it&apos;s worth it</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-300">
                Travel Club members hear first when we find a fare genuinely worth flagging on their route —
                curated by a person, never a daily digest.
              </p>
              <Link
                href="/travel-club"
                className="mt-3 inline-block text-sm font-semibold text-brass-300 underline underline-offset-2 hover:text-brass-200"
              >
                Join Travel Club
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
