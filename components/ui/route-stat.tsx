/**
 * Route-page accessibility fix (6 Nov 2026): the "Flight time" / "Frequency" /
 * "Airlines" block now sits in the light "More route information" section
 * (app/routes/[slug]/page.tsx), but this component still used the palette it
 * had when it lived on the dark route hero (labels `text-ink-300`, values
 * `text-sand-100`). On the light `bg-sand-50` surface that measured 2.45:1
 * for the labels and 1.08:1 for the values, so the facts were effectively
 * invisible. It is now styled for the light surface: label `text-ink-500`
 * (8.5:1), value `text-ink-900` (18.7:1), icon `text-brass-700` (5.9:1).
 * RouteStat's only call site is that light section, so the palette is not
 * parameterised; if it is ever used on a dark surface again, add a `tone`
 * prop rather than reverting these tokens.
 */
export function RouteStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex w-full items-baseline gap-2 sm:w-auto sm:items-center sm:gap-2.5">
      <div className="hidden h-9 w-9 items-center justify-center rounded-sm bg-sand-200 text-brass-700 sm:flex">{icon}</div>
      <div className="flex flex-wrap items-baseline gap-x-2 sm:block">
        <p className="text-xs text-ink-500">{label}</p>
        <p className="text-sm font-semibold text-ink-900">{value}</p>
      </div>
    </div>
  );
}
