import Image from 'next/image';
import { cn } from '@/lib/utils';
import { getDestinationImage } from '@/lib/brand-images';
import { DestinationMark } from './destination-mark';

/**
 * The one way destination imagery is rendered anywhere on the site.
 *
 * Renders real photography from public/images/destinations/<slug>.* when it
 * exists (per docs/visual-identity.md), and the generated on-brand
 * <DestinationMark /> panel when it doesn't — so the site ships complete
 * today and upgrades one file-drop at a time, with zero code changes.
 *
 * `label`/`sublabel` render as a caption over both variants (photo gets a
 * legibility scrim), because some cards — destination index, deal cards,
 * the destination hero panel — carry the city name inside the visual itself.
 */
export function DestinationVisual({
  slug,
  label,
  sublabel,
  className,
  sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
}: {
  slug: string;
  /** Rendered on the panel in display type. Omit when the surrounding card already names the destination. */
  label?: string;
  sublabel?: string;
  className?: string;
  /** next/image sizes hint — defaults to the standard card grid. */
  sizes?: string;
}) {
  const image = getDestinationImage(slug);

  if (!image) {
    return (
      <DestinationMark
        label={label}
        sublabel={sublabel}
        seed={label ? undefined : slug}
        className={className}
      />
    );
  }

  return (
    <div className={cn('relative h-full w-full overflow-hidden', className)}>
      <Image src={image.src} alt={image.alt} fill sizes={sizes} className="object-cover" />
      {(label || sublabel) && (
        <>
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950/80 via-ink-950/10 to-transparent" />
          <div className="absolute bottom-0 left-0 p-5">
            {sublabel && (
              <span className="text-[11px] font-semibold uppercase tracking-wide text-brass-300">{sublabel}</span>
            )}
            {label && <span className="block font-display text-2xl leading-tight text-sand-50">{label}</span>}
          </div>
        </>
      )}
    </div>
  );
}
