import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import type { RouteWarning, RouteWarningSeverity } from '@/data/route-warnings';
import { cn } from '@/lib/utils';

const severityStyles: Record<RouteWarningSeverity, { icon: React.ReactNode; iconWrap: string; border: string; label: string }> = {
  critical: {
    icon: <AlertTriangle className="h-4.5 w-4.5" strokeWidth={2} />,
    iconWrap: 'bg-terracotta-100 text-terracotta-700',
    border: 'border-terracotta-200 bg-terracotta-50',
    label: 'Critical',
  },
  caution: {
    icon: <AlertCircle className="h-4.5 w-4.5" strokeWidth={2} />,
    iconWrap: 'bg-brass-100 text-brass-700',
    border: 'border-brass-200 bg-brass-50',
    label: 'Caution',
  },
  info: {
    icon: <Info className="h-4.5 w-4.5" strokeWidth={2} />,
    iconWrap: 'bg-ink-100 text-ink-600',
    border: 'border-ink-200 bg-sand-50',
    label: 'Worth knowing',
  },
};

/**
 * Renders active route warnings — a route with no active warnings renders
 * nothing, not an empty section.
 *
 * Heading-structure fix (6 Sept 2026, full-site crawl finding): the
 * warning title is h2, not h3. WarningBanner has exactly one call site
 * (app/routes/[slug]/page.tsx) and FareSignal -- the only unconditionally
 * rendered content between the page's H1 and this banner -- renders no
 * heading of its own in any state; the Route Status/Journey Choice
 * sections that can precede it are each independently gated and don't
 * render for a route in this one's situation (leeds-bradford-islamabad:
 * disputed status, no journeyChoice). So this banner is effectively
 * always the first heading-bearing content after H1 whenever it renders,
 * not a subordinate of an established section -- h2 reflects that
 * directly, rather than assuming h3 from the previous single reproduced
 * page alone. On a route where Route Status's own h2 does render first,
 * this simply becomes a sibling h2, which is not a skip.
 */
export function WarningBanner({ warnings }: { warnings: RouteWarning[] }) {
  const active = warnings.filter((w) => w.status === 'active');
  if (active.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {active.map((warning) => {
        const style = severityStyles[warning.severity];
        return (
          <div key={warning.id} className={cn('flex flex-col gap-3 rounded-md border p-5 sm:flex-row sm:items-start', style.border)}>
            <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-sm', style.iconWrap)}>{style.icon}</div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">{style.label}</span>
              <h2 className="mt-0.5 font-display text-lg text-ink-900">{warning.title}</h2>
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-700">{warning.body}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
