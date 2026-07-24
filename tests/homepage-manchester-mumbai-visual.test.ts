import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getDestinationImage, getHeroImage } from '@/lib/brand-images';
import {
  JOURNEY_ORIGIN_FADE_END,
  JOURNEY_BRIDGE_RISE_START,
  JOURNEY_BRIDGE_PEAK_START,
  JOURNEY_BRIDGE_PEAK_END,
  JOURNEY_BRIDGE_FALL_END,
  JOURNEY_DESTINATION_RISE_START,
  journeyOriginOpacity,
  journeyBridgeOpacity,
  journeyDestinationOpacity,
  journeyOriginScale,
  journeyDestinationScale,
} from '@/components/homepage-v2/pull-brief-math';

/**
 * Homepage Manchester→Mumbai visual upgrade — regression coverage.
 *
 * The scene is three photographs (Manchester → the composite bridge →
 * Mumbai) staged across the same pull progress `p`, not a single photo that
 * fades. The curve math lives in pull-brief-math.ts as plain, exported pure
 * functions — unit-tested directly here, the same way every other pull
 * gesture curve in that file is tested (see pull-brief-math.test.ts).
 *
 * pull-brief.tsx and pull-brief-hero.tsx themselves are 'use client'
 * components built on refs + an imperative rAF pipeline (no hooks-safe way
 * to call them as plain functions, and this repo's Vitest environment is
 * 'node', not jsdom — see vitest.config.ts). For the wiring that connects
 * those curves to the DOM, these assertions work the same way the existing
 * source-text regression tests do (e.g. route-status-date-formatting.test.ts,
 * route-watch-form-copy.test.ts): read the real component source and assert
 * on its structure, rather than rendering it.
 */

const pullBriefSrc = readFileSync(join(process.cwd(), 'components/homepage-v2/pull-brief.tsx'), 'utf8');
const pullBriefHeroSrc = readFileSync(join(process.cwd(), 'components/homepage-v2/pull-brief-hero.tsx'), 'utf8');

describe('journey scene curves (pull-brief-math.ts) — pure functions of the existing p', () => {
  it('rest (p=0) clearly reads as Manchester: origin fully present, bridge and destination fully hidden', () => {
    expect(journeyOriginOpacity(0)).toBe(1);
    expect(journeyBridgeOpacity(0)).toBe(0);
    expect(journeyDestinationOpacity(0)).toBe(0);
  });

  it('Mumbai is not already visibly presented at rest — destination stays exactly 0 up to JOURNEY_DESTINATION_RISE_START', () => {
    expect(journeyDestinationOpacity(0)).toBe(0);
    expect(journeyDestinationOpacity(JOURNEY_DESTINATION_RISE_START)).toBe(0);
    expect(journeyDestinationOpacity(JOURNEY_DESTINATION_RISE_START - 0.01)).toBe(0);
  });

  it('Manchester has fully receded by JOURNEY_ORIGIN_FADE_END — gone for the rest of the pull', () => {
    expect(journeyOriginOpacity(JOURNEY_ORIGIN_FADE_END)).toBe(0);
    expect(journeyOriginOpacity(0.7)).toBe(0);
    expect(journeyOriginOpacity(1)).toBe(0);
  });

  it('the composite bridges the middle of the pull: zero at the edges, full through its plateau', () => {
    expect(journeyBridgeOpacity(0)).toBe(0);
    expect(journeyBridgeOpacity(JOURNEY_BRIDGE_RISE_START)).toBe(0);
    expect(journeyBridgeOpacity((JOURNEY_BRIDGE_PEAK_START + JOURNEY_BRIDGE_PEAK_END) / 2)).toBe(1);
    expect(journeyBridgeOpacity(JOURNEY_BRIDGE_FALL_END)).toBe(0);
    expect(journeyBridgeOpacity(1)).toBe(0);
  });

  it('open (p=1) clearly reads as Mumbai: destination fully present, origin and bridge fully hidden', () => {
    expect(journeyOriginOpacity(1)).toBe(0);
    expect(journeyBridgeOpacity(1)).toBe(0);
    expect(journeyDestinationOpacity(1)).toBe(1);
  });

  it('the handoff is a smooth crossfade, not a flash: origin fades out before the bridge is gone, and the bridge is on its way out before Mumbai is fully in', () => {
    // At the bridge's peak plateau, origin must already be at (or very near) zero — no double-exposure.
    const bridgeMid = (JOURNEY_BRIDGE_PEAK_START + JOURNEY_BRIDGE_PEAK_END) / 2;
    expect(journeyOriginOpacity(bridgeMid)).toBeLessThan(0.1);
    // No p value ever has more than one layer near full strength at once.
    for (let p = 0; p <= 1; p += 0.02) {
      const strong = [journeyOriginOpacity(p), journeyBridgeOpacity(p), journeyDestinationOpacity(p)].filter(
        (v) => v > 0.85
      );
      expect(strong.length).toBeLessThanOrEqual(1);
    }
  });

  it('every curve stays within [0, 1] and origin/destination move monotonically across their transition ranges', () => {
    let prevOrigin = journeyOriginOpacity(0);
    let prevDestination = journeyDestinationOpacity(0);
    for (let p = 0; p <= 1; p += 0.02) {
      const o = journeyOriginOpacity(p);
      const b = journeyBridgeOpacity(p);
      const d = journeyDestinationOpacity(p);
      for (const v of [o, b, d]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
      expect(o).toBeLessThanOrEqual(prevOrigin + 1e-9);
      expect(d).toBeGreaterThanOrEqual(prevDestination - 1e-9);
      prevOrigin = o;
      prevDestination = d;
    }
  });

  it('scale changes are restrained (never more than a few percent) and land exactly on 1 at each layer\'s settled end', () => {
    expect(journeyOriginScale(0)).toBeCloseTo(1.045, 5);
    expect(journeyOriginScale(JOURNEY_ORIGIN_FADE_END)).toBe(1);
    expect(journeyDestinationScale(JOURNEY_DESTINATION_RISE_START)).toBeCloseTo(0.97, 5);
    expect(journeyDestinationScale(1)).toBe(1);
    for (let p = 0; p <= 1; p += 0.05) {
      expect(Math.abs(journeyOriginScale(p) - 1)).toBeLessThan(0.05);
      expect(Math.abs(journeyDestinationScale(p) - 1)).toBeLessThan(0.05);
    }
  });

  it('reduced motion reaches the correct start/end states via the same functions — no separate reduced-motion branch exists in the curves', () => {
    // tweenTo's reduced-motion path calls applyP(target) directly (target is
    // always exactly 0 or 1, never a partial p) — so reduced motion is
    // provably correct once p=0 and p=1 are each provably correct, which the
    // rest/open tests above already establish. This test just pins that
    // contract: the curves take no second "reduced" argument to branch on.
    expect(journeyOriginOpacity.length).toBe(1);
    expect(journeyBridgeOpacity.length).toBe(1);
    expect(journeyDestinationOpacity.length).toBe(1);
  });
});

describe('all images resolve through the real brand-image system', () => {
  it('getHeroImage("manchester-mumbai-journey") resolves — used for both the origin (rest) and bridge scenes', () => {
    const image = getHeroImage('manchester-mumbai-journey');
    expect(image).not.toBeNull();
    expect(image?.src).toBe('/images/heroes/manchester-mumbai-journey.webp');
  });

  it('getDestinationImage("mumbai") resolves — the destination scene', () => {
    const image = getDestinationImage('mumbai');
    expect(image).not.toBeNull();
    expect(image?.src).toBe('/images/destinations/mumbai.webp');
  });

  it('PullBriefHero resolves the origin scene via the same composite as the bridge, never the Manchester Airport stock photo (map-overlay/BA-branding issue), and never a hardcoded /images path', () => {
    const originAssignment = pullBriefHeroSrc.match(/const originImg = ([^;]+);/)?.[1] ?? '';
    expect(originAssignment).toMatch(/getHeroImage\(\s*['"]manchester-mumbai-journey['"]\s*\)/);
    expect(pullBriefHeroSrc).not.toMatch(/getAirportImage/);
    expect(pullBriefHeroSrc).toMatch(/getDestinationImage\(\s*['"]mumbai['"]\s*\)/);
    expect(pullBriefHeroSrc).not.toMatch(/['"]\/images\//);
  });

  it('the origin and bridge props both resolve to the same composite image (getHeroImage called twice, once per prop)', () => {
    const calls = pullBriefHeroSrc.match(/getHeroImage\(\s*['"]manchester-mumbai-journey['"]\s*\)/g) ?? [];
    expect(calls).toHaveLength(2);
  });

  it('PullBriefHero passes all three resolved images into PullBrief as props, rather than PullBrief resolving its own images', () => {
    const pullBriefTag = pullBriefHeroSrc.match(/<PullBrief[\s\S]*?\/>/)?.[0] ?? '';
    expect(pullBriefTag).toMatch(/originImage=\{originImg\}/);
    expect(pullBriefTag).toMatch(/journeyImage=\{journeyImg\}/);
    expect(pullBriefTag).toMatch(/destinationImage=\{destinationImg\}/);
    // PullBrief's prop doc-comments reference the resolver names in prose
    // (naming where the *caller* resolves each image) but PullBrief itself
    // must only import the BrandImage type — never a resolver function.
    expect(pullBriefSrc).toMatch(/import type \{ BrandImage \} from '@\/lib\/brand-images';/);
    expect(pullBriefSrc).not.toMatch(/import \{[^}]*\} from '@\/lib\/brand-images'/);
    expect(pullBriefSrc).not.toMatch(/['"]\/images\//);
  });
});

describe('the scene is decorative and never duplicates the accessible route description', () => {
  it('the whole scene wrapper is aria-hidden, and every Image inside has empty alt text', () => {
    const sceneMatch = pullBriefSrc.match(/\{\(originImage \|\| journeyImage \|\| destinationImage\) && \(([\s\S]*?)\n\s{10}\)\}/);
    expect(sceneMatch).not.toBeNull();
    const scene = sceneMatch![1];
    expect(scene).toMatch(/aria-hidden="true"/);
    const altMatches = scene.match(/alt="[^"]*"/g) ?? [];
    expect(altMatches.length).toBeGreaterThanOrEqual(3); // origin, bridge, destination
    for (const alt of altMatches) expect(alt).toBe('alt=""');
  });

  it('the SVG map still carries the sole accessible journey description, exactly once', () => {
    const matches = pullBriefSrc.match(/aria-label="Journey Map: routes departing Manchester\./g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it('the scene renders behind the SVG, in origin → bridge → destination paint order (later wins on overlap)', () => {
    const originIndex = pullBriefSrc.indexOf('ref={sceneOriginRef}');
    const bridgeIndex = pullBriefSrc.indexOf('ref={sceneBridgeRef}');
    const destinationIndex = pullBriefSrc.indexOf('ref={sceneDestinationRef}');
    const svgIndex = pullBriefSrc.indexOf('<svg');
    expect(originIndex).toBeGreaterThan(-1);
    expect(bridgeIndex).toBeGreaterThan(originIndex);
    expect(destinationIndex).toBeGreaterThan(bridgeIndex);
    expect(svgIndex).toBeGreaterThan(destinationIndex);
  });

  it('the bridge and destination layers start at opacity 0 inline, so there is no pre-hydration flash of the wrong scene', () => {
    const bridgeIndex = pullBriefSrc.indexOf('ref={sceneBridgeRef}');
    const destinationIndex = pullBriefSrc.indexOf('ref={sceneDestinationRef}');
    expect(pullBriefSrc.slice(bridgeIndex, bridgeIndex + 200)).toMatch(/opacity: 0/);
    expect(pullBriefSrc.slice(destinationIndex, destinationIndex + 200)).toMatch(/opacity: 0/);
    // Origin has no such inline override — it's meant to read at full CSS
    // opacity for the instant before hydration (the correct rest scene).
    const originIndex = pullBriefSrc.indexOf('ref={sceneOriginRef}');
    expect(pullBriefSrc.slice(originIndex, originIndex + 200)).not.toMatch(/opacity: 0/);
  });
});

describe('the scene participates in the existing applyP() pipeline — no new animation loop', () => {
  it('three scene refs are declared alongside the other stage refs', () => {
    expect(pullBriefSrc).toMatch(/const sceneOriginRef = useRef<HTMLDivElement \| null>\(null\);/);
    expect(pullBriefSrc).toMatch(/const sceneBridgeRef = useRef<HTMLDivElement \| null>\(null\);/);
    expect(pullBriefSrc).toMatch(/const sceneDestinationRef = useRef<HTMLDivElement \| null>\(null\);/);
  });

  it('applyP() drives all three layers using the imported curve functions, with p as their only input', () => {
    const applyPMatch = pullBriefSrc.match(/const applyP = useCallback\(\(p: number, bow = 0\) => \{([\s\S]*?)\n {2}\}, \[\]\);/);
    expect(applyPMatch).not.toBeNull();
    const body = applyPMatch![1];
    expect(body).toMatch(/if \(sceneOriginRef\.current\) \{[\s\S]*?journeyOriginOpacity\(p\)[\s\S]*?journeyOriginScale\(p\)/);
    expect(body).toMatch(/if \(sceneBridgeRef\.current\) \{[\s\S]*?journeyBridgeOpacity\(p\)/);
    expect(body).toMatch(/if \(sceneDestinationRef\.current\) \{[\s\S]*?journeyDestinationOpacity\(p\)[\s\S]*?journeyDestinationScale\(p\)/);
  });

  it('the curve functions are imported from pull-brief-math, never redefined locally', () => {
    expect(pullBriefSrc).toMatch(
      /journeyOriginOpacity,\s*\n\s*journeyBridgeOpacity,\s*\n\s*journeyDestinationOpacity,\s*\n\s*journeyOriginScale,\s*\n\s*journeyDestinationScale,\s*\n\} from '\.\/pull-brief-math';/
    );
    expect(pullBriefSrc).not.toMatch(/function journeyOriginOpacity/);
    expect(pullBriefSrc).not.toMatch(/function journeyBridgeOpacity/);
    expect(pullBriefSrc).not.toMatch(/function journeyDestinationOpacity/);
  });

  it('no new requestAnimationFrame loop was introduced for the scene (same 4 call sites as before: tweenTo + snapBack, each kickoff + recursive step)', () => {
    const rafCount = (pullBriefSrc.match(/requestAnimationFrame/g) ?? []).length;
    expect(rafCount).toBe(4);
  });

  it('reduced motion is handled once, centrally, by tweenTo/snapBack — applyP itself branches on nothing but p and bow', () => {
    expect(pullBriefSrc).not.toMatch(/sceneOriginRef[\s\S]{0,200}reducedRef/);
    expect(pullBriefSrc).not.toMatch(/sceneBridgeRef[\s\S]{0,200}reducedRef/);
    expect(pullBriefSrc).not.toMatch(/sceneDestinationRef[\s\S]{0,200}reducedRef/);
  });
});

describe('no customer-facing copy, route thread, pull physics or Route Status behaviour changed', () => {
  it('the verdict, evidence, and pin copy still read from statusCopy — never a hardcoded literal', () => {
    expect(pullBriefSrc).toMatch(/statusCopy\.verdictLine/);
    expect(pullBriefSrc).toMatch(/statusCopy\.evidenceDetail/);
    expect(pullBriefSrc).toMatch(/statusCopy\.routeDetail/);
    expect(pullBriefSrc).toMatch(/statusCopy\.changeDetail/);
  });

  it('"Change journey" and the route-check CTA copy are unchanged', () => {
    expect(pullBriefSrc).toContain('Change journey');
    expect(pullBriefSrc).toContain('Open the full route check');
    expect(pullBriefSrc).toContain('href="/routes/manchester-mumbai"');
  });

  it('the handover copy in PullBriefHero is unchanged', () => {
    expect(pullBriefHeroSrc).toContain('Before you book, get a second opinion.');
    expect(pullBriefHeroSrc).toContain('Now check your journey.');
  });

  it('the route thread math (ARC/SPINE/pathAt) and pull-gesture handlers are untouched', () => {
    expect(pullBriefSrc).toContain('const d = pathAt(ARC, SPINE, p, bow);');
    expect(pullBriefSrc).toContain('const onPointerDown = useCallback');
    expect(pullBriefSrc).toContain('const onPointerMove = useCallback');
    expect(pullBriefSrc).toContain('const onPointerUp = useCallback');
  });

  it('PullBrief still receives statusCopy and aimedSlug exactly as before, plus the three new image props', () => {
    const propsMatch = pullBriefSrc.match(/export function PullBrief\(\{([\s\S]*?)\}: \{([\s\S]*?)\}\) \{/);
    expect(propsMatch).not.toBeNull();
    const [, destructured, typed] = propsMatch!;
    expect(destructured).toMatch(/aimedSlug/);
    expect(destructured).toMatch(/statusCopy/);
    expect(destructured).toMatch(/originImage/);
    expect(destructured).toMatch(/journeyImage/);
    expect(destructured).toMatch(/destinationImage/);
    expect(typed).toMatch(/aimedSlug: string \| null/);
    expect(typed).toMatch(/statusCopy: FlagshipStatusCopy/);
  });
});
