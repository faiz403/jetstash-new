import Link from 'next/link';
import { footerNav, siteConfig } from '@/lib/site-config';

export function Footer() {
  return (
    <footer className="border-t border-white/5 bg-ink-950">
      <div className="mx-auto max-w-content px-5 py-16 sm:px-8">
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-4">
          <div className="col-span-2">
            <span className="font-display text-2xl text-sand-50">{siteConfig.name}</span>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-300">{siteConfig.tagline}.</p>
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
        </div>

        <div className="mt-12 grid grid-cols-2 gap-10 border-t border-white/5 pt-10 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1" />
          <FooterColumn title="Company" links={footerNav.company} />
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-white/5 pt-8 text-xs text-ink-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} JetStash. All rights reserved.</p>
          <p>Prices shown across this site are indicative and subject to change — always confirm the final price with the airline or operator before booking.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
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
    </div>
  );
}
