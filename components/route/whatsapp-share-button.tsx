import { MessageCircle } from 'lucide-react';

/**
 * Pre-filled WhatsApp share link — no client-side state needed, this is
 * just an anchor to wa.me with the message pre-encoded. Designed to be
 * easy to drop into a family WhatsApp group: route, key advice, and the
 * page link in one message.
 */
export function WhatsAppShareButton({ url, text }: { url: string; text: string }) {
  const message = `${text}\n\nFull route guide: ${url}`;
  const href = `https://wa.me/?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-sm border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-sand-100 transition-colors hover:bg-[#25D366]/15 hover:text-[#25D366]"
    >
      <MessageCircle className="h-4 w-4" strokeWidth={2.25} />
      Share on WhatsApp
    </a>
  );
}
