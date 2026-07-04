import { Rocket, TrendingDown, RefreshCw, CalendarClock } from 'lucide-react';
import type { RouteTimelineEvent, RouteTimelineEventType } from '@/data/route-timeline';

const typeStyles: Record<RouteTimelineEventType, { icon: React.ReactNode; label: string }> = {
  'service-launched': { icon: <Rocket className="h-4 w-4" strokeWidth={2} />, label: 'Service launched' },
  'service-ended': { icon: <TrendingDown className="h-4 w-4" strokeWidth={2} />, label: 'Service ended' },
  'frequency-change': { icon: <RefreshCw className="h-4 w-4" strokeWidth={2} />, label: 'Frequency change' },
  'withdrawal-announced': { icon: <CalendarClock className="h-4 w-4" strokeWidth={2} />, label: 'Withdrawal announced' },
};

function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

/** Chronological log of real, dated changes to a route. Renders nothing if no events are recorded yet — history that hasn't been documented isn't shown as if it doesn't exist. */
export function RouteTimeline({ events }: { events: RouteTimelineEvent[] }) {
  if (events.length === 0) return null;

  return (
    <div className="flex flex-col gap-6">
      {events.map((event, index) => {
        const style = typeStyles[event.type];
        const isLast = index === events.length - 1;
        return (
          <div key={event.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink-200 bg-white text-terracotta-600">
                {style.icon}
              </div>
              {!isLast && <div className="mt-1.5 w-px flex-1 bg-ink-100" />}
            </div>
            <div className="pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">{formatEventDate(event.date)}</span>
                <span className="text-xs text-terracotta-600">· {style.label}</span>
              </div>
              <h3 className="mt-1 font-display text-lg text-ink-900">{event.title}</h3>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-500">{event.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
