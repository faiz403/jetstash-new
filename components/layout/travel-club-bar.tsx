import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

export function TravelClubBar() {
  return (
    <Link
      href="/travel-club"
      className="group flex items-center justify-center gap-2 bg-brass px-4 py-2 text-center text-xs font-semibold text-ink-900 transition-colors hover:bg-brass-400 sm:text-sm"
    >
      <span>Free fare-drop alerts for Pakistan, India & Gulf routes</span>
      <span className="flex items-center gap-1 underline decoration-ink-900/30 underline-offset-2 group-hover:decoration-ink-900">
        Join Travel Club
        <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.25} />
      </span>
    </Link>
  );
}
