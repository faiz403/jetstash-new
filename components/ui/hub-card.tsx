import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { placeholderUrl } from '@/lib/images';

export function HubCard({
  href,
  eyebrow,
  title,
  description,
  size = 'md',
  tone = 'light',
  image,
}: {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
  size?: 'md' | 'lg';
  tone?: 'light' | 'dark';
  image?: string;
}) {
  const hasImage = Boolean(image);

  return (
    <Link
      href={href}
      className={cn(
        'group relative flex flex-col justify-between overflow-hidden rounded-md border p-6 transition-all duration-300 hover:-translate-y-1',
        size === 'lg' ? 'min-h-[320px] p-8' : 'min-h-[220px]',
        hasImage
          ? 'border-white/10'
          : tone === 'dark'
            ? 'border-white/10 bg-ink-800 hover:border-brass/40'
            : 'border-ink-100 bg-white shadow-card hover:shadow-card-hover'
      )}
    >
      {hasImage && (
        <>
          <Image
            src={image ?? placeholderUrl(title)}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950/90 via-ink-950/40 to-ink-950/10" />
        </>
      )}

      <div className="relative z-10">
        <span
          className={cn(
            'text-xs font-semibold uppercase tracking-wide',
            hasImage ? 'text-brass-300' : tone === 'dark' ? 'text-brass-300' : 'text-terracotta-600'
          )}
        >
          {eyebrow}
        </span>
        <h3
          className={cn(
            'mt-2 font-display leading-tight',
            size === 'lg' ? 'text-3xl' : 'text-2xl',
            hasImage ? 'text-sand-50' : tone === 'dark' ? 'text-sand-50' : 'text-ink-900'
          )}
        >
          {title}
        </h3>
        <p
          className={cn(
            'mt-2 text-sm leading-relaxed',
            hasImage ? 'text-ink-200' : tone === 'dark' ? 'text-ink-300' : 'text-ink-500'
          )}
        >
          {description}
        </p>
      </div>
      <div
        className={cn(
          'relative z-10 mt-4 flex items-center gap-1.5 text-sm font-semibold',
          hasImage ? 'text-brass-300' : tone === 'dark' ? 'text-brass-300' : 'text-ink-900'
        )}
      >
        Explore
        <ArrowUpRight
          className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          strokeWidth={2.25}
        />
      </div>
    </Link>
  );
}
