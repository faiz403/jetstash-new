/**
 * Image handling for JetStash.
 *
 * IMPORTANT — read before deploying:
 * Unsplash's old "source.unsplash.com" redirect endpoint was shut down by
 * Unsplash in 2023. It will NOT work in production. There is no drop-in
 * free replacement that resolves an arbitrary text query to a photo URL
 * without an API key.
 *
 * Before launch, do ONE of the following:
 *
 *   1. Sign up for a free Unsplash API key at unsplash.com/developers,
 *      then call the Unsplash Search API to resolve each `imageQuery`
 *      value below to a real, stable photo URL, and hardcode those URLs
 *      into the data files (data/deals.ts, data/destinations.ts).
 *
 *   2. License or commission your own destination photography and place
 *      the files in /public/images/, referencing them directly.
 *
 *   3. Use a stock library with a CDN (e.g. Cloudinary's free tier) and
 *      store the resulting URLs in the data files.
 *
 * Until one of those is done, `placeholderUrl` below renders a clean,
 * on-brand placeholder instead of a broken image — this is deliberate so
 * the site never ships with broken <img> tags pointing at a dead service.
 */

const PLACEHOLDER_BG = '0B0E14';
const PLACEHOLDER_FG = 'C8932E';

/**
 * Returns a safe on-brand placeholder image URL until real photography is
 * wired up. Replace call sites with real licensed image URLs before launch.
 */
export function placeholderUrl(label: string, width = 800, height = 600): string {
  const text = encodeURIComponent(label);
  return `https://placehold.co/${width}x${height}/${PLACEHOLDER_BG}/${PLACEHOLDER_FG}?text=${text}&font=raleway`;
}
