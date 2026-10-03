import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(process.cwd(), 'app', 'privacy-policy', 'page.tsx'), 'utf8');
const prose = source.replace(/<[^>]*>/g, ' ').replace(/&apos;/g, "'").replace(/\s+/g, ' ');

const between = (from: string, to: string) => {
  const start = prose.indexOf(from);
  const end = prose.indexOf(to);
  return start >= 0 && end > start ? prose.slice(start, end) : '';
};
const retention = between("title: 'How long we keep information'", "title: 'How we protect your information'");

describe('privacy policy: retention is explained by criteria, not by an unfinished to-do', () => {
  it('has a retention section', () => {
    expect(retention.length).toBeGreaterThan(400);
  });

  it('no longer admits that retention is unfinished or on a to-do list', () => {
    expect(prose).not.toMatch(/to-do list/i);
    expect(prose).not.toMatch(/don't yet have formal/i);
    expect(prose).not.toMatch(/still on our/i);
    expect(prose).not.toMatch(/needs a formal decision/i);
  });

  it('says retention is decided by purpose rather than one fixed period', () => {
    expect(retention).toMatch(/for longer than we need it for the reason we collected it/);
    expect(retention).toMatch(/we decide by purpose/);
  });

  it('gives a criterion for each kind of information', () => {
    expect(retention).toMatch(/Contact form and quote request messages: kept only for as long as reasonably needed to deal with your enquiry, any follow-up, and any related legal or administrative need/);
    expect(retention).toMatch(/They are deleted when they are no longer needed/);
    expect(retention).toMatch(/Travel Club and Route Watch: your email address and preferences are kept while you remain subscribed/);
    expect(retention).toMatch(/we stop using them for those messages and delete them where appropriate/);
    expect(retention).toMatch(/retaining only the minimum information needed to honour your opt-out or meet a legal obligation/);
    expect(retention).toMatch(/Website server logs and security data: held by our hosting provider for the short periods it sets/);
    expect(retention).toMatch(/Optional Google Ads measurement: used only if you accept it/);
    expect(retention).toMatch(/Google processes that measurement data under its own terms and privacy policy/);
  });

  it('points to the Arrive By section for Arrive By instead of repeating or contradicting it', () => {
    expect(retention).toMatch(/Arrive By: we do not retain your journey details/);
    expect(retention).toMatch(/described under Arrive By above/);
    expect(prose.indexOf("title: 'Arrive By (journey estimates)'")).toBeGreaterThan(-1);
    expect(prose.indexOf("title: 'Arrive By (journey estimates)'")).toBeLessThan(prose.indexOf("title: 'How long we keep information'"));
  });

  it('invents no period of its own: no digits with a time unit and no spelled-out weeks, months or years', () => {
    expect(retention).not.toMatch(/\b\d+\s*(minute|hour|day|week|month|year)s?\b/i);
    expect(retention).not.toMatch(/\b(weeks?|months?|years?)\b/i);
  });

  it('keeps a way to ask what is held or to have something deleted sooner', () => {
    expect(retention).toMatch(/have something deleted sooner/);
    expect(source).toContain('mailto:privacy@jetstash.co.uk');
  });
});
