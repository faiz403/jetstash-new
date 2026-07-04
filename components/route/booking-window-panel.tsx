import { CalendarRange } from 'lucide-react';
import type { BookingWindow } from '@/data/booking-windows';

function formatWeeks(range: { min: number; max: number }): string {
  if (range.min === 0) return `Within ${range.max} weeks of departure`;
  return `${range.min}–${range.max} weeks before departure`;
}

/** Structured booking-window guidance, additive to the route's prose bookingWindowNote. Renders nothing if no structured windows exist for this route. */
export function BookingWindowPanel({ windows }: { windows: BookingWindow[] }) {
  if (windows.length === 0) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {windows.map((window) => (
        <div key={window.id} className="rounded-md border border-ink-100 bg-white p-5">
          <div className="flex items-center gap-2">
            <CalendarRange className="h-4 w-4 text-terracotta-600" strokeWidth={2} />
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">{formatWeeks(window.weeksBeforeDeparture)}</span>
          </div>
          <h4 className="mt-2 font-display text-base text-ink-900">{window.label}</h4>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{window.guidance}</p>
        </div>
      ))}
    </div>
  );
}
