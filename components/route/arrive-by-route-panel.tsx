import Link from 'next/link';
import { Clock } from 'lucide-react';

export function ArriveByRoutePanel({ departureAirport, arrivalAirport }: { departureAirport: string; arrivalAirport: string }) {
  return <section className="bg-sand-50 py-10 sm:py-12" aria-labelledby="arrive-by-route-heading">
    <div className="mx-auto max-w-content px-5 sm:px-8">
      <div className="max-w-2xl rounded-md border border-ink-100 bg-white p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-ink-900 text-brass-300"><Clock className="h-4.5 w-4.5" strokeWidth={2} /></span>
          <div>
            <h2 id="arrive-by-route-heading" className="font-display text-2xl text-ink-900">When should I leave?</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">Plan the full journey from home to your final destination using your own flight times.</p>
            <Link href={`/arrive-by?departure=${departureAirport}&arrival=${arrivalAirport}`} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-900 underline decoration-brass-400 decoration-2 underline-offset-4 hover:text-terracotta-600">
              Plan with Arrive By
            </Link>
          </div>
        </div>
      </div>
    </div>
  </section>;
}
