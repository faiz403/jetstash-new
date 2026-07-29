// Report-only first (LAUNCH_CHECKLIST.md item A1): observe real violations before
// enforcing. Built from actual repo evidence, not guessed: no iframes, no external
// script/style tags, no client-side fetch to external hosts; Vercel Analytics/Speed
// Insights and Next.js's self-hosted next/font/google both stay same-origin, so
// 'self' covers them without extra allowlisted domains. style-src needs
// 'unsafe-inline' because several components set dynamic `style={{ ... }}` values
// (e.g. data-driven colours on the Atlas) rather than static Tailwind classes.
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // No remote image hosts: all destination imagery is rendered locally by
  // <DestinationMark />. Add remotePatterns back when real photography lands.
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Content-Security-Policy-Report-Only', value: CSP_REPORT_ONLY },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
