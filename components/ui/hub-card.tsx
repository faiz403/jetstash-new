import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BrandImage } from '@/lib/brand-images';
import { DestinationMark } from './destination-mark';

export function HubCard({
  href,
  eyebrow,
  title,
  description,
  size = 'md',
  image,
}: {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
  size?: 'md' | 'lg';
  /** Resolved brand photo (getHeroImage/getDestinationImage) — falls back to the generated panel when null/omitted. */
  image?: BrandImage | null;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group relative flex flex-col justify-between overflow-hidden rounded-md border border-white/10 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-brass/40 hover:shadow-card-hover',
        size === 'lg' ? 'min-h-[320px] p-8' : 'min-h-[240px]'
      )}
    >
      <div className="absolute inset-0">
        {image ? (
          <Image
            src={image.src}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            aria-hidden="true"
          />
        ) : (
          <DestinationMark seed={title} className="p-0" />
        )}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-ink-950/80 via-ink-950/20 to-transparent" />

      <div className="relative z-10">
        <span className="text-xs font-semibold uppercase tracking-wide text-brass-300">{eyebrow}</span>
        <h3 className={cn('mt-2 font-display leading-tight text-sand-50', size === 'lg' ? 'text-3xl' : 'text-2xl')}>
          {title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-ink-200">{description}</p>
      </div>
      <div className="relative z-10 mt-4 flex items-center gap-1.5 text-sm font-semibold text-brass-300">
        Explore
        <ArrowUpRight
          className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          strokeWidth={2.25}
        />
      </div>
    </Link>
  );
}
