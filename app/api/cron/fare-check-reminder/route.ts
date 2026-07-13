import { NextRequest, NextResponse } from 'next/server';
import { getFounderSnapshot } from '@/lib/founder-insights';
import { sendResendEmail } from '@/lib/email';
import { siteConfig } from '@/lib/site-config';

/**
 * Weekly automated nudge (see vercel.json's cron schedule) for the one piece
 * of intentional manual work the fare-freshness system depends on: someone
 * actually checking a live fare. This endpoint detects and reports only — it
 * never invents a price and never sends more than one summary email per run.
 * Reuses lib/founder-insights.ts's existing `bookby-cadence` section so the
 * email and the /founder dashboard can never disagree about what's overdue.
 *
 * Truth Reset (July 2026, TR-011): the subject line used to say "N priority
 * routes due a fare check" even when the real reason was a missing
 * departureDate on an otherwise-fresh observation — a different problem
 * needing a different action, not a stale price. The subject is now
 * generic ("need fare-data attention") and the body groups routes by their
 * actual reason so it never contradicts itself. The email also no longer
 * links to /founder — that page correctly 404s in production by design (see
 * app/founder/page.tsx's dashboardEnabled()) and must not be made public
 * just to give this email a working link; the body includes each route's
 * full detail text directly instead.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const snapshot = getFounderSnapshot(new Date());
  const cadence = snapshot.grouped['nice-to-have'].find((s) => s.id === 'bookby-cadence');
  const overdue = cadence?.items.filter((i) => i.status === 'watch' || i.status === 'attention') ?? [];

  if (overdue.length === 0) {
    return NextResponse.json({ sent: false, reason: 'Nothing overdue.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('Fare-check reminder due but no email provider is configured:', overdue.map((i) => i.label));
    return NextResponse.json({ sent: false, reason: 'RESEND_API_KEY not set.' }, { status: 503 });
  }

  // Group by the actual reason (matched against bookByCadenceStatus's own
  // known detail strings, lib/founder-insights.ts) so the email never claims
  // "due a fare check" for a route that's actually fresh but missing a date
  // field — those are different problems needing different actions.
  const missingDate = overdue.filter((i) => i.detail.includes('none record departureDate yet'));
  const staleOrOverdue = overdue.filter((i) => i.detail.includes('days old'));
  const neverChecked = overdue.filter((i) => i.detail.includes('No fare observations logged yet'));

  const sections: string[] = [];
  if (staleOrOverdue.length > 0) {
    sections.push(
      `Fare check needed (observation is aging or overdue):\n${staleOrOverdue.map((i) => `- ${i.label}: ${i.detail}`).join('\n')}`
    );
  }
  if (neverChecked.length > 0) {
    sections.push(`No fare ever logged yet:\n${neverChecked.map((i) => `- ${i.label}: ${i.detail}`).join('\n')}`);
  }
  if (missingDate.length > 0) {
    sections.push(
      `Fresh, but missing departure/return dates (a data-completeness issue, not a stale price):\n${missingDate.map((i) => `- ${i.label}: ${i.detail}`).join('\n')}`
    );
  }

  const to = process.env.CONTACT_TO_EMAIL ?? siteConfig.contactEmail;
  const subjectParts: string[] = [];
  if (staleOrOverdue.length + neverChecked.length > 0) subjectParts.push(`${staleOrOverdue.length + neverChecked.length} due a check`);
  if (missingDate.length > 0) subjectParts.push(`${missingDate.length} missing dates`);

  const result = await sendResendEmail({
    apiKey,
    to,
    subject: `JetStash: ${overdue.length} priority route${overdue.length === 1 ? '' : 's'} need fare-data attention (${subjectParts.join(', ')})`,
    text: `${sections.join('\n\n')}\n\nThis is the complete detail — there's no further link, since the Founder dashboard is intentionally not public. Run locally (or with FOUNDER_DASHBOARD_ENABLED=true set) to review interactively.`,
    replyTo: to,
    failureMessage: 'Could not send the fare-check reminder email.',
  });

  if (!result.ok) {
    console.warn('Fare-check reminder email failed to send:', result.message);
    return NextResponse.json({ sent: false, reason: result.message }, { status: result.status });
  }
  return NextResponse.json({ sent: true, count: overdue.length });
}
