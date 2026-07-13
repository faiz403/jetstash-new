import { describe, it, expect } from 'vitest';
import { CommunityNotesPanel } from '@/components/route/community-notes-panel';

/**
 * Founder correction (Truth Reset continuation): an empty Community Notes
 * result must render nothing at all — no heading, no container, no honest
 * "not yet" placeholder — not just an honest-sounding empty state. This
 * locks in that exact behaviour at the component level.
 */
describe('CommunityNotesPanel — empty state renders nothing', () => {
  it('returns null when there are no notes', () => {
    expect(CommunityNotesPanel({ notes: [] })).toBeNull();
  });

  it('returns a real element when notes exist', () => {
    const result = CommunityNotesPanel({
      notes: [
        {
          id: 'note-1',
          scope: { routeSlug: 'manchester-lahore' },
          authorLabel: 'A traveller',
          date: '2026-01-01',
          body: 'Test note.',
          verified: false,
        },
      ],
    });
    expect(result).not.toBeNull();
  });
});
