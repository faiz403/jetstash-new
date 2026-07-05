import type { Metadata, Viewport } from 'next';
import { Fraunces, Public_Sans } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { JsonLd, organizationSchema, webSiteSchema } from '@/components/seo/json-ld';
import { siteConfig } from '@/lib/site-config';

// No italic style: nothing on the site sets font-style, so shipping the
// italic face would double the display-font payload for zero rendered glyphs.
const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-display',
  display: 'swap',
});

const publicSans = Public_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name}: ${siteConfig.tagline}`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  openGraph: {
    type: 'website',
    siteName: siteConfig.name,
    images: [{ url: '/og/og-image.png', width: 1200, height: 630, alt: siteConfig.name }],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/og/og-image.png'],
  },
  robots: { index: true, follow: true },
};

// Matches the ink-900 body background defined in globals.css, so mobile
// browser chrome blends with the brand instead of flashing white.
export const viewport: Viewport = {
  themeColor: '#0B0E14',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${publicSans.variable}`}>
      <body className="font-sans">
        <a
          href="#main-content"
          className="sr-only z-[60] rounded-sm bg-brass px-4 py-2 text-sm font-semibold text-ink-900 focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
        >
          Skip to main content
        </a>
        <JsonLd data={organizationSchema()} />
        <JsonLd data={webSiteSchema()} />
        <Header />
        <main id="main-content">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
