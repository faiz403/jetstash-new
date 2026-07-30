import Image from 'next/image';
import { cn } from '@/lib/utils';
import { getHeroImage, type BrandImage } from '@/lib/brand-images';

/**
 * The standard backdrop for every dark hero — one component instead of the
 * same radial-gradient div repeated per page.
 *
 * With no photograph it renders the brand's brass radial glow exactly as
 * before. When public/images/heroes/<heroKey>.* exists (or an `image` is
 * passed directly, e.g. a destination photo behind a route hero), the photo
 * renders dimmed under an ink overlay plus the same radial glow — headline
 * contrast is guaranteed regardless of the photograph, per
 * docs/visual-identity.md.
 *
 * Parent section must be `relative overflow-hidden` (all dark heroes are).
 */
export function HeroBackdrop({
  heroKey,
  image,
  objectPositionClassName,
}: {
  heroKey?: string;
  image?: BrandImage | null;
  /**
   * Optional `object-position` utility class override (see e.g.
   * ROUTE_HERO_FOCAL_POSITION in app/routes/[slug]/page.tsx) — omit for the
   * default centred crop every hero has always used. Only ever set for a
   * photo whose composition needs it; this prop changes nothing for any
   * caller that doesn't pass it.
   */
  objectPositionClassName?: string;
}) {
  const resolved = image ?? (heroKey ? getHeroImage(heroKey) : null);

  if (!resolved) {
    return <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(200,147,46,0.12),transparent_60%)]" />;
  }

  return (
    <>
      <Image
        src={resolved.src}
        alt=""
        fill
        priority
        sizes="100vw"
        className={cn('object-cover', objectPositionClassName)}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-ink-950/75" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(200,147,46,0.12),transparent_60%)]" />
    </>
  );
}
