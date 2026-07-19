/**
 * Pull a Brief — pure gesture math (Phase 1, Gesture Core).
 *
 * Everything numeric about the signature interaction lives here, separated
 * from the DOM so it can be unit-tested and tuned without touching the
 * component. Values follow the Product Vision v1.0 motion spec and are
 * starting points for feel-tuning, not sacred constants.
 */

export interface CubicPath {
  p0: [number, number];
  c1: [number, number];
  c2: [number, number];
  p1: [number, number];
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

/**
 * Interpolate one cubic path into another (same structure, control-point
 * lerp — no path-morphing library). `bow` adds a downward pull toward the
 * pointer on the outbound half, used only in the pre-detach tension state;
 * it fades with progress so the straightening spine sheds it naturally.
 */
export function pathAt(arc: CubicPath, spine: CubicPath, p: number, bow = 0): string {
  const t = clamp01(p);
  const bowFalloff = bow * (1 - t);
  const x = (a: [number, number], b: [number, number]) => lerp(a[0], b[0], t);
  const y = (a: [number, number], b: [number, number], extra = 0) => lerp(a[1], b[1], t) + extra;
  return [
    `M ${x(arc.p0, spine.p0)} ${y(arc.p0, spine.p0)}`,
    `C ${x(arc.c1, spine.c1)} ${y(arc.c1, spine.c1, bowFalloff * 0.4)},`,
    `${x(arc.c2, spine.c2)} ${y(arc.c2, spine.c2, bowFalloff)},`,
    `${x(arc.p1, spine.p1)} ${y(arc.p1, spine.p1, bowFalloff)}`,
  ].join(' ');
}

/** Point the destination node sits at for a given progress (the path's end). */
export function endPointAt(arc: CubicPath, spine: CubicPath, p: number): [number, number] {
  const t = clamp01(p);
  return [lerp(arc.p1[0], spine.p1[0], t), lerp(arc.p1[1], spine.p1[1], t)];
}

/** Detach threshold in CSS px — spec: clamp(72px, 12vh, 110px). */
export function detachThreshold(viewportHeight: number): number {
  return clamp(viewportHeight * 0.12, 72, 110);
}

/** Drag distance beyond the threshold that maps to a full unroll. */
export const PULL_RANGE_PX = 340;

/** Scrub mapping: px pulled beyond the detach threshold → progress 0..1. */
export function pullProgress(pxBeyondThreshold: number, range: number = PULL_RANGE_PX): number {
  return clamp01(pxBeyondThreshold / range);
}

/** Rubber-band tension: displayed bow (viewBox units) for a pre-threshold drag. */
export function tensionBow(dragPx: number): number {
  return clamp(dragPx * 0.6, 0, 24);
}

/** Velocity above which a release flings the unroll to completion. */
export const FLING_VELOCITY_PX_S = 1200;

/**
 * Fling completion duration: finish at the gesture's own speed, capped at
 * 500ms (spec). Slow-but-committed releases use the default 650ms tween.
 */
export function flingDuration(remainingProgress: number, velocityPxS: number, range: number = PULL_RANGE_PX): number {
  const remainingPx = clamp01(remainingProgress) * range;
  if (velocityPxS <= 0) return 500;
  return clamp((remainingPx / velocityPxS) * 1000, 80, 500);
}

/**
 * Per-pin reveal: pin `i` of `n` fades/rises as the spine passes it. The
 * first pin must be fully legible early (spec: by p≈0.15) so an aborted
 * pull still teaches something true.
 */
export function pinReveal(p: number, i: number, n: number): number {
  const start = 0.1 + (i * 0.72) / Math.max(1, n);
  const window = 0.08;
  return clamp01((clamp01(p) - start) / window);
}

/** Verdict strip reveals first of all — legible almost immediately. */
export function verdictReveal(p: number): number {
  return clamp01((clamp01(p) - 0.04) / 0.08);
}

/** Whether a release should complete the unroll (committed) or return. */
export function shouldComplete(p: number, velocityPxS: number): boolean {
  return velocityPxS >= FLING_VELOCITY_PX_S || p >= 0.5;
}

/** Ease-out cubic used by fling completion (continues the gesture's momentum). */
export function easeOutCubic(t: number): number {
  const u = clamp01(t);
  return 1 - Math.pow(1 - u, 3);
}

/**
 * Ease-in-out cubic for click/Enter auto-opens and rollback — a breath of
 * anticipation then a calm landing, so a programmatic open reads as "drawn
 * by a hand" rather than played back.
 */
export function easeInOutCubic(t: number): number {
  const u = clamp01(t);
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
}

/**
 * Gentle magnetism at the end of the pull: past p=0.9 the displayed progress
 * runs slightly ahead of the finger, so the last few millimetres feel like
 * the Brief *wants* to complete. Continuous at the joint, capped at 1, and
 * identity below it — the 1:1 scrub honesty holds for 90% of the travel.
 */
export function magnetAssist(p: number): number {
  const u = clamp01(p);
  if (u <= 0.9) return u;
  return Math.min(1, 0.9 + (u - 0.9) * 1.6);
}

/**
 * The map steps back eagerly once the pull commits (ease-out on the recede
 * channels) — the world reacts to the decision immediately, then settles.
 */
export function mapRecede(p: number): number {
  return easeOutCubic(p);
}

/**
 * Elastic snap-back: the bow returns to rest through one small damped
 * counter-swing (a twang, not a cut). t=0 → full bow, t=1 → 0, with a brief
 * negative excursion after t≈0.4 that decays quadratically.
 */
export function snapBackBow(t: number, initialBow: number): number {
  const u = clamp01(t);
  return initialBow * Math.pow(1 - u, 2) * Math.cos(u * Math.PI * 1.25);
}
