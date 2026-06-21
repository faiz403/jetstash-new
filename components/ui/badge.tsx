import { cn } from '@/lib/utils';

const variants = {
  brass: 'bg-brass-50 text-brass-700 border-brass-200',
  terracotta: 'bg-terracotta-50 text-terracotta-700 border-terracotta-200',
  ink: 'bg-ink-100 text-ink-700 border-ink-200',
  dark: 'bg-white/10 text-sand-100 border-white/10',
};

export function Badge({
  children,
  variant = 'brass',
  className,
}: {
  children: React.ReactNode;
  variant?: keyof typeof variants;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold tracking-wide uppercase',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
