'use client';

import { MessageCircle } from 'lucide-react';
import { track } from '@/lib/analytics';

/**
 * Pre-filled WhatsApp share link — no client-side state needed, this is
 * just an anchor to wa.me with the message pre-encoded. Designed to be
 * easy to drop into a family WhatsApp group: route, key advice, and the
 * page link in one message.
 *
 * `variant` picks the surface it sits on: 'dark' (default) for the route
 * hero's ink background; 'light' for a white card surface, e.g. inside
 * Book-By Countdown's own CTA row.
 */
export function WhatsAppShareButton({
  url,
  text,
  variant = 'dark',
}: {
  url: string;
  text: string;
  variant?: 'dark' | 'light';
}) {
  const message = `${text}\n\nFull route guide: ${url}`;
  const href = `https://wa.me/?text=${encodeURIComponent(message)}`;

  const className =
    variant === 'light'
      ? 'inline-flex items-center gap-2 rounded-sm border border-ink-200 px-4 py-2.5 text-sm font-semibold text-ink-900 transition-colors hover:border-[#25D366]/40 hover:bg-[#25D366]/10 hover:text-[#128C4A]'
      : 'inline-flex items-center gap-2 rounded-sm border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-sand-100 transition-colors hover:bg-[#25D366]/15 hover:text-[#25D366]';

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-analytics="whatsapp-share"
      onClick={() => track('whatsapp_share_click', { url })}
      className={className}
    >
      <MessageCircle className="h-4 w-4" strokeWidth={2.25} />
      Share on WhatsApp
    </a>
  );
}
