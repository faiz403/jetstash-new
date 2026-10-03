/**
 * Accessibility production pass (27 Aug 2026): the label line ("Flight time" /
 * "Frequency" / "Airlines") was `text-ink-400`, which measures ~4.0:1 against
 * this component's dark route-hero surface — short of WCAG AA's 4.5:1 for
 * normal-size text. Same defect class the Route Atlas fix (LAUNCH_CHECKLIST.md
 * A11, 7 Aug 2026) already corrected there — `text-ink-300` is the same
 * proven, dark-surface-safe token (~7.6-7.9:1), reused here rather than a new
 * one. RouteStat's only call site is the dark route-hero stat block in
 * app/routes/[slug]/page.tsx, so this is a fully contained swap.
 */
export function RouteStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex w-full items-baseline gap-2 sm:w-auto sm:items-center sm:gap-2.5">
      <div className="hidden h-9 w-9 items-center justify-center rounded-sm bg-white/10 text-brass-300 sm:flex">{icon}</div>
      <div className="flex flex-wrap items-baseline gap-x-2 sm:block">
        <p className="text-xs text-ink-300">{label}</p>
        <p className="text-sm font-semibold text-sand-100">{value}</p>
      </div>
    </div>
  );
}
