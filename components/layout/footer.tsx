import Link from 'next/link';
import { footerNav, siteConfig } from '@/lib/site-config';
import { Logomark } from '../ui/logomark';

export function Footer() {
  return (
    <footer className="border-t border-white/5 bg-ink-950">
      <div className="mx-auto max-w-content px-5 py-16 sm:px-8">
        <div className="grid grid-cols-2 gap-10 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div className="col-span-2 lg:col-span-1">
            <span className="flex items-center gap-2.5">
              <Logomark size={26} />
              <span className="font-display text-2xl text-sand-50">{siteConfig.name}</span>
            </span>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-300">{siteConfig.tagline}.</p>
            <a
              href="mailto:hello@jetstash.co.uk"
              className="mt-4 inline-block text-sm text-ink-200 underline decoration-ink-500 underline-offset-4 transition-colors hover:text-brass-300 hover:decoration-brass-300"
            >
              hello@jetstash.co.uk
            </a>
            <p className="mt-5 max-w-sm text-xs leading-relaxed text-ink-400">
              Every fare on this site is an example checked by a person on a stated date. Never a live price
              claim, never invented urgency. That standard is the product.
            </p>
            <p className="mt-4 max-w-sm text-xs leading-relaxed text-ink-400">
              JetStash earns a commission on some bookings made through partner links. This never affects the price
              you pay. See our{' '}
              <Link href="/affiliate-disclosure" className="underline hover:text-brass-300">
                affiliate disclosure
              </Link>
              .
            </p>
          </div>

          <FooterColumn title="Regions" links={footerNav.regions} />
          <FooterColumn title="Travel" links={footerNav.travel} />
          <FooterColumn title="Company" links={footerNav.company} />
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/5 pt-8 text-xs text-ink-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} JetStash. All rights reserved.</p>
          <p className="max-w-xl">
            Prices shown across this site are indicative and subject to change. Always confirm the final price
            with the airline or operator before booking.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <nav aria-label={title}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-400">{title}</h3>
      <ul className="mt-4 flex flex-col gap-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-sm text-ink-200 transition-colors hover:text-brass-300">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
