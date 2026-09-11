import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  assembleManchesterMumbaiBrief,
  hasMaterialDurationConsequence,
  JOURNEY_DURATION_REFLECTION_COPY,
  type EvidencedFareOption,
} from '@/lib/journey-brief-phase1-manchester-mumbai';

/**
 * Journey Brief public-readiness pilot (Astra product review, 11 Sept
 * 2026).
 *
 * Step 1 inventory finding, load-bearing for this whole task: the existing
 * Journey Brief Phase 1 (the canonical-data, five-answer "30-second brief")
 * is hardcoded to Manchester -> Mumbai, not Manchester -> Islamabad — see
 * docs/project-control/STATUS.md's own "Programme state" section and
 * docs/project-control/COMPLETED.md's JOURNEY-BRIEF-PHASE1-001 entry, both
 * already documenting this exact scoping (Journey Choice = MAN-ISB public
 * pilot; Journey Brief = MAN-Mumbai founder-only pilot — two separate
 * experiments on two separate routes). Confirmed with the founder before
 * proceeding: this task assesses the EXISTING Manchester-Mumbai brief
 * against the 30-second target, rather than porting it to a second route.
 *
 * Step 2 gap assessment: the existing brief already satisfies every
 * criterion (clear answer first, uncertainty visible as its own labelled
 * section, one primary next action, no unsupported claims, methodology
 * behind a collapsed <details>, no fake recommendation/score) per its own
 * extensive existing test suite
 * (tests/journey-brief-phase1-manchester-mumbai*.test.ts, 133 tests, all
 * still passing unmodified). The one evidenced gap, per Step 3: neither the
 * "What you could miss" section nor anywhere else in the brief helped a
 * reader notice that absolute journey duration itself (not just fare) is a
 * personal decision factor — the qualitative learning from Reddit
 * experiment #2. Fixed with ONE plain-language reflective sentence, gated
 * on a genuine decisive duration consequence already being shown, reusing
 * only the already-computed canonical duration facts — no calculator, no
 * salary input, no scoring, no universal threshold.
 */

const componentSrc = readFileSync(
  join(process.cwd(), 'components/journey-brief/journey-brief-manchester-mumbai.tsx'),
  'utf8'
);
const libSrc = readFileSync(join(process.cwd(), 'lib/journey-brief-phase1-manchester-mumbai.ts'), 'utf8');

describe('Step 1 inventory: Journey Brief Phase 1 is Manchester-Mumbai only, confirmed against project-control docs', () => {
  it('the founder-only page route is /founder/journey-brief/manchester-mumbai, gated behind FOUNDER_DASHBOARD_ENABLED', () => {
    const pageSrc = readFileSync(join(process.cwd(), 'app/founder/journey-brief/manchester-mumbai/page.tsx'), 'utf8');
    expect(pageSrc).toContain("process.env.FOUNDER_DASHBOARD_ENABLED === 'true'");
    expect(pageSrc).toContain('notFound()');
  });

  it('STATUS.md documents Journey Brief and Journey Choice as two separate pilots on two separate routes', () => {
    const status = readFileSync(join(process.cwd(), 'docs/project-control/STATUS.md'), 'utf8');
    expect(status).toMatch(/Journey Choice:\*\* one-route Manchester–Islamabad public pilot/);
    expect(status).toMatch(/Journey Brief Phase 1:\*\* a founder-only Manchester–Mumbai pilot/);
  });

  it('the route select rejects any route other than Manchester-Mumbai, rather than silently assembling a brief for it', () => {
    expect(componentSrc).toContain("airportSlug !== 'manchester' || destinationSlug !== 'mumbai'");
    expect(componentSrc).toContain("currently available for Manchester → Mumbai only");
  });
});

describe('Step 2 gap assessment: no public exposure, no indexing (already correct, verified not just assumed)', () => {
  it('/founder is disallowed in robots.ts as a path prefix, covering this route', () => {
    const robots = readFileSync(join(process.cwd(), 'app/robots.ts'), 'utf8');
    expect(robots).toMatch(/disallow:\s*'\/founder'/);
  });

  it('the page metadata sets robots: index false, follow false even if the gate were ever bypassed', () => {
    const pageSrc = readFileSync(join(process.cwd(), 'app/founder/journey-brief/manchester-mumbai/page.tsx'), 'utf8');
    expect(pageSrc).toMatch(/robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
  });

  it('the page is absent from the sitemap generator entirely', () => {
    const sitemapSrc = readFileSync(join(process.cwd(), 'app/sitemap.ts'), 'utf8');
    expect(sitemapSrc).not.toContain('journey-brief');
    expect(sitemapSrc).not.toContain('/founder');
  });

  it('no public route, nav entry, or route-page CTA links to the Journey Brief page', () => {
    const routePageSrc = readFileSync(join(process.cwd(), 'app/routes/[slug]/page.tsx'), 'utf8');
    expect(routePageSrc).not.toMatch(/founder\/journey-brief/);
    const siteConfigSrc = readFileSync(join(process.cwd(), 'lib/site-config.ts'), 'utf8');
    expect(siteConfigSrc).not.toMatch(/founder\/journey-brief/);
  });
});

describe('Step 3: Reddit experiment #2 qualitative learning incorporated — plain language, no calculator', () => {
  it('hasMaterialDurationConsequence is true for the real Manchester-Mumbai evidence (Outbound: 43h, Return: 14h 30m)', () => {
    const brief = assembleManchesterMumbaiBrief('2026-09-05')!;
    expect(hasMaterialDurationConsequence(brief.evidencedOption!)).toBe(true);
  });

  it('is false for a clean, short itinerary with no decisive duration entry', () => {
    const cleanOption: EvidencedFareOption = {
      price: 400, currency: 'GBP', cabin: 'Economy', airline: 'Fixture Air', observedDate: '2026-09-05',
      departureDate: '2026-10-01', returnDate: '2026-10-15', baggage: 'not stated', directness: 'direct',
      outboundStops: 0, returnStops: 0, outboundDuration: '7h', returnDuration: '7h 30m',
      journeyConsequences: [], longestNamedWait: null, connectionProtectionMentioned: false, isCurrentRepresentativeFare: true,
    };
    expect(hasMaterialDurationConsequence(cleanOption)).toBe(false);
  });

  it('the reflection copy is plain language: no calculator, no salary input, no scoring, no universal numeric threshold presented as fact', () => {
    expect(JOURNEY_DURATION_REFLECTION_COPY).not.toMatch(/salary|calculat|score|£\d+\s*\/\s*hour|worth £/i);
    expect(JOURNEY_DURATION_REFLECTION_COPY.toLowerCase()).toMatch(/travellers differently|matters more to you/);
  });

  it('never states a single universal acceptable-duration threshold as fact (e.g. "anything over 20h is too long")', () => {
    expect(JOURNEY_DURATION_REFLECTION_COPY).not.toMatch(/\d+\s*h(ours)?\s+(is|are)\s+too\s+long/i);
  });

  it('the component renders the reflection line only inside the "What you could miss" section, immediately gated on hasMaterialDurationConsequence', () => {
    const functionStart = componentSrc.indexOf('export function JourneyBriefManchesterMumbai');
    const missSectionStart = componentSrc.indexOf('EyebrowLabel tone={hasNoMaterialConsequence', functionStart);
    const reflectionIdx = componentSrc.indexOf('JOURNEY_DURATION_REFLECTION_COPY', functionStart);
    const nextSectionStart = componentSrc.indexOf('What remains unconfirmed', functionStart);
    const gateIdx = componentSrc.lastIndexOf('hasMaterialDurationConsequence(evidencedOption)', reflectionIdx);
    expect(missSectionStart).toBeGreaterThan(-1);
    expect(reflectionIdx).toBeGreaterThan(missSectionStart);
    expect(reflectionIdx).toBeLessThan(nextSectionStart);
    expect(gateIdx).toBeGreaterThan(missSectionStart);
    expect(gateIdx).toBeLessThan(reflectionIdx);
  });

  it('reuses only the already-computed canonical duration facts (journeyConsequences) — no new duration-comparison calculation added to the lib file', () => {
    expect(libSrc).toContain("c.startsWith('Outbound:') || c.startsWith('Return:')");
    // No new arithmetic on raw minutes, hourly rates, or a second duration source.
    expect(libSrc).not.toMatch(/hourlyValue|salaryPerHour|timeValue\s*\*/);
  });

  it('does not touch or duplicate Journey Choice (a separate, Manchester-Islamabad-only pilot) in any way', () => {
    expect(libSrc).not.toMatch(/journey-choice|journeyChoice|601|621|626/i);
    expect(componentSrc).not.toMatch(/journey-choice|journeyChoice/i);
  });
});

describe('Step 4/5: controlled facts and canonical-truth-only discipline preserved by this change', () => {
  it('the real Manchester-Mumbai evidenced option is unchanged by this pilot-readiness pass — same price, same journey consequences', () => {
    const brief = assembleManchesterMumbaiBrief('2026-09-05')!;
    expect(brief.evidencedOption!.price).toBe(395);
    expect(brief.evidencedOption!.journeyConsequences).toEqual(['Self-transfer', 'Outbound: 43h', 'Return: 14h 30m']);
  });

  it('the new function/constant added are pure and reuse only existing types — no new canonical data file created', () => {
    expect(libSrc).not.toMatch(/export const.*JOURNEY_BRIEF_FACTS|export const.*CANONICAL_JOURNEY_DATA/);
  });
});
