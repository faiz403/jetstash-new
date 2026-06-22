import Image from 'next/image';
import { Deal, DealCabin, formatChecked } from '@/data/deals';
import { Plane, Calendar, ArrowUpRight } from 'lucide-react';
import { Badge } from './badge';
import { placeholderUrl } from '@/lib/images';

const cabinLabel: Record<DealCabin, string> = {
  Economy: 'Economy',
  'Premium Economy': 'Premium Economy',
  Business: 'Business class',
};

export function DealCard({ deal }: { deal: Deal }) {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-md border border-ink-100 bg-white shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover">
      <div className="relative h-40 w-full overflow-hidden">
        <Image
          src={placeholderUrl(deal.toCity)}
          alt={`${deal.toCity}, ${deal.toCountry}`}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
          <Plane className="h-3.5 w-3.5" strokeWidth={2.25} />
          {deal.fromCity} → {deal.toCity}
        </span>
        {deal.tag && <Badge variant={deal.cabin === 'Business' ? 'terracotta' : 'brass'}>{deal.tag}</Badge>}
      </div>

      <div className="flex flex-1 flex-col px-5 py-5">
        <h3 className="font-display text-2xl leading-tight text-ink-900">{deal.toCity}</h3>
        <p className="mt-0.5 text-sm text-ink-400">{deal.toCountry}</p>

        <div className="mt-4 flex items-baseline gap-2">
          <span className="font-display text-3xl tracking-tight text-ink-900">£{deal.indicativePrice.toLocaleString('en-GB')}</span>
          <span className="text-sm text-ink-400">{deal.priceNote}</span>
        </div>
        <p className="mt-0.5 text-xs font-medium text-terracotta-600">Indicative price — prices change quickly</p>

        <p className="mt-1 text-sm font-medium text-ink-500">{deal.airline} · {cabinLabel[deal.cabin]}</p>

        <div className="mt-4 flex items-center gap-1.5 text-xs text-ink-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <Calendar className="h-3.5 w-3.5" strokeWidth={2} />
          Example fare checked {formatChecked(deal.lastChecked)}
        </div>

        <a
          href={deal.partnerUrl}
          target="_blank"
          rel="nofollow sponsored noopener noreferrer"
          className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-sm bg-ink-900 px-4 py-3 text-sm font-semibold text-sand-50 transition-colors duration-200 hover:bg-brass-600"
        >
          Check live price
          <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
        </a>
        <p className="mt-2 text-center text-[10px] text-ink-400">Partner link · indicative</p>
      </div>
    </article>
  );
}
