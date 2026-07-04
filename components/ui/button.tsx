import { cn } from '@/lib/utils';
import Link from 'next/link';
import { ButtonHTMLAttributes, AnchorHTMLAttributes } from 'react';

// No focus-visible:outline-none here — the global brass :focus-visible ring in
// globals.css is the keyboard affordance for every button and link-button.
const base =
  'inline-flex items-center justify-center gap-2 font-sans font-semibold transition-all duration-200 rounded-sm active:scale-[0.985] disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap';

const variants = {
  primary: 'bg-brass text-ink-900 hover:bg-brass-400 hover:shadow-brass-glow active:bg-brass-600',
  dark: 'bg-ink-900 text-sand-50 hover:bg-ink-700 active:bg-ink-950',
  outline: 'border border-ink-200/20 text-sand-50 hover:bg-white/5 active:bg-white/10',
  ghost: 'text-ink-900 hover:bg-ink-50 active:bg-ink-100',
  terracotta: 'bg-terracotta text-sand-50 hover:bg-terracotta-400 active:bg-terracotta-600',
};

const sizes = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-11 px-5 text-[15px]',
  lg: 'h-14 px-7 text-base',
};

interface CommonProps {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  className?: string;
}

type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>;
type LinkButtonProps = CommonProps & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; external?: boolean };

export function Button({ variant = 'primary', size = 'md', className, ...props }: ButtonProps) {
  return <button className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}

export function LinkButton({ variant = 'primary', size = 'md', className, href, external, ...props }: LinkButtonProps) {
  const classes = cn(base, variants[variant], sizes[size], className);
  if (external) {
    return (
      <a href={href} className={classes} target="_blank" rel="nofollow sponsored noopener noreferrer" {...props} />
    );
  }
  return <Link href={href} className={classes} {...props} />;
}
