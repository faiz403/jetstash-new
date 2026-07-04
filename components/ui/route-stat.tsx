export function RouteStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-white/10 text-brass-300">{icon}</div>
      <div>
        <p className="text-xs text-ink-400">{label}</p>
        <p className="text-sm font-semibold text-sand-100">{value}</p>
      </div>
    </div>
  );
}
