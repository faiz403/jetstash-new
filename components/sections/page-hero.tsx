import { Badge } from '@/components/ui/badge';
import { HeroBackdrop } from '@/components/ui/hero-backdrop';
import { cn } from '@/lib/utils';

/**
 * PageHero — the shared premium hero for every secondary page.
 *
 * The homepage set the bar: dark ink surface, warm brass radial light,
 * staggered entrance. Every other page inherits that same arrival moment
 * from here, so no page on the site opens with a flat, static block.
 * `heroKey` opts the page into a photographic backdrop the moment
 * public/images/heroes/<heroKey>.* exists (see docs/visual-identity.md).
 *
 * Stats are optional and must be derived from real data at the callsite —
 * never hardcode a number here (see CLAUDE.md "No invented stats").
 */
export function PageHero({
  eyebrow,
  title,
  description,
  stats,
  heroKey,
  children,
  size = 'default',
  className,
  immediate = false,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Real, data-derived figures only. */
  stats?: { value: string; label: string }[];
  /** Key into public/images/heroes/ for an optional photographic backdrop. */
  heroKey?: string;
  children?: React.ReactNode;
  /** A shallower arrival moment for index pages where discovery should begin above the fold. */
  size?: 'default' | 'compact';
  /** Optional extra classes on the outer <section>, merged via cn() so a caller can
   * override the default padding (e.g. a short-viewport-only reduction) without every
   * other PageHero-based page being affected. Leave unset to keep the default exactly
   * as before. */
  className?: string;
  /**
   * Real-user validation, Stage A (30 Aug 2026): skips the staggered
   * entrance treatment for the h1 and children (the primary headline and
   * primary action) ONLY — they render fully visible from first paint
   * instead of starting at opacity:0 for ~0.75-0.95s. A real mobile tester
   * saw the badge and background but not the headline or buttons for about
   * a second and reported the page looked like it had failed to load (see
   * the Stage A diagnostic, Issue 4). Defaults to false — every existing
   * PageHero caller keeps the exact prior staggered arrival unchanged.
   * Eyebrow, description and stats keep their own entrance animation
   * either way; this is scoped to exactly the two elements the finding
   * was about, not a site-wide animation change.
   */
  immediate?: boolean;
}) {
  return (
    <section className={cn('relative overflow-hidden bg-ink-900', size === 'compact' ? 'py-12 sm:py-14' : 'py-16 sm:py-20', className)}>
      <HeroBackdrop heroKey={heroKey} />
      <div
        className="absolute -right-24 top-1/2 hidden h-[420px] w-[420px] -translate-y-1/2 rounded-full border border-white/[0.04] lg:block"
        aria-hidden="true"
      >
        <div className="absolute inset-8 rounded-full border border-white/[0.05]" />
        <div className="absolute inset-16 rounded-full border border-brass-500/10" />
      </div>
      <div className="relative mx-auto max-w-content px-5 sm:px-8">
        {eyebrow && (
          <div className="stagger-in stagger-1 animate-fade-up">
            <Badge variant="dark">{eyebrow}</Badge>
          </div>
        )}
        <h1
          className={cn(
            'mt-4 max-w-2xl font-display text-4xl leading-[1.08] tracking-tight text-sand-50 sm:text-5xl',
            !immediate && 'stagger-in stagger-2 animate-fade-up'
          )}
        >
          {title}
        </h1>
        {description && (
          <p className="stagger-in stagger-3 mt-4 max-w-xl animate-fade-up text-lg leading-relaxed text-ink-300">
            {description}
          </p>
        )}
        {stats && stats.length > 0 && (
          <dl className="stagger-in stagger-4 mt-8 flex animate-fade-up flex-wrap gap-x-10 gap-y-4 border-t border-white/10 pt-6">
            {stats.map((stat) => (
              <div key={stat.label} className="flex flex-col">
                <dt className="order-last text-xs font-semibold uppercase tracking-wide text-ink-300">{stat.label}</dt>
                <dd className="font-display text-3xl text-brass-300">{stat.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {children && (
          <div className={cn('mt-7', !immediate && 'stagger-in stagger-4 animate-fade-up')}>{children}</div>
        )}
      </div>
    </section>
  );
}
