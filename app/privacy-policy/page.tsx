import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How JetStash collects, uses and protects your personal data.',
};

export default function PrivacyPolicyPage() {
  return (
    <section className="bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-2xl px-5 sm:px-8">
        <h1 className="font-display text-4xl text-ink-900">Privacy policy</h1>
        <div className="mt-8 flex flex-col gap-6 text-ink-600">
          <p className="text-sm text-ink-400">Last updated: June 2026</p>

          <div>
            <h2 className="font-display text-xl text-ink-900">What we collect</h2>
            <p className="mt-2 leading-relaxed">
              If you sign up to JetStash Travel Club, we collect your email address. If you use the contact form,
              we collect your name, email address, and the content of your message. We do not collect payment
              information — all bookings happen on the airline or partner's own website.
            </p>
          </div>

          <div>
            <h2 className="font-display text-xl text-ink-900">How we use it</h2>
            <p className="mt-2 leading-relaxed">
              Email addresses collected via Travel Club are used solely to send fare-drop alerts and occasional
              JetStash updates. Contact form submissions are used to respond to your enquiry and are not added to
              any marketing list unless you separately opt in.
            </p>
          </div>

          <div>
            <h2 className="font-display text-xl text-ink-900">Third parties</h2>
            <p className="mt-2 leading-relaxed">
              We use a third-party email service provider to send Travel Club emails and manage the subscriber
              list. We do not sell or share your email address with any other third party for marketing purposes.
            </p>
          </div>

          <div>
            <h2 className="font-display text-xl text-ink-900">Your rights</h2>
            <p className="mt-2 leading-relaxed">
              You can unsubscribe from Travel Club emails at any time using the link in any email we send. To
              request deletion of your data entirely, contact us via the{' '}
              <a href="/contact" className="font-medium text-terracotta-600 underline">
                contact page
              </a>
              .
            </p>
          </div>

          <div>
            <h2 className="font-display text-xl text-ink-900">Cookies</h2>
            <p className="mt-2 leading-relaxed">
              This site may use basic analytics cookies to understand site usage. We do not use cookies for
              cross-site advertising tracking.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
