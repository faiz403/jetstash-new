import { describe, it, expect } from 'vitest';
import {
  type CubicPath,
  pathAt,
  endPointAt,
  detachThreshold,
  pullProgress,
  tensionBow,
  flingDuration,
  pinReveal,
  verdictReveal,
  shouldComplete,
  easeOutCubic,
  easeInOutCubic,
  magnetAssist,
  mapRecede,
  snapBackBow,
  FLING_VELOCITY_PX_S,
  PULL_RANGE_PX,
} from '@/components/homepage-v2/pull-brief-math';

/**
 * Pull a Brief — Gesture Core math (Phase 1). These are the numbers a motion
 * designer tunes; the tests pin the *contract* (clamping, monotonicity,
 * spec-mandated caps and reveal orders), not the exact feel values.
 */

const ARC: CubicPath = { p0: [214, 254], c1: [360, 196], c2: [863, 468], p1: [1397, 894] };
const SPINE: CubicPath = { p0: [180, 215], c1: [180, 445], c2: [180, 705], p1: [180, 925] };

describe('pathAt — the arc-to-spine interpolation', () => {
  it('returns the exact arc at p=0 and the exact spine at p=1', () => {
    expect(pathAt(ARC, SPINE, 0)).toBe('M 214 254 C 360 196, 863 468, 1397 894');
    expect(pathAt(ARC, SPINE, 1)).toBe('M 180 215 C 180 445, 180 705, 180 925');
  });

  it('clamps out-of-range progress instead of extrapolating', () => {
    expect(pathAt(ARC, SPINE, -0.5)).toBe(pathAt(ARC, SPINE, 0));
    expect(pathAt(ARC, SPINE, 1.7)).toBe(pathAt(ARC, SPINE, 1));
  });

  it('bow displaces the outbound half downward at p=0 and vanishes by p=1', () => {
    const bowed = pathAt(ARC, SPINE, 0, 20);
    expect(bowed).toContain('1397 914'); // endpoint x untouched, y bowed by 20 at p=0
    expect(pathAt(ARC, SPINE, 1, 20)).toBe(pathAt(ARC, SPINE, 1, 0)); // sheds bow fully
  });

  it('endPointAt tracks the destination node along the same interpolation', () => {
    expect(endPointAt(ARC, SPINE, 0)).toEqual([1397, 894]);
    expect(endPointAt(ARC, SPINE, 1)).toEqual([180, 925]);
    const [mx, my] = endPointAt(ARC, SPINE, 0.5);
    expect(mx).toBeCloseTo((1397 + 180) / 2);
    expect(my).toBeCloseTo((894 + 925) / 2);
  });
});

describe('detachThreshold — spec: clamp(72px, 12vh, 110px)', () => {
  it('floors at 72px on short viewports', () => {
    expect(detachThreshold(500)).toBe(72);
  });
  it('caps at 110px on tall viewports', () => {
    expect(detachThreshold(2000)).toBe(110);
  });
  it('tracks 12vh in between', () => {
    expect(detachThreshold(800)).toBeCloseTo(96);
  });
});

describe('pullProgress — scrub mapping', () => {
  it('is 0 at the threshold and 1 at the full pull range', () => {
    expect(pullProgress(0)).toBe(0);
    expect(pullProgress(PULL_RANGE_PX)).toBe(1);
    expect(pullProgress(PULL_RANGE_PX * 2)).toBe(1);
    expect(pullProgress(-40)).toBe(0);
  });
});

describe('tensionBow — rubber-band resistance', () => {
  it('is proportional below the cap and hard-capped at 24 viewBox units', () => {
    expect(tensionBow(10)).toBeCloseTo(6);
    expect(tensionBow(100)).toBe(24);
    expect(tensionBow(-10)).toBe(0);
  });
});

describe('flingDuration — completes at gesture speed, capped 500ms', () => {
  it('caps at 500ms regardless of how much remains', () => {
    expect(flingDuration(1, 100)).toBe(500);
  });
  it('finishes faster for faster gestures, floored so it never pops', () => {
    const fast = flingDuration(0.5, 500); // 170px remaining → 340ms
    const faster = flingDuration(0.5, 1000); // → 170ms
    expect(fast).toBeCloseTo(340);
    expect(faster).toBeCloseTo(170);
    expect(fast).toBeGreaterThan(faster);
    expect(flingDuration(0.01, 100000)).toBe(80); // floor: never an instant pop
  });
});

describe('reveal order — value arrives before the gesture completes', () => {
  it('the verdict is fully legible by p≈0.12', () => {
    expect(verdictReveal(0.12)).toBeCloseTo(1, 10);
    expect(verdictReveal(0)).toBe(0);
  });
  it('the first pin is fully revealed by p=0.2 (spec: legible early)', () => {
    expect(pinReveal(0.2, 0, 9)).toBeCloseTo(1, 10);
  });
  it('pins reveal strictly in journey order', () => {
    const n = 9;
    const p = 0.5;
    for (let i = 1; i < n; i++) {
      expect(pinReveal(p, i, n)).toBeLessThanOrEqual(pinReveal(p, i - 1, n));
    }
  });
  it('every pin is fully revealed at p=1', () => {
    const n = 9;
    for (let i = 0; i < n; i++) {
      expect(pinReveal(1, i, n)).toBe(1);
    }
  });
});

describe('shouldComplete — commitment rules', () => {
  it('completes past halfway regardless of speed', () => {
    expect(shouldComplete(0.51, 0)).toBe(true);
  });
  it('completes below halfway only on a genuine fling', () => {
    expect(shouldComplete(0.2, FLING_VELOCITY_PX_S)).toBe(true);
    expect(shouldComplete(0.2, FLING_VELOCITY_PX_S - 1)).toBe(false);
  });
});

describe('easeOutCubic', () => {
  it('starts at 0, ends at 1, and decelerates', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
    expect(easeOutCubic(2)).toBe(1);
  });
});

describe('easeInOutCubic — the "drawn by a hand" curve for programmatic opens', () => {
  it('starts at 0, crosses 0.5 at midpoint, ends at 1, and clamps', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(-1)).toBe(0);
    expect(easeInOutCubic(2)).toBe(1);
  });
  it('has a slow start (anticipation) compared to ease-out', () => {
    expect(easeInOutCubic(0.15)).toBeLessThan(easeOutCubic(0.15));
  });
});

describe('magnetAssist — 1:1 honesty for 90% of travel, gentle pull-home after', () => {
  it('is identity at and below p=0.9', () => {
    expect(magnetAssist(0.3)).toBe(0.3);
    expect(magnetAssist(0.9)).toBeCloseTo(0.9);
  });
  it('is continuous at the joint and runs slightly ahead beyond it', () => {
    expect(magnetAssist(0.91)).toBeCloseTo(0.916);
    expect(magnetAssist(0.95)).toBeGreaterThan(0.95);
  });
  it('reaches and caps at 1', () => {
    expect(magnetAssist(0.97)).toBe(1);
    expect(magnetAssist(1.5)).toBe(1);
  });
});

describe('mapRecede — the world steps back early', () => {
  it('leads linear progress mid-pull and matches at the ends', () => {
    expect(mapRecede(0)).toBe(0);
    expect(mapRecede(1)).toBe(1);
    expect(mapRecede(0.3)).toBeGreaterThan(0.3);
  });
});

describe('snapBackBow — a twang, not a cut', () => {
  it('starts at the full bow and lands exactly at zero', () => {
    expect(snapBackBow(0, 20)).toBeCloseTo(20);
    expect(snapBackBow(1, 20)).toBeCloseTo(0);
  });
  it('swings through one small negative excursion (the elastic counter-swing)', () => {
    expect(snapBackBow(0.7, 20)).toBeLessThan(0);
    // …and the excursion is small relative to the initial bow, so it reads
    // as material memory, not wobble.
    expect(Math.abs(snapBackBow(0.7, 20))).toBeLessThan(20 * 0.15);
  });
});
