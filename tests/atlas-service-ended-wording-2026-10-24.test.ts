import { describe, expect, it } from 'vitest';
import { buildAtlasAirports, describeServiceEndedEvidence, SERVICE_ENDED_NEXT_STEP } from '@/lib/atlas-network-data';
import type { DestinationPoint } from '@/components/founder/atlas-feel-test';
import { routeStatusEvents } from '@/data/route-status-events';

const ENDED_ISO = '2026-10-24';

function find(destSlug: string, nowIso: string = ENDED_ISO): DestinationPoint {
  const airport = buildAtlasAirports(nowIso).find((a) => a.airportSlug === 'manchester')!;
  for (const country of airport.countries) {
    const found = country.destinations.find((d) => d.slug === destSlug);
    if (found) return found;
  }
  throw new Error(`${destSlug} not found`);
}

const INTERNAL_TERMS = [
  'Post-effective-date',
  'verification (',
  'Sold Out',
  'codeshare',
  'OAG',
  'GDS',
  '6E',
  'booking engine',
  'none is inferred',
  'this event asserts',
  'AeroRoutes\' report',
  'departures board showing',
  'widebody',
];

describe('Atlas service-ended cards use plain customer wording (IndiGo Manchester-Mumbai and Manchester-Delhi)', () => {
  for (const slug of ['mumbai', 'delhi']) {
    it(`${slug}: no internal verification terminology anywhere in the card`, () => {
      const d = find(slug);
      const shown = [d.verdict, d.detail ?? '', d.flightTime, d.serviceNotice?.label ?? '', d.serviceNotice?.detail ?? ''].join(' | ');
      for (const term of INTERNAL_TERMS) expect(shown, term).not.toContain(term);
    });

    it(`${slug}: still says the direct service has ended, with its effective date, who it was checked against and when`, () => {
      const d = find(slug);
      expect(d.verdict).toBe('Direct service ended — check current options directly with the airline.');
      expect(d.flightTime).toBe('Direct service ended 31 August 2026');
      expect(d.serviceNotice?.label).toBe("IndiGo's direct service has ended, effective 31 August 2026.");
      expect(d.detail).toBe('Checked against IndiGo, AeroRoutes and Manchester Airport, most recently on 2 September 2026.');
      expect(d.serviceNotice?.detail).toBe(SERVICE_ENDED_NEXT_STEP);
    });

    it(`${slug}: never presents a connecting journey as direct, and says connecting journeys are only possible, not promised`, () => {
      const d = find(slug);
      const shown = [d.verdict, d.detail ?? '', d.flightTime, d.serviceNotice?.label ?? '', d.serviceNotice?.detail ?? ''].join(' ');
      expect(shown).not.toMatch(/direct (service|flight)s? (is|are) (available|operating|verified)|currently direct|nonstop (is|are) available/i);
      expect(d.serviceNotice?.detail).toMatch(/may still be available/);
    });

    it(`${slug}: the card is short (one evidence line and one next step), not the audit narrative printed twice`, () => {
      const d = find(slug);
      const total = [d.verdict, d.detail ?? '', d.flightTime, d.serviceNotice?.label ?? '', d.serviceNotice?.detail ?? ''].join(' ').length;
      expect(total).toBeLessThan(520);
    });
  }

  it('the underlying verification records are untouched: the ledger still carries the full audit narrative for both routes', () => {
    for (const id of ['man-bom-indigo-service-ended-2026-09', 'man-del-indigo-service-ended-2026-09']) {
      const e = routeStatusEvents.find((x) => x.id === id)!;
      expect(e.explanation).toContain('Post-effective-date verification (2 September 2026)');
      expect(e.explanation).toContain('Sold Out');
      expect(e.explanation).toContain('No specific last-operating date is evidenced');
      expect(e.verifiedAt).toBe('2026-09-02');
    }
  });

  it('the withdrawal-announced branch (an announced change, not an ended service) is unchanged', () => {
    for (const slug of ['mumbai', 'delhi']) {
      const d = find(slug, '2026-08-25');
      expect(d.serviceNotice?.label).toContain('announced a change');
      expect(d.serviceNotice?.detail).toContain('IndiGo announced on 2 June 2026');
    }
  });
});

describe('describeServiceEndedEvidence', () => {
  it('names distinct publishers in order and the most recent date', () => {
    expect(
      describeServiceEndedEvidence([
        { publisher: 'IndiGo', accessedAt: '2026-09-02' },
        { publisher: 'AeroRoutes', accessedAt: '2026-09-04' },
        { publisher: 'IndiGo', accessedAt: '2026-09-01' },
      ])
    ).toBe('Checked against IndiGo and AeroRoutes, most recently on 4 September 2026.');
  });
  it('handles one publisher, no dates, and nothing at all without inventing anything', () => {
    expect(describeServiceEndedEvidence([{ publisher: 'IndiGo', accessedAt: '2026-09-02' }])).toBe('Checked against IndiGo, most recently on 2 September 2026.');
    expect(describeServiceEndedEvidence([{ publisher: 'IndiGo' }])).toBe('Checked against IndiGo.');
    expect(describeServiceEndedEvidence([])).toBeNull();
    expect(describeServiceEndedEvidence([{ publisher: '  ' }])).toBeNull();
    // a malformed date or a date on an unnamed citation never reaches the sentence
    expect(describeServiceEndedEvidence([{ publisher: 'IndiGo', accessedAt: 'soon' }])).toBe('Checked against IndiGo.');
    expect(describeServiceEndedEvidence([{ publisher: 'IndiGo' }, { publisher: ' ', accessedAt: '2026-12-31' }])).toBe('Checked against IndiGo.');
  });
});
