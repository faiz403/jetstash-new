import type { Route } from '@/data/routes';
import type { Airport } from '@/data/airports';
import type { Destination } from '@/data/destinations';
import type { QuickAnswersContent } from '@/lib/seo-indexing-pilot';
import { formatRouteStatusDate } from '@/lib/route-status-copy';

/**
 * SEO indexing pilot (21 Oct 2026, three pages only — see
 * lib/seo-indexing-pilot.ts). Answers the questions people actually search
 * for on these routes ("is there a direct flight", "how long", "what days",
 * the airport codes) in plain sentences.
 *
 * The wording comes from getQuickAnswersContent(), which states only what
 * the route's cited primary source supports and is bound to that exact
 * verification check. The footer says what the source covers, so a reader
 * never takes a fact from another evidence basis as confirmed by it. The
 * caller passes content only while the route is current and unchanged, so
 * this component never decides eligibility itself. Deliberately no FAQPage
 * JSON-LD (see components/route/business-clarity-panel.tsx's note on why
 * the site has none).
 */
export function RouteQuickAnswers({
  route,
  content,
  airport,
  dest,
}: {
  route: Route;
  content: QuickAnswersContent;
  airport: Airport;
  dest: Destination;
}) {
  const verification = route.verification;
  if (!verification) return null;

  const answers: { q: string; a: string }[] = [
    { q: `Is there a direct flight from ${airport.city} to ${dest.city}?`, a: content.isDirect },
    ...(content.journeyTime ? [{ q: 'How long is the journey?', a: content.journeyTime }] : []),
    { q: 'How often does it run?', a: content.frequency },
    { q: 'Which airports?', a: `${airport.name} (${airport.code}) to ${dest.city} (${dest.iataCode}).` },
    { q: 'What if a search result says “self-transfer” or “separate tickets”?', a: content.selfTransfer },
  ];

  return (
    <div className="mt-8 max-w-3xl rounded-md border border-ink-100 bg-white p-6 sm:p-7">
      <h3 className="font-display text-xl text-ink-900">
        {airport.city} to {dest.city} ({airport.code} → {dest.iataCode}): quick answers
      </h3>
      <dl className="mt-4 space-y-4">
        {answers.map(({ q, a }) => (
          <div key={q}>
            <dt className="text-sm font-semibold text-ink-900">{q}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-ink-600">{a}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 border-t border-ink-100 pt-4 text-xs leading-relaxed text-ink-500">
        Checked {formatRouteStatusDate(verification.verifiedDate)} against{' '}
        {verification.sourceUrl ? (
          <a href={verification.sourceUrl} rel="noopener noreferrer" target="_blank" className="underline underline-offset-2 hover:text-terracotta-600">
            {verification.sourceName}
          </a>
        ) : (
          verification.sourceName
        )}
        , which supports {content.sourceSupports}. If that check is not renewed by {formatRouteStatusDate(verification.reviewDueDate)}, these
        quick answers and the route links below are withdrawn from this page. Always confirm your exact flights with the airline before booking.
      </p>
    </div>
  );
}
