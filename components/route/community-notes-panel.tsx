import { MessageSquareText, BadgeCheck } from 'lucide-react';
import type { CommunityNote } from '@/data/community-notes';

function formatNoteDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Real traveller-submitted notes for this route/destination/airport. There
 * is currently no submission pipeline, so this almost always renders the
 * honest empty state below rather than fabricated testimonials — see
 * data/community-notes.ts.
 */
export function CommunityNotesPanel({ notes }: { notes: CommunityNote[] }) {
  if (notes.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-md border border-dashed border-ink-200 bg-white px-6 py-10 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-ink-50 text-ink-400">
          <MessageSquareText className="h-5 w-5" strokeWidth={2} />
        </div>
        <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-600">
          No community notes recorded for this route yet — this section will fill in with real traveller experiences
          over time, not manufactured reviews.
        </p>
      </div>
    );
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
