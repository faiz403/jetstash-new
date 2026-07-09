import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarCheck,
  CheckCircle2,
  Circle,
  Eye,
  PlugZap,
} from 'lucide-react';
import {
  getFounderSnapshot,
  type BusinessPriority,
  type FounderItem,
  type FounderSection,
  type FounderStatus,
} from '@/lib/founder-insights';
import { HeroBackdrop } from '@/components/ui/hero-backdrop';
import { cn } from '@/lib/utils';

/**
 * Founder Command Centre — private, internal, one page.
 *
 * Leads with business priority, not raw technical status: every section is
 * grouped into launch blockers (broken or dishonest right now), revenue
 * opportunities (working, but leaving money on the table) and nice-to-have
 * improvements (polish, no deadline) — see BusinessPriority in
 * lib/founder-insights.ts for the exact definitions. Every figure is
 * derived at request time from the /data files and env vars; nothing here
 * is analytics or a guess.
 *
 * Access: available on localhost (npm run dev / start). In production it
 * 404s unless FOUNDER_DASHBOARD_ENABLED=true is set — the safe default is
 * that this page does not exist publicly. If you later enable it in
 * production, put real auth in front of it first.
 */

export const dynamic = 'force-dynamic';

function dashboardEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.FOUNDER_DASHBOARD_ENABLED === 'true';
}

// generateMetadata rather than a static export so the production 404 doesn't
// leak the page title in its <head>.
export async function generateMetadata(): Promise<Metadata> {
  if (!dashboardEnabled()) return { robots: { index: false, follow: false } };
  return {
    title: 'Founder Command Centre',
    robots: { index: false, follow: false },
  };
}

const statusStyles: Record<FounderStatus, { label: string; chip: string; dot: string }> = {
  attention: { label: 'Needs attention', chip: 'bg-terracotta-50 text-terracotta-700 border-terracotta-200', dot: 'bg-terracotta-500' },
  watch: { label: 'Watch', chip: 'bg-brass-50 text-brass-700 border-brass-200', dot: 'bg-brass-500' },
  setup: { label: 'Needs setup', chip: 'bg-ink-100 text-ink-700 border-ink-200', dot: 'bg-ink-500' },
  ok: { label: 'OK', chip: 'bg-sand-100 text-ink-600 border-ink-100', dot: 'bg-brass-300' },
};

const priorityZones: { key: BusinessPriority; title: string; subhead: string }[] = [
  { key: 'blocker', title: 'Launch blockers', subhead: 'Broken or dishonest right now — fix before treating this as genuinely live.' },
  { key: 'revenue', title: 'Revenue opportunities', subhead: 'Working today, but leaving money or conversion on the table.' },
  { key: 'nice-to-have', title: 'Nice-to-have improvements', subhead: 'Polish and enrichment. No deadline.' },
];

const priorityBadgeStyles: Record<BusinessPriority, string> = {
  blocker: 'bg-terracotta-50 text-terracotta-700 border-terracotta-200',
  revenue: 'bg-brass-50 text-brass-700 border-brass-200',
  'nice-to-have': 'bg-ink-100 text-ink-600 border-ink-200',
};

const priorityBadgeLabel: Record<BusinessPriority, string> = {
  blocker: 'Blocker',
  revenue: 'Revenue',
  'nice-to-have': 'Nice-to-have',
};

function StatusChip({ status }: { status: FounderStatus }) {
  const style = statusStyles[status];
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold', style.chip)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', style.dot)} />
      {style.label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: BusinessPriority }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', priorityBadgeStyles[priority])}>
      {priorityBadgeLabel[priority]}
    </span>
  );
}

function ItemRow({ item }: { item: FounderItem }) {
  const inner = (
    <>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink-900">{item.label}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-ink-500">{item.detail}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <StatusChip status={item.status} />
        {item.href && <ArrowUpRight className="h-4 w-4 text-ink-400" strokeWidth={2} />}
      </div>
    </>
  );
  const classes = 'flex items-start justify-between gap-4 px-5 py-3.5';
  if (item.href) {
    return (
      <Link href={item.href} className={cn(classes, 'transition-colors hover:bg-sand-50')}>
        {inner}
      </Link>
    );
  }
  return <div className={classes}>{inner}</div>;
}

function SectionCard({ section }: { section: FounderSection }) {
  return (
    <section id={section.id} className="overflow-hidden rounded-md border border-ink-100 bg-white shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
        <h3 className="font-display text-lg text-ink-900">{section.title}</h3>
        <StatusChip status={section.status} />
      </div>
      <p className="px-5 pt-4 text-sm leading-relaxed text-ink-600">{section.headline}</p>
      {section.items.length > 0 && (
        <div className="mt-3 flex flex-col divide-y divide-ink-100 border-t border-ink-100">
          {section.items.map((item) => (
            <ItemRow key={`${item.label}-${item.detail.slice(0, 24)}`} item={item} />
          ))}
        </div>
      )}
      {section.action && (
        <p className="border-t border-ink-100 bg-sand-50 px-5 py-3 text-xs leading-relaxed text-ink-500">
          <span className="font-semibold text-ink-700">Do: </span>
          {section.action}
        </p>
      )}
    </section>
  );
}

export default function FounderPage() {
  // Safe default: this page does not exist in production. Opt in later with
  // FOUNDER_DASHBOARD_ENABLED=true — and add real auth before doing so.
  if (!dashboardEnabled()) {
    notFound();
  }

  const now = new Date();
  const { grouped, checklist, checklistDone, today } = getFounderSnapshot(now);
  const blockerCount = grouped.blocker.filter((s) => s.status !== 'ok').length;
  const revenueCount = grouped.revenue.filter((s) => s.status !== 'ok').length;

  return (
    <>
      <section className="relative overflow-hidden bg-ink-900 py-12 sm:py-14">
        <HeroBackdrop />
        <div className="relative mx-auto max-w-content px-5 sm:px-8">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brass-300">
            <Eye className="h-4 w-4" strokeWidth={2} />
            Private · not linked anywhere public · 404s in production
          </div>
          <h1 className="mt-3 font-display text-3xl tracking-tight text-sand-50 sm:text-4xl">Founder Command Centre</h1>
          <p className="mt-2 max-w-xl text-ink-300">
            {today.length === 0
              ? "Nothing needs your attention today. Everything below is derived live from the site's own data."
              : `${blockerCount} launch blocker${blockerCount === 1 ? '' : 's'} · ${revenueCount} revenue opportunit${revenueCount === 1 ? 'y' : 'ies'} open. All derived live from the site's own data, nothing estimated.`}
          </p>
          <p className="mt-3 flex items-center gap-2 text-xs text-ink-400">
            <CalendarCheck className="h-4 w-4" strokeWidth={2} />
            Snapshot generated {now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </section>

      {today.length > 0 && (
        <section className="border-b border-white/5 bg-ink-950 py-6">
          <div className="mx-auto max-w-content px-5 sm:px-8">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-brass-300">Today</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {today.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="group flex items-start gap-3 rounded-sm border border-white/10 bg-white/[0.03] px-4 py-3 transition-colors hover:border-brass/40 hover:bg-white/[0.06]"
                >
                  {item.status === 'attention' ? (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-terracotta-400" strokeWidth={2} />
                  ) : item.status === 'setup' ? (
                    <PlugZap className="mt-0.5 h-4 w-4 shrink-0 text-brass-300" strokeWidth={2} />
                  ) : (
                    <Circle className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" strokeWidth={2} />
                  )}
                  <span>
                    <span className="block text-sm font-semibold text-sand-50">{item.label}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-ink-400">{item.detail}</span>
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="bg-sand-50 py-10 sm:py-12">
        <div className="mx-auto flex max-w-content flex-col gap-10 px-5 sm:px-8">
          {priorityZones.map((zone) => {
            const sections = grouped[zone.key];
            if (sections.length === 0) return null;
            return (
              <div key={zone.key}>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className="font-display text-xl text-ink-900 sm:text-2xl">{zone.title}</h2>
                  <span className="text-sm text-ink-500">{zone.subhead}</span>
                </div>
                <div className="mt-4 grid gap-6 lg:grid-cols-2">
                  {sections.map((section) => (
                    <SectionCard key={section.id} section={section} />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Launch checklist gets full width — it's the long-term map, mirroring the README 1:1. */}
          <section id="launch" className="overflow-hidden rounded-md border border-ink-100 bg-white shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
              <h2 className="font-display text-lg text-ink-900">Launch checklist</h2>
              <span className="text-sm font-semibold tabular-nums text-ink-600">
                {checklistDone} / {checklist.length}
              </span>
            </div>
            <div
              className="h-1.5 w-full bg-ink-50"
              role="progressbar"
              aria-valuenow={checklistDone}
              aria-valuemin={0}
              aria-valuemax={checklist.length}
              aria-label="Launch checklist progress"
            >
              <div className="h-full bg-brass" style={{ width: `${(checklistDone / checklist.length) * 100}%` }} />
            </div>
            <div className="flex flex-col divide-y divide-ink-100">
              {checklist.map((item) => (
                <div key={item.label} className="flex items-start gap-3 px-5 py-3.5">
                  {item.done ? (
                    <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0 text-brass-600" strokeWidth={2} />
                  ) : (
                    <Circle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-ink-300" strokeWidth={2} />
                  )}
                  <div className="min-w-0">
                    <p className={cn('flex flex-wrap items-center gap-2 text-sm font-semibold', item.done ? 'text-ink-500 line-through decoration-ink-300' : 'text-ink-900')}>
                      {item.label}
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                        {item.verifiedBy === 'auto' ? 'auto-checked' : 'manual'}
                      </span>
                      <PriorityBadge priority={item.priority} />
                    </p>
                    <p className="mt-0.5 text-sm leading-relaxed text-ink-500">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="border-t border-ink-100 bg-sand-50 px-5 py-3 text-xs leading-relaxed text-ink-500">
              Mirrors README &ldquo;Required before launch&rdquo;. The README stays the source of truth; auto-checked items
              re-verify from code and env on every load of this page.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
