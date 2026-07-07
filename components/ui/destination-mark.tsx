import { cn } from '@/lib/utils';

/**
 * DestinationMark — a locally rendered, on-brand destination panel used
 * everywhere a destination photograph will eventually sit.
 *
 * Why this exists instead of an <img>: there is currently no licensed
 * photography pipeline (see lib/images.ts), and shipping third-party
 * placeholder images (placehold.co) made every page depend on an external
 * service, slowed LCP, and looked like a template. This panel is rendered
 * entirely from the design system — zero network requests, always on-brand —
 * and is designed so real photography can replace it per-callsite later
 * without changing card layouts.
 *
 * The arc/dot motif is deterministic per label (same city always renders the
 * same composition) so the UI is stable across builds.
 */

function seedFrom(label: string): number {
  let h = 0;
  for (let i = 0; i < label.length; i++) {
    h = (h * 31 + label.charCodeAt(i)) % 997;
  }
  return h;
}

export function DestinationMark({
  label,
  sublabel,
  seed,
  className,
}: {
  /** Rendered on the panel in display type. Omit when the surrounding card already names the destination. */
  label?: string;
  sublabel?: string;
  /** Seed source for the motif when no label is shown. */
  seed?: string;
  className?: string;
}) {
  const seedText = seed ?? label ?? sublabel ?? 'JetStash';
  const seedValue = seedFrom(seedText);
  // Deterministic variation so a wall of cards doesn't repeat one identical graphic.
  const arcLift = 40 + (seedValue % 70); // how high the route arc bows
  const dotT = 0.62 + (seedValue % 5) * 0.06; // where along the arc the destination dot sits
  const x0 = -30;
  const y0 = 250 + (seedValue % 40);
  const cx = 190;
  const cy = arcLift;
  const x1 = 430;
  const y1 = 150 + (seedValue % 60);
  // Point on the quadratic Bézier at t = dotT
  const dotX = (1 - dotT) * (1 - dotT) * x0 + 2 * (1 - dotT) * dotT * cx + dotT * dotT * x1;
  const dotY = (1 - dotT) * (1 - dotT) * y0 + 2 * (1 - dotT) * dotT * cy + dotT * dotT * y1;

  // Deterministic per-seed grain filter id — several of these can render on
  // one page (a grid of fallback cards), so filter ids must not collide.
  const grainId = `mark-grain-${seedValue}`;

  return (
    <div
      className={cn(
        'relative flex h-full w-full flex-col items-start justify-end overflow-hidden bg-gradient-to-br from-ink-800 to-ink-950 p-5',
        className
      )}
      aria-hidden="true"
    >
      {/* Two-point light, not one: a warm glow from the top right (matches the
          real photography's golden-hour key light) and a faint cool lift from
          the bottom left, so the panel reads as a lit scene rather than a
          flat tinted rectangle. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(200,147,46,0.18),transparent_65%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(11,14,20,0.5),transparent_55%)]" />

      {/* Barely-there grain, the same "subtle film grain" the real photography
          brief calls for — the two card types should feel like one system,
          not "real photo" and "placeholder". */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.05] mix-blend-overlay">
        <filter id={grainId}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#${grainId})`} />
      </svg>

      <svg
        className="absolute inset-0 h-full w-full text-brass"
        viewBox="0 0 400 300"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <path
          d={`M ${x0} ${y0} Q ${cx} ${cy} ${x1} ${y1}`}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.3"
          strokeWidth="1.25"
          strokeDasharray="3 8"
          strokeLinecap="round"
        />
        <circle cx={dotX} cy={dotY} r="14" fill="currentColor" fillOpacity="0.1" />
        <circle cx={dotX} cy={dotY} r="10" fill="currentColor" fillOpacity="0.15" className="animate-pulse-dot" style={{ transformOrigin: `${dotX}px ${dotY}px` }} />
        <circle cx={dotX} cy={dotY} r="3.5" fill="currentColor" fillOpacity="0.95" />
      </svg>

      <span className="pointer-events-none absolute -right-3 -top-8 select-none font-display text-[7rem] leading-none text-sand-50/[0.045]">
        {seedText.charAt(0)}
      </span>

      {(label || sublabel) && (
        <div className="relative">
          {sublabel && (
            <span className="text-[11px] font-semibold uppercase tracking-wide text-brass-300">{sublabel}</span>
          )}
          {label && <span className="block font-display text-2xl leading-tight text-sand-50">{label}</span>}
        </div>
      )}
    </div>
  );
}
