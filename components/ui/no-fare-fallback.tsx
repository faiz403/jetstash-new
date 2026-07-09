import { SearchX, ArrowUpRight } from 'lucide-react';
import { getGeneralBookingUrl, getPrimaryBookingProvider } from '@/lib/booking-providers';

/**
 * Shown wherever a destination/route/cabin combination has no fare
 * observations logged yet. Deliberately avoids implying that fares exist
 * elsewhere and are just hidden — it directs the visitor straight to a
 * live partner search.
 */
export function NoFareFallback({ cityLabel }: { cityLabel: string }) {
  const provider = getPrimaryBookingProvider();
  return (
    <div className="flex flex-col items-center rounded-md border border-dashed border-ink-200 bg-white px-6 py-12 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-ink-50 text-ink-400">
        <SearchX className="h-5 w-5" strokeWidth={2} />
      </div>
      <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-600">
        We haven't logged a tracked fare for {cityLabel} yet. Check live prices with our travel partners.
      </p>
      <a
        href={getGeneralBookingUrl(cityLabel)}
        target="_blank"
        rel={provider.rel}
        className="mt-5 inline-flex items-center gap-1.5 rounded-sm bg-ink-900 px-5 py-3 text-sm font-semibold text-sand-50 transition-all hover:bg-brass-600 active:scale-[0.985]"
      >
        Search live prices
        <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
      </a>
      <p className="mt-3 text-xs text-ink-400">Partner link · opens {provider.name} in a new tab</p>
    </div>
  );
}
