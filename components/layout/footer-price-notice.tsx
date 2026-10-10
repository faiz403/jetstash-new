'use client';

import { usePathname } from 'next/navigation';

/**
 * The footer's "prices are indicative" sentence. Arrive By shows journey timing,
 * not fares, so the sentence is irrelevant there and is left out on that page
 * (10 October 2026 customer copy / consistency batch). Everywhere else the
 * wording is exactly what it was.
 */
export function FooterPriceNotice() {
  const pathname = usePathname();
  if (pathname === '/arrive-by' || pathname?.startsWith('/arrive-by/')) return null;
  return (
    <p className="max-w-xl">
      Prices shown across this site are indicative and subject to change. Always confirm the final price
      with the airline or operator before booking.
    </p>
  );
}
