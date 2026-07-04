import { FileText, Luggage, Coins, Landmark, Compass } from 'lucide-react';
import type { TravellerTip, TravellerTipCategory } from '@/data/traveller-tips';

const categoryStyles: Record<TravellerTipCategory, { icon: React.ReactNode; label: string }> = {
  documents: { icon: <FileText className="h-4 w-4" strokeWidth={2} />, label: 'Documents' },
  baggage: { icon: <Luggage className="h-4 w-4" strokeWidth={2} />, label: 'Baggage' },
  money: { icon: <Coins className="h-4 w-4" strokeWidth={2} />, label: 'Money' },
  culture: { icon: <Landmark className="h-4 w-4" strokeWidth={2} />, label: 'Culture' },
  logistics: { icon: <Compass className="h-4 w-4" strokeWidth={2} />, label: 'Logistics' },
};

/** Curated, editorial traveller tips scoped to a route/destination/airport. Renders nothing if none exist for the given scope. */
export function TravellerTipList({ tips }: { tips: TravellerTip[] }) {
  if (tips.length === 0) return null;

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {tips.map((tip) => {
        const style = categoryStyles[tip.category];
        return (
          <div key={tip.id} className="rounded-md border border-ink-100 bg-sand-50 p-5">
            <div className="flex items-center gap-2 text-terracotta-600">
              {style.icon}
              <span className="text-xs font-semibold uppercase tracking-wide">{style.label}</span>
            </div>
            <h4 className="mt-2.5 font-display text-base text-ink-900">{tip.title}</h4>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{tip.body}</p>
          </div>
        );
      })}
    </div>
  );
}
