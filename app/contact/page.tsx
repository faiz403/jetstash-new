import type { Metadata } from 'next';
import { ContactForm } from '@/components/sections/contact-form';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Contact JetStash',
  description: 'Questions about a route, a fare, or anything else on JetStash — send us a message.',
  alternates: { canonical: `${siteConfig.url}/contact` },
};

export default function ContactPage() {
  return (
    <section className="bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-xl px-5 sm:px-8">
        <h1 className="font-display text-4xl text-ink-900">Get in touch</h1>
        <p className="mt-3 text-ink-500">Questions about a route, a destination, or anything else — send us a message.</p>
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
    </section>
  );
}
