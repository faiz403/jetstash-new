import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { normalizeAirportCode, resolveShellDispatch } from '@/lib/arrive-by-shared/shell-dispatch';
import { getPublicAirportProfiles } from '@/lib/arrive-by-shared/airport-registry';

/**
 * Unified Arrive By shell (Phase 4). This codebase's test suite runs in a
 * plain node environment (see vitest.config.ts) with no jsdom/React
 * Testing Library, so — matching every other Arrive By test file's
 * convention — the shell's actual DISPATCH LOGIC is tested directly via
 * the pure lib/arrive-by-shared/shell-dispatch.ts module it's built on
 * (extracted specifically so it's unit-testable), and the component/page
 * source is checked structurally for indexing controls, founder-gate
 * absence and registry-driven-ness.
 */

const pagePath = join(process.cwd(), 'app', 'arrive-by', 'page.tsx');
const shellPath = join(process.cwd(), 'components', 'arrive-by-shell.tsx');
const sitemapPath = join(process.cwd(), 'app', 'sitemap.ts');
const manchesterLegacyPath = join(process.cwd(), 'app', 'arrive-by', 'manchester', 'page.tsx');
const pakistanLegacyPath = join(process.cwd(), 'app', 'arrive-by', 'pakistan', 'page.tsx');
const founderManPagePath = join(process.cwd(), 'app', 'founder', 'arrive-by', 'page.tsx');
const founderPkPagePath = join(process.cwd(), 'app', 'founder', 'arrive-by-pakistan', 'page.tsx');

const pageSrc = readFileSync(pagePath, 'utf8');
const shellSrc = readFileSync(shellPath, 'utf8');
const sitemapSrc = readFileSync(sitemapPath, 'utf8');
const manchesterLegacySrc = readFileSync(manchesterLegacyPath, 'utf8');
const pakistanLegacySrc = readFileSync(pakistanLegacyPath, 'utf8');
const founderManPageSrc = readFileSync(founderManPagePath, 'utf8');
const founderPkPageSrc = readFileSync(founderPkPagePath, 'utf8');

describe('/arrive-by canonical page — indexing controls and founder-gate absence', () => {
  it('sets robots index:false, follow:true', () => {
    expect(pageSrc).toMatch(/robots:\s*{\s*index:\s*false,\s*follow:\s*true\s*}/);
  });

  it('is absent from app/sitemap.ts', () => {
    expect(sitemapSrc).not.toMatch(/['"`]\/arrive-by['"`]/);
  });

  it('the page and shell never check FOUNDER_DASHBOARD_ENABLED or call notFound()', () => {
    expect(pageSrc).not.toMatch(/FOUNDER_DASHBOARD_ENABLED/);
    expect(pageSrc).not.toMatch(/notFound\(\)/);
    expect(shellSrc).not.toMatch(/FOUNDER_DASHBOARD_ENABLED/);
  });
});

describe('the shell is registry-driven, not a fixed 4-airport constant', () => {
  it('the shell component sources its selector list from getPublicAirportProfiles(), not a hardcoded array', () => {
    expect(shellSrc).toContain('getPublicAirportProfiles()');
    // The classic giveaway of a hardcoded selector would be all four codes
    // written together as one literal array in the shell itself.
    expect(shellSrc).not.toMatch(/\[\s*['"]MAN['"],\s*['"]ISB['"],\s*['"]LHE['"],\s*['"]KHI['"]\s*\]/);
  });

  it('resolveShellDispatch (the actual dispatch logic) reads the live registry, so a newly public airport needs no shell code change', () => {
    // Proven structurally: dispatch delegates to getAirportProfile, and
    // the selector delegates to getPublicAirportProfiles — both read
    // whatever the registry currently contains, evaluated fresh each call.
    const dispatchSrc = readFileSync(join(process.cwd(), 'lib', 'arrive-by-shared', 'shell-dispatch.ts'), 'utf8');
    expect(dispatchSrc).toContain('getAirportProfile(code)');
    expect(dispatchSrc).not.toMatch(/['"]MAN['"]|['"]ISB['"]|['"]LHE['"]|['"]KHI['"]/);
  });

  it('engine dispatch reads AirportProfile.journeyEngine, never an airport code or country', () => {
    expect(shellSrc).toContain('profile.journeyEngine');
    expect(shellSrc).not.toMatch(/profile\.countryCode\s*===/);
    expect(shellSrc).not.toMatch(/profile\.code\s*===\s*['"](MAN|ISB|LHE|KHI)['"]/);
  });
});

describe('normalizeAirportCode', () => {
  it('trims and uppercases a real value', () => {
    expect(normalizeAirportCode('  man  ')).toBe('MAN');
    expect(normalizeAirportCode('isb')).toBe('ISB');
  });

  it('returns null for missing, empty or blank input', () => {
    expect(normalizeAirportCode(null)).toBeNull();
    expect(normalizeAirportCode(undefined)).toBeNull();
    expect(normalizeAirportCode('')).toBeNull();
    expect(normalizeAirportCode('   ')).toBeNull();
  });
});

describe('resolveShellDispatch — the shell\'s actual routing decision', () => {
  it('no airport param → selector', () => {
    expect(resolveShellDispatch(null)).toEqual({ kind: 'selector' });
    expect(resolveShellDispatch('')).toEqual({ kind: 'selector' });
  });

  it('MAN (any case) → journey with the real MAN profile', () => {
    const result = resolveShellDispatch('man');
    expect(result.kind).toBe('journey');
    if (result.kind === 'journey') {
      expect(result.profile.code).toBe('MAN');
      expect(result.profile.journeyEngine).toBe('TRANSIT_FIRST');
    }
  });

  it('ISB/LHE/KHI → journey with the matching road-pickup-first profile', () => {
    for (const code of ['ISB', 'LHE', 'KHI']) {
      const result = resolveShellDispatch(code);
      expect(result.kind).toBe('journey');
      if (result.kind === 'journey') {
        expect(result.profile.code).toBe(code);
        expect(result.profile.journeyEngine).toBe('ROAD_PICKUP_FIRST');
      }
    }
  });

  it('an unsupported/unknown code → unsupported, never a guess', () => {
    expect(resolveShellDispatch('LHR')).toEqual({ kind: 'unsupported', code: 'LHR' });
    expect(resolveShellDispatch('XX')).toEqual({ kind: 'unsupported', code: 'XX' });
  });

  it('every currently public airport profile round-trips through the dispatcher', () => {
    for (const profile of getPublicAirportProfiles()) {
      const result = resolveShellDispatch(profile.code);
      expect(result).toEqual({ kind: 'journey', profile });
    }
  });
});

describe('legacy route redirects (Phase 4)', () => {
  it('/arrive-by/manchester redirects to /arrive-by?airport=MAN', () => {
    expect(manchesterLegacySrc).toMatch(/redirect\(['"]\/arrive-by\?airport=MAN['"]\)/);
  });

  it('/arrive-by/pakistan redirects to /arrive-by (never guesses a single Pakistan airport)', () => {
    expect(pakistanLegacySrc).toMatch(/redirect\(['"]\/arrive-by['"]\)/);
    expect(pakistanLegacySrc).not.toMatch(/airport=/);
  });

  it('neither legacy redirect points back to itself (no redirect loop)', () => {
    expect(manchesterLegacySrc).not.toMatch(/redirect\(['"]\/arrive-by\/manchester['"]\)/);
    expect(pakistanLegacySrc).not.toMatch(/redirect\(['"]\/arrive-by\/pakistan['"]\)/);
  });

  it('founder routes are untouched by the redirect change', () => {
    expect(founderManPageSrc).toContain("process.env.NODE_ENV !== 'production' || process.env.FOUNDER_DASHBOARD_ENABLED === 'true'");
    expect(founderPkPageSrc).toContain("process.env.NODE_ENV !== 'production' || process.env.FOUNDER_DASHBOARD_ENABLED === 'true'");
  });
});

describe('public-beta boundary — the shell never implies broader coverage than the registry actually has', () => {
  it('the selector copy does not claim worldwide, all-UK, or all-Pakistan coverage', () => {
    expect(shellSrc).not.toMatch(/every airport|all airports|worldwide|any airport/i);
  });

  it('the selected-airport scope caption is airport-specific, not a blanket claim', () => {
    expect(shellSrc).toContain('scopeCaption');
    expect(shellSrc).toMatch(/UK destinations only/);
  });
});

describe('accessibility — native, keyboard-usable controls', () => {
  it('airport cards and Change airport are real <Link> anchors, not div onClick handlers', () => {
    const linkCount = (shellSrc.match(/<Link\b/g) ?? []).length;
    expect(linkCount).toBeGreaterThanOrEqual(3); // selector cards + unsupported CTA + change-airport
    expect(shellSrc).not.toMatch(/<div[^>]*onClick/);
  });

  it('interactive elements have a visible focus style', () => {
    expect(shellSrc).toMatch(/focus-visible:outline/);
  });
});
