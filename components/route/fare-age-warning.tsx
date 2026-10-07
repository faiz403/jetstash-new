import { getFareAgeWarningText } from '@/lib/fare-age-warning';

export function FareAgeWarning({
  observedDate,
  nowIso,
  className = 'mt-1 text-xs text-ink-500',
}: {
  observedDate: string;
  nowIso: string;
  className?: string;
}) {
  const text = getFareAgeWarningText(observedDate, nowIso);
  if (!text) return null;

  return <p className={className}>{text}</p>;
}
