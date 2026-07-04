/**
 * Image handling for JetStash.
 *
 * Current state: there is NO real photography pipeline yet. All destination
 * imagery across the site is rendered by the locally generated, on-brand
 * <DestinationMark /> panel (components/ui/destination-mark.tsx) — zero
 * external requests, never a broken image, always on-palette.
 *
 * History: the site previously used placehold.co placeholder images here.
 * (And before that, Unsplash's old "source.unsplash.com" redirect endpoint,
 * which Unsplash shut down in 2023.) Both made every page depend on a
 * third-party service for what is essentially decoration.
 *
 * When real photography is ready, do ONE of the following:
 *
 *   1. License or commission destination photography, place the files in
 *      /public/images/, and swap <DestinationMark /> call sites for
 *      <Image /> per destination.
 *
 *   2. Sign up for an Unsplash API key (unsplash.com/developers), resolve
 *      each destination to a real, stable photo URL, and hardcode those
 *      URLs into the data files (data/deals.ts, data/destinations.ts).
 *
 *   3. Use a stock library with a CDN (e.g. Cloudinary's free tier) and
 *      store the resulting URLs in the data files.
 *
 * `placeholderUrl` is kept only as a legacy escape hatch; nothing in the
 * app imports it any more. Prefer <DestinationMark /> until real photos exist.
 */

const PLACEHOLDER_BG = '0B0E14';
const PLACEHOLDER_FG = 'C8932E';

/** @deprecated Unused — all call sites now render <DestinationMark />. */
export function placeholderUrl(label: string, width = 800, height = 600): string {
  const text = encodeURIComponent(label);
  return `https://placehold.co/${width}x${height}/${PLACEHOLDER_BG}/${PLACEHOLDER_FG}?text=${text}&font=raleway`;
}
