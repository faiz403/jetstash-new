/**
 * Trip.com affiliate pause (founder decision, 4 November 2026).
 *
 * Trip.com's updated Online Cooperation Agreement raises questions JetStash has asked in writing and not yet had
 * answered (organic SEO, link parameters, editorial comparisons, redirects, the amendment's effective date). Until
 * Trip.com answers, the founder can pause every Trip.com affiliate handoff without a code change.
 *
 * Set NEXT_PUBLIC_TRIPCOM_AFFILIATE_PAUSED=true in the Vercel project's Production environment and redeploy. Resume
 * by removing the variable (or setting it to anything else) and redeploying. It is a NEXT_PUBLIC_ variable on purpose:
 * several client components resolve these links in the browser bundle, and a server-only variable would leave those
 * links live. Next.js inlines the value at build time, so a change only takes effect on the next deployment.
 *
 * While paused, every Trip.com flight and hotel lookup returns `null`. The existing fail-closed contract then applies
 * exactly as it already does for the routes JetStash has never had a Trip.com link for: no Trip.com CTA is rendered,
 * and the Google Flights search (labelled as earning no commission) is the only booking action. Route pages, dated fare
 * evidence and disclosures are untouched. This switch changes what JetStash links to; it does not decide what the
 * agreement means, and pausing does not by itself reverse any acceptance the agreement may already imply.
 */
export function isTripComAffiliatePaused(): boolean {
  return process.env.NEXT_PUBLIC_TRIPCOM_AFFILIATE_PAUSED === 'true';
}
