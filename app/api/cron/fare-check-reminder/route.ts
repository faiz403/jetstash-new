import { NextRequest, NextResponse } from 'next/server';
import { getFounderSnapshot } from '@/lib/founder-insights';
import { sendResendEmail } from '@/lib/email';
import { siteConfig } from '@/lib/site-config';

/**
 * Weekly automated nudge (see vercel.json's cron schedule) for the two
 * pieces of intentional manual work the freshness system depends on:
 * someone actually checking a live fare, and someone re-checking a route's
 * own direct/connecting evidence before its review date lapses. This
 * endpoint detects and reports only — it never invents a price or a route
 * fact and never sends more than one summary email per run. Reuses
 * lib/founder-insights.ts's existing `bookby-cadence` and
 * `route-verification-review` sections (both already computed inside
 * `getFounderSnapshot()`) so the email and the /founder dashboard can never
 * disagree about what's overdue or due soon — no second freshness
 * calculation exists anywhere in this file.
 *
 * Route Intelligence Freshness Audit (3 September 2026): before this
 * change, only fare-check freshness had an automated push notification —
 * route-verification freshness (arguably the more foundational of the two,
 * since it's what the direct/connecting badge itself depends on) was
 * dashboard-only, meaning it depended entirely on a human remembering to
 * open a locally-gated page. This extension closes that asymmetry by
 * reusing the existing, already-tested `route-verification-review` section
 * rather than adding any new detection logic. It changes nothing about
 * cadence thresholds, review dates, route verification objects, or public
 * presentation — `Route.verification.reviewDueDate` already fails closed to
 * neutral "Verification pending" copy on its own via
 * getEffectiveRoutePresentation() (data/routes.ts), independent of whether
 * this email is ever read.
 *
 * Truth Reset (July 2026, TR-011): the fare-check subject line used to say
 * "N priority routes due a fare check" even when the real reason was a
 * missing departureDate on an otherwise-fresh observation — a different
 * problem needing a different action, not a stale price. The subject is
 * now generic and the body groups routes by their actual reason so it
 * never contradicts itself. The email also no longer links to /founder —
 * that page correctly 404s in production by design (see
 * app/founder/page.tsx's dashboardEnabled()) and must not be made public
 * just to give this email a working link; the body includes each route's
 * full detail text directly instead.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || cronSecret.trim().length === 0) {
    console.error('Fare-check reminder cron is not configured: CRON_SECRET is required.');
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const snapshot = getFounderSnapshot(new Date());
  const fareCadence = snapshot.grouped['nice-to-have']?.find((s) => s.id === 'bookby-cadence');
  const fareOverdue = fareCadence?.items.filter((i) => i.status === 'watch' || i.status === 'attention') ?? [];

  const routeVerification = snapshot.grouped['revenue']?.find((s) => s.id === 'route-verification-review');
  const routeOverdue = routeVerification?.items.filter((i) => i.status === 'attention') ?? [];
  const routeDueSoon = routeVerification?.items.filter((i) => i.status === 'watch') ?? [];

  if (fareOverdue.length === 0 && routeOverdue.length === 0 && routeDueSoon.length === 0) {
    return NextResponse.json({ sent: false, reason: 'Nothing overdue.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(
      'Freshness reminder due but no email provider is configured:',
      [...fareOverdue, ...routeOverdue, ...routeDueSoon].map((i) => i.label)
    );
    return NextResponse.json({ sent: false, reason: 'RESEND_API_KEY not set.' }, { status: 503 });
  }

  // Group by the actual reason (matched against bookByCadenceStatus's own
  // known detail strings, lib/founder-insights.ts) so the email never claims
  // "due a fare check" for a route that's actually fresh but missing a date
  // field — those are different problems needing different actions.
  const missingDate = fareOverdue.filter((i) => i.detail.includes('none record departureDate yet'));
  const staleOrOverdue = fareOverdue.filter((i) => i.detail.includes('days old'));
  const neverChecked = fareOverdue.filter((i) => i.detail.includes('No fare observations logged yet'));

  const routeVerificationSection: string[] = [];
  if (routeOverdue.length + routeDueSoon.length > 0) {
    const lines = [`Overdue: ${routeOverdue.length}`, `Due soon: ${routeDueSoon.length}`];
    if (routeOverdue.length > 0) {
      lines.push('', 'Overdue:', ...routeOverdue.map((i) => `- ${i.label}: ${i.detail}`));
    }
    if (routeDueSoon.length > 0) {
      lines.push('', 'Due soon:', ...routeDueSoon.map((i) => `- ${i.label}: ${i.detail}`));
    }
    routeVerificationSection.push(`ROUTE VERIFICATION\n\n${lines.join('\n')}`);
  }

  const fareSections: string[] = [];
  if (staleOrOverdue.length > 0) {
    fareSections.push(
      `Fare check needed (observation is aging or overdue):\n${staleOrOverdue.map((i) => `- ${i.label}: ${i.detail}`).join('\n')}`
    );
  }
  if (neverChecked.length > 0) {
    fareSections.push(`No fare ever logged yet:\n${neverChecked.map((i) => `- ${i.label}: ${i.detail}`).join('\n')}`);
  }
  if (missingDate.length > 0) {
    fareSections.push(
      `Fresh, but missing departure/return dates (a data-completeness issue, not a stale price):\n${missingDate.map((i) => `- ${i.label}: ${i.detail}`).join('\n')}`
    );
  }
  const fareVerificationSection = fareSections.length > 0 ? [`FARE CHECKS\n\n${fareSections.join('\n\n')}`] : [];

  const to = process.env.CONTACT_TO_EMAIL ?? siteConfig.contactEmail;
  const subjectParts: string[] = [];
  if (routeOverdue.length + routeDueSoon.length > 0) subjectParts.push(`${routeOverdue.length + routeDueSoon.length} route verification`);
  if (staleOrOverdue.length + neverChecked.length > 0) subjectParts.push(`${staleOrOverdue.length + neverChecked.length} fare check`);
  if (missingDate.length > 0) subjectParts.push(`${missingDate.length} missing dates`);

  const body = [...routeVerificationSection, ...fareVerificationSection].join('\n\n');

  const result = await sendResendEmail({
    apiKey,
    to,
    subject: `JetStash weekly freshness check: ${subjectParts.join(', ')}`,
    text: `${body}\n\nThis is the complete detail — there's no further link, since the Founder dashboard is intentionally not public. Run locally (or with FOUNDER_DASHBOARD_ENABLED=true set) to review interactively.`,
    replyTo: to,
    failureMessage: 'Could not send the freshness reminder email.',
  });

  if (!result.ok) {
    console.warn('Freshness reminder email failed to send:', result.message);
    return NextResponse.json({ sent: false, reason: result.message }, { status: result.status });
  }
  return NextResponse.json({
    sent: true,
    fareCount: fareOverdue.length,
    routeVerificationOverdueCount: routeOverdue.length,
    routeVerificationDueSoonCount: routeDueSoon.length,
  });
}
