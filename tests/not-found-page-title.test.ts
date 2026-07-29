import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * LAUNCH_CHECKLIST.md item E1: app/not-found.tsx had no metadata export,
 * so the browser tab fell back to the root layout's default title (the
 * homepage's), not a 404-specific one. Source-based check, matching this
 * repo's existing pattern for page-title regressions
 * (tests/trust-cracks-july.test.ts) rather than a full render.
 */
describe('the 404 page sets its own metadata title', () => {
  const src = readFileSync(join(process.cwd(), 'app/not-found.tsx'), 'utf8');

  it('exports a Metadata title', () => {
    expect(src).toMatch(/export const metadata:\s*Metadata\s*=\s*\{[\s\S]*?title:\s*'[^']+'/);
  });

  it('does not hand-append "JetStash" — the root layout template already adds it', () => {
    const titleMatch = src.match(/export const metadata:[\s\S]*?title:\s*'([^']+)'/);
    expect(titleMatch).not.toBeNull();
    expect(titleMatch![1].toLowerCase()).not.toContain('jetstash');
  });
});
