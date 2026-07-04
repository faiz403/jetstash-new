import { Users, FileCheck, Briefcase, Calendar } from 'lucide-react';
import type { FamilyVisitContent } from '@/data/destinations';
import { getPeakPeriodsByIds } from '@/data/peak-periods';
import { Badge } from '@/components/ui/badge';

export function FamilyVisitBlock({ content, city }: { content: FamilyVisitContent; city: string }) {
  return (
    <section className="bg-ink-900 py-16 sm:py-20">
      <div className="mx-auto max-w-content px-5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <Users className="h-5 w-5 text-brass-300" strokeWidth={2} />
          <span className="text-xs font-semibold uppercase tracking-wide text-brass-300">Visiting family in {city}</span>
        </div>
        <h2 className="mt-3 max-w-2xl font-display text-2xl leading-tight text-sand-50 sm:text-3xl">
          The detail that matters when this is a family trip, not a holiday
        </h2>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <div className="rounded-md border border-white/10 bg-ink-800 p-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-brass/10 text-brass-300">
              <Calendar className="h-4.5 w-4.5" strokeWidth={2} />
            </div>
            <h3 className="mt-4 font-display text-lg text-sand-50">How this trip usually works</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-300">{content.travelPattern}</p>
          </div>

          <div className="rounded-md border border-white/10 bg-ink-800 p-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-brass/10 text-brass-300">
              <FileCheck className="h-4.5 w-4.5" strokeWidth={2} />
            </div>
            <h3 className="mt-4 font-display text-lg text-sand-50">Documents & entry</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-300">{content.documentNote}</p>
          </div>

          <div className="rounded-md border border-white/10 bg-ink-800 p-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-brass/10 text-brass-300">
              <Briefcase className="h-4.5 w-4.5" strokeWidth={2} />
            </div>
            <h3 className="mt-4 font-display text-lg text-sand-50">Baggage & packing</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-300">{content.packingNote}</p>
          </div>

          <div className="rounded-md border border-white/10 bg-ink-800 p-6">
            <h3 className="font-display text-lg text-sand-50">When demand peaks</h3>
            <p className="mt-1 text-xs text-ink-400">Book 2–3 months ahead of these windows where dates are fixed</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {getPeakPeriodsByIds(content.peakPeriodIds).map((period) => (
                <Badge key={period.id} variant="dark">{period.label}</Badge>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-6 max-w-2xl text-xs text-ink-400">
          Visa and identity document requirements change — always confirm directly with the relevant high
          commission, embassy, or NADRA/OCI portal before booking, rather than relying on a previous trip.
        </p>
      </div>
    </section>
  );
}
