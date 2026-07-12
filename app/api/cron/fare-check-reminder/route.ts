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
 * Protected by CRON_SECRET (Vercel sets this automatically for its own Cron
 * Jobs when the env var is configured; see README's "Environment variables").
 * Fails clearly (logs, 503) if RESEND_API_KEY isn't set — same fail-clear
 * convention as every other email-sending route in this app.
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

  const to = process.env.CONTACT_TO_EMAIL ?? siteConfig.contactEmail;
  const lines = overdue.map((i) => `- ${i.label}: ${i.detail}`);
  const result = await sendResendEmail({
    apiKey,
    to,
    subject: `JetStash: ${overdue.length} priority route${overdue.length === 1 ? '' : 's'} due a fare check`,
    text: `${lines.join('\n')}\n\nFull detail: ${siteConfig.url}/founder`,
    replyTo: to,
    failureMessage: 'Could not send the fare-check reminder email.',
  });

  if (!result.ok) {
    console.warn('Fare-check reminder email failed to send:', result.message);
    return NextResponse.json({ sent: false, reason: result.message }, { status: result.status });
  }
  return NextResponse.json({ sent: true, count: overdue.length });
}
