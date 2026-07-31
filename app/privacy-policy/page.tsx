import type { Metadata } from 'next';
import { PageHero } from '@/components/sections/page-hero';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How JetStash collects, uses and protects your personal data.',
  alternates: { canonical: `${siteConfig.url}/privacy-policy` },
};

/**
 * Privacy-notice completion pass (31 July 2026): rewritten section by section
 * against the site's actual data flows (contact/quote-request forms, Travel
 * Club and Route Watch via Brevo, Resend for transactional delivery, the
 * Microsoft 365 mailbox behind every @jetstash.co.uk address, Vercel
 * Analytics/Speed Insights, and Travel Ready Check's fully client-side
 * processing) rather than generic boilerplate. Every claim here is
 * traceable to real code or configuration, see the PR description for the
 * evidence table. Operator identity uses the founder-approved public name
 * only ("Faiz Ahmed, trading as JetStash"), never the full legal name,
 * which is used separately for HMRC, banking, tax and contracts, not on
 * this site. No postal address is published: none has been approved, and
 * none is invented here. This is not a substitute for professional legal
 * review, and is not presented as one.
 */
const sections: { title: string; body: React.ReactNode }[] = [
  {
    title: 'Who operates JetStash',
    body: (
      <>
        <p>
          JetStash is operated by Faiz Ahmed, trading as JetStash. For anything to do with your personal data,
          JetStash is the controller: the one who decides what&apos;s collected and why.
        </p>
        <p>
          For any privacy question, to see what we hold about you, or to ask us to delete it, email{' '}
          <a href="mailto:privacy@jetstash.co.uk" className="font-medium text-terracotta-600 underline">
            privacy@jetstash.co.uk
          </a>{' '}
          directly.
        </p>
      </>
    ),
  },
  {
    title: 'What we collect',
    body: (
      <>
        <p>What we collect depends entirely on how you use the site:</p>
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          <li>Contact form: your name, email address and the message you send.</li>
          <li>
            Quote request: your name, email address, trip type and region, and any optional details you choose to
            add, such as phone number, traveller count, approximate travel dates or a budget note.
          </li>
          <li>
            Travel Club or Route Watch sign-up: your email address, and any optional preferences you give us, such
            as your nearest UK airport, travel interest, or the specific route you&apos;d like us to watch.
          </li>
          <li>
            Technical information generated automatically by visiting the site: your IP address, browser and device
            information, and standard web server logs.
          </li>
          <li>Aggregate, cookieless usage information, described under Cookies and analytics below.</li>
        </ul>
        <p>
          Travel Ready Check is different from everything above. Whether you&apos;re travelling on a British
          passport, which document exemption applies to you, and the dates you enter, are used only to work out an
          answer inside your own browser. None of it is sent to us, stored by us, or seen by us. See How we collect
          information below for more on this.
        </p>
      </>
    ),
  },
  {
    title: "What we don't collect",
    body: (
      <p>
        We do not ask for, and do not knowingly collect, passport or other document numbers, payment card details,
        copies of passports or other identity documents, or any other sensitive document files. Travel Ready Check
        asks which type of document or exemption applies to you, never the document itself.
      </p>
    ),
  },
  {
    title: 'How we collect information',
    body: (
      <p>
        We collect information when you fill in a form on this site, subscribe to Travel Club or Route Watch, email
        us directly, or simply browse the site, which generates the standard technical information described above.
        Travel Ready Check works entirely differently: it runs in your browser and never sends what you enter
        anywhere, including to us.
      </p>
    ),
  },
  {
    title: 'Cookies and analytics',
    body: (
      <p>
        JetStash does not use cookies. The one analytics tool on this site, Vercel Web Analytics, is built to work
        without cookies or any other tracking identifier, and only ever receives page-view and named-event data with
        route or destination context, never a name, email address or anything else that identifies you personally.
        We also use Vercel Speed Insights, which measures page performance in the same cookieless way.
      </p>
    ),
  },
  {
    title: 'Why we use your information',
    body: (
      <ul className="flex list-disc flex-col gap-1.5 pl-5">
        <li>To reply to your message or quote request.</li>
        <li>To send Travel Club or Route Watch updates you&apos;ve opted in to receive.</li>
        <li>To keep the website running securely and to prevent abuse.</li>
        <li>To understand, in aggregate, how the site is used, so we can improve it.</li>
        <li>To meet our legal obligations, where they apply.</li>
      </ul>
    ),
  },
  {
    title: 'The legal basis we rely on',
    body: (
      <>
        <p>UK data protection law requires a lawful basis for each way we use your information:</p>
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          <li>
            <strong className="font-semibold text-ink-800">Contact form and quote requests:</strong> legitimate
            interests. You&apos;ve reached out to us directly, and replying is the plainly expected next step.
          </li>
          <li>
            <strong className="font-semibold text-ink-800">Travel Club and Route Watch:</strong> consent. You choose
            to sign up, and every email we send includes a way to unsubscribe.
          </li>
          <li>
            <strong className="font-semibold text-ink-800">Website security and abuse prevention:</strong>{' '}
            legitimate interests and, where relevant, legal obligation.
          </li>
          <li>
            <strong className="font-semibold text-ink-800">Aggregate analytics:</strong> legitimate interests,
            limited to understanding overall site usage, never to identifying you.
          </li>
        </ul>
        <p>
          We don&apos;t rely on &lsquo;contract&rsquo; as a basis anywhere on this site. JetStash doesn&apos;t take
          bookings or payments, so there&apos;s no contract between you and JetStash to point to.
        </p>
      </>
    ),
  },
  {
    title: 'Who we share information with',
    body: (
      <>
        <p>We don&apos;t sell your personal data, and we don&apos;t share it with advertisers. We use:</p>
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          <li>Vercel, to host this website and its server logs.</li>
          <li>Resend, to deliver contact form and quote request emails to us.</li>
          <li>Brevo, to store the Travel Club and Route Watch subscriber list and send those emails.</li>
          <li>
            A Microsoft 365 mailbox, provided via GoDaddy, which is where email sent to our published addresses
            actually lands.
          </li>
        </ul>
        <p>
          We may also share the minimum necessary detail with a professional adviser, such as an accountant or
          solicitor, or with an authority such as the Information Commissioner&apos;s Office, where the law requires
          it. We do not currently use Google Analytics, advertising pixels, or any tracking or marketing technology
          beyond what&apos;s listed above.
        </p>
      </>
    ),
  },
  {
    title: 'Where your information is processed',
    body: (
      <p>
        Some of the service providers we use, including Vercel, Resend, Brevo and Microsoft 365, may process
        personal information outside the UK, including in the United States, as part of how their services run.
        Where this happens, JetStash takes reasonable steps to use providers that apply appropriate protections,
        and relies on the safeguards made available through their contractual and legal arrangements. The precise
        arrangements may vary by provider and location, and we haven&apos;t independently completed a
        transfer-risk assessment for each one. We recommend checking each provider&apos;s own published privacy
        policy for their current detail.
      </p>
    ),
  },
  {
    title: 'How long we keep information',
    body: (
      <p>
        We don&apos;t yet have formal, fixed retention periods set for every kind of information described above. As
        a general principle, we keep it for as long as it&apos;s needed for the purpose it was collected for, for
        example for as long as you stay subscribed to Travel Club or Route Watch, or for a reasonable period after
        we&apos;ve answered a one-off enquiry, and delete or anonymise it once that purpose has passed. Setting exact
        retention periods for each type of data is still on our to-do list and needs a formal decision. Email{' '}
        <a href="mailto:privacy@jetstash.co.uk" className="font-medium text-terracotta-600 underline">
          privacy@jetstash.co.uk
        </a>{' '}
        if you&apos;d like more detail on a specific case in the meantime.
      </p>
    ),
  },
  {
    title: 'How we protect your information',
    body: (
      <p>
        We use security practices proportionate to a small operation like JetStash: our hosting, form and
        mailing-list providers each run their own security measures, and this site sends security headers on every
        page, including protections against clickjacking and content-type sniffing. No website can guarantee to be
        completely secure, and we don&apos;t claim ours is. We don&apos;t hold any formal security certifications at
        this time.
      </p>
    ),
  },
  {
    title: 'Your rights',
    body: (
      <>
        <p>Under UK data protection law, you have the right to:</p>
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          <li>ask what personal data we hold about you, and get a copy (access)</li>
          <li>ask us to correct anything that&apos;s wrong (correction)</li>
          <li>ask us to delete your data (deletion)</li>
          <li>ask us to limit how we use it (restriction)</li>
          <li>object to us using it, particularly for Travel Club or Route Watch emails</li>
          <li>receive your data in a portable format, where that applies</li>
          <li>withdraw consent at any time, for anything we do on the basis of consent</li>
        </ul>
        <p>
          To use any of these rights, email{' '}
          <a href="mailto:privacy@jetstash.co.uk" className="font-medium text-terracotta-600 underline">
            privacy@jetstash.co.uk
          </a>
          . We&apos;ll respond as quickly as we reasonably can.
        </p>
      </>
    ),
  },
  {
    title: 'Complaints',
    body: (
      <p>
        If you&apos;re unhappy with how we&apos;ve handled your data, we&apos;d genuinely like the chance to put it
        right first, at{' '}
        <a href="mailto:privacy@jetstash.co.uk" className="font-medium text-terracotta-600 underline">
          privacy@jetstash.co.uk
        </a>
        . You also have the right to complain to the UK&apos;s data protection regulator, the Information
        Commissioner&apos;s Office, at{' '}
        <a
          href="https://ico.org.uk"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-terracotta-600 underline"
        >
          ico.org.uk
        </a>
        .
      </p>
    ),
  },
  {
    title: 'Children',
    body: (
      <p>
        JetStash is built for UK-based adults planning their own international travel. It is not designed for, or
        aimed at, children, and we don&apos;t knowingly collect personal data from children. If you believe a child
        has given us personal data, contact us at{' '}
        <a href="mailto:privacy@jetstash.co.uk" className="font-medium text-terracotta-600 underline">
          privacy@jetstash.co.uk
        </a>{' '}
        and we&apos;ll remove it.
      </p>
    ),
  },
  {
    title: 'Other websites you link to from here',
    body: (
      <p>
        This site links to airlines, booking partners such as TravelUp, and official government pages for visa and
        entry information. Once you leave jetstash.co.uk, that site&apos;s own privacy practices apply, not
        ours. We&apos;d encourage you to check them before sharing any personal information.
      </p>
    ),
  },
  {
    title: 'Changes to this notice',
    body: (
      <p>
        We&apos;ll update this page as the site, or how we use your information, changes. The date below always
        shows when it was last revised.
      </p>
    ),
  },
];

export default function PrivacyPolicyPage() {
  return (
    <>
      <PageHero
        eyebrow="Privacy"
        title="Your data, handled the way everything else here is: plainly"
        description="No dark patterns, no pre-ticked boxes, no selling your data. This page says exactly what we collect, why we use it, and how to ask us anything about it."
      />

      <section className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-2xl px-5 sm:px-8">
          <p className="text-sm text-ink-400">Last updated: 31 July 2026</p>
          <div className="mt-8 flex flex-col gap-10">
            {sections.map((section, i) => (
              <div key={section.title} className="grid gap-3 border-l-2 border-brass-200 pl-6 sm:grid-cols-[2.5rem_1fr] sm:gap-5">
                <span className="font-display text-2xl leading-none text-ink-200 sm:pt-0.5" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <h2 className="font-display text-xl text-ink-900">{section.title}</h2>
                  <div className="mt-2 flex flex-col gap-3 leading-relaxed text-ink-600">{section.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
