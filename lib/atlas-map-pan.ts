/**
 * Mobile Route Atlas pan target (homepage correction sprint, 23 Oct 2026).
 *
 * Below `sm` the Atlas map is a fixed-width SVG (about 800 CSS px, so its
 * labels stay legible) inside a horizontally scrollable strip. Selecting a
 * country or destination must bring that place into view, so this returns the
 * scrollLeft that centres a map point (in SVG user units) in the strip.
 *
 * Pure so it can be unit-tested: `viewBoxMinX` / `viewBoxWidth` describe the
 * SVG's viewBox, `svgPixelWidth` is its rendered width, and the strip is
 * `clientWidth` wide with `scrollWidth` of content. Returns null when the strip
 * does not scroll (desktop, where the map fits its container).
 */
export function getMapPanScrollLeft(input: {
  pointX: number;
  viewBoxMinX: number;
  viewBoxWidth: number;
  svgPixelWidth: number;
  clientWidth: number;
  scrollWidth: number;
  /** Left padding of the strip: the SVG starts this many px into the scrollable content. */
  leadingOffset?: number;
}): number | null {
  const { pointX, viewBoxMinX, viewBoxWidth, svgPixelWidth, clientWidth, scrollWidth, leadingOffset = 0 } = input;
  if (!(viewBoxWidth > 0) || !(svgPixelWidth > 0) || scrollWidth <= clientWidth + 4) return null;
  const pointPx = ((pointX - viewBoxMinX) / viewBoxWidth) * svgPixelWidth + leadingOffset;
  const maxLeft = scrollWidth - clientWidth;
  return Math.round(Math.min(maxLeft, Math.max(0, pointPx - clientWidth / 2)));
}
