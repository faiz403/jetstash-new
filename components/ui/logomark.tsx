/**
 * JetStash logomark — the pulled route.
 *
 * The glyph is the signature interaction drawn small: an origin point, the
 * route arc climbing away from it, the destination node, and the short
 * pull-tab hanging beneath — the journey you can pull open into a Brief.
 * Replaces the earlier circular "A" monogram, which had no explainable
 * meaning. One source of truth for header, footer and future surfaces;
 * single brass colour so it works at any size on dark or light ground.
 */
export function Logomark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      {/* origin */}
      <circle cx="6" cy="24.5" r="2" fill="#C8932E" />
      {/* the route, climbing */}
      <path
        d="M 6 24.5 C 11.5 15.5, 17.5 10.5, 25 9.5"
        stroke="#C8932E"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* destination node */}
      <circle cx="25" cy="9.5" r="2.6" stroke="#C8932E" strokeWidth="1.8" />
      {/* the pull-tab — the Brief waiting to be drawn out */}
      <path d="M 25 13.5 V 18.5" stroke="#C8932E" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
