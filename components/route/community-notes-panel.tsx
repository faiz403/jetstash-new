import { BadgeCheck } from 'lucide-react';
import type { CommunityNote } from '@/data/community-notes';

function formatNoteDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Real traveller-submitted notes for this route/destination/airport. There
 * is currently no submission pipeline, so `notes` is almost always empty —
 * per the Truth Reset's explicit instruction, an empty result renders
 * nothing at all (no heading, no container, no "not yet" placeholder),
 * rather than an honest-sounding empty state. The caller (route page) must
 * not render this section's heading/container either when notes is empty —
 * see the conditional wrapping in app/routes/[slug]/page.tsx.
 */
export function CommunityNotesPanel({ notes }: { notes: CommunityNote[] }) {
  if (notes.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      {notes.map((note) => (
        <div key={note.id} className="rounded-md border border-ink-100 bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-ink-900">{note.authorLabel}</span>
            <div className="flex items-center gap-2">
              {note.verified && (
                <span className="flex items-center gap-1 text-xs font-medium text-terracotta-600">
                  <BadgeCheck className="h-3.5 w-3.5" strokeWidth={2} /> Verified
                </span>
              )}
              <span className="text-xs text-ink-400">{formatNoteDate(note.date)}</span>
            </div>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-ink-600">{note.body}</p>
        </div>
      ))}
    </div>
  );
}
