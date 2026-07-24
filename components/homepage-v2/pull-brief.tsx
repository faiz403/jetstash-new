'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, CalendarClock, CheckCircle2, Circle } from 'lucide-react';
import {
  ORIGIN,
  CLIMB_OUT,
  DESTINATIONS,
  routePath,
  type AtlasDestination,
} from '@/components/sections/route-map-hero';
import type { BrandImage } from '@/lib/brand-images';
import type { FlagshipStatusCopy } from '@/lib/flagship-status-copy';
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
  journeyOriginOpacity,
  journeyBridgeOpacity,
  journeyDestinationOpacity,
  journeyOriginScale,
  journeyDestinationScale,
} from './pull-brief-math';

/**
 * Pull a Brief — the Gesture Core (Product Vision v1.0, Phase 1).
 *
 * The Manchester→Mumbai arc is a thread you pull off the map; as you pull,
 * the arc's control points interpolate into a vertical spine and the Journey
 * Brief pins reveal in journey order, scrubbed 1:1 by the drag. Nothing here
 * plays on a timer while the pointer is down — the user owns the tempo.
 * Click/tap, Enter/Space, and type-to-aim all drive the same transformation;
 * reduced motion collapses it to a crossfade with identical structure.
 *
 * Rendering strategy: all Brief content is in the DOM from the first server
 * render (SSR/crawlers see the full evidence); hydration then drives styles
 * imperatively via refs + rAF so scrubbing never re-renders React. A
 * <noscript> style block gives no-JS visitors the settled Brief statically.
 *
 * Every pin is the existing evidence library in its honest current state —
 * nothing fabricated, unavailable intelligence stays visibly unavailable.
 */

// Cropped tight to the Manchester→Mumbai corridor, not the whole atlas: the
// flagship arc is the hero object, so we sacrifice geographical completeness
// for a large, unmistakable route. Still contains the spine (x=180) and both
// endpoint labels, so the one-object transformation is unaffected.
const VB = { x: 150, y: 172, w: 1330, h: 764 };

const FLAGSHIP_SLUG = 'mumbai';
const flagship = DESTINATIONS.find((d) => d.slug === FLAGSHIP_SLUG)!;

const ARC: CubicPath = {
  p0: [ORIGIN.x, ORIGIN.y],
  c1: [CLIMB_OUT[0], CLIMB_OUT[1]],
  c2: [flagship.c2[0], flagship.c2[1]],
  p1: [flagship.x, flagship.y],
};

/** The straightened form: a vertical spine on the left of the stage. */
const SPINE: CubicPath = {
  p0: [180, 215],
  c1: [180, 445],
  c2: [180, 705],
  p1: [180, 925],
};

// FlagshipStatusCopy is defined in lib/flagship-status-copy.ts (imported
// above) — computed server-side from the Route Status V1 ledger via
// buildFlagshipStatusCopy()/mapViewModelToFlagshipCopy() and passed in as a
// prop. This component never re-derives or hand-authors a claim about the
// withdrawal itself — see the Route Status V1 implementation addendum §3:
// "Feed this surface from the same safe Route Status presentation model. Do
// not create an independent second truth system."

// Ordered as the reveal should read: what we've verified first, then the
// things we deliberately won't fake, then what becomes yours when you add your
// details, and finally the evidence trail. Every "pending" line is framed as a
// promise of honesty, never an apology for missing data. The Evidence pin uses
// statusCopy.evidenceDetail — the only evidence text this component renders;
// it carries no independent airline/date/review claim of its own (see the
// Route Status V1 evidence-leak fix: FlagshipStatusCopy is the single source
// of truth here, never lib/journey-brief-manchester-mumbai's separate bundle).
function buildPins(statusCopy: FlagshipStatusCopy): { key: string; label: string; state: 'ready' | 'flag' | 'pending'; detail: string }[] {
  return [
    { key: 'route', label: 'Route status', state: 'ready', detail: statusCopy.routeDetail },
    { key: 'change', label: 'Service change', state: 'flag', detail: statusCopy.changeDetail },
    { key: 'economy', label: 'Fares', state: 'pending', detail: 'We won’t show you a price we haven’t checked ourselves this week.' },
    { key: 'baggage', label: 'Baggage', state: 'pending', detail: 'We’ll confirm the baggage allowance with the airline rather than guess.' },
    { key: 'business', label: 'Business Class', state: 'pending', detail: 'We’ll only confirm Business Class once the airline does.' },
    { key: 'bookby', label: 'Best time to book', state: 'pending', detail: 'We’ll tell you when to book once we’ve tracked this route’s prices.' },
    { key: 'ready', label: 'Travel Ready', state: 'pending', detail: 'Add your dates and passport and we’ll check if you’re ready to fly.' },
    { key: 'evidence', label: 'Evidence', state: 'ready', detail: statusCopy.evidenceDetail },
  ];
}

function PinIcon({ state }: { state: 'ready' | 'flag' | 'pending' }) {
  if (state === 'ready') return <CheckCircle2 className="h-4 w-4 shrink-0 text-brass-400" strokeWidth={2} aria-hidden="true" />;
  if (state === 'flag') return <CalendarClock className="h-4 w-4 shrink-0 text-terracotta-400" strokeWidth={2} aria-hidden="true" />;
  return <Circle className="h-4 w-4 shrink-0 text-ink-500" strokeWidth={2} aria-hidden="true" />;
}

type Phase = 'rest' | 'tension' | 'unroll' | 'settled';

export function PullBrief({
  aimedSlug,
  statusCopy,
  originImage,
  journeyImage,
  destinationImage,
}: {
  aimedSlug: string | null;
  statusCopy: FlagshipStatusCopy;
  /** Manchester Airport, resolved server-side via getAirportImage('manchester') — dominant at rest, receded by the middle of the pull. This component never resolves its own images; each is null (renders nothing) if the asset isn't present, matching every other brand-image call site's fallback contract. */
  originImage: BrandImage | null;
  /** The Manchester→Mumbai composite photograph, resolved server-side via getHeroImage('manchester-mumbai-journey') — the visual bridge through the middle of the pull. */
  journeyImage: BrandImage | null;
  /** Mumbai, resolved server-side via getDestinationImage('mumbai') — arrives late in the pull and remains as the open Journey Brief's backdrop. */
  destinationImage: BrandImage | null;
}) {
  /* Discrete phase drives React; continuous progress never touches state. */
  const [settled, setSettled] = useState(false);
  const [announce, setAnnounce] = useState('');
  const PINS = useMemo(() => buildPins(statusCopy), [statusCopy]);

  const phaseRef = useRef<Phase>('rest');
  const pRef = useRef(0);
  const bowRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const reducedRef = useRef(false);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const sceneOriginRef = useRef<HTMLDivElement | null>(null);
  const sceneBridgeRef = useRef<HTMLDivElement | null>(null);
  const sceneDestinationRef = useRef<HTMLDivElement | null>(null);
  const flagPathRef = useRef<SVGPathElement | null>(null);
  const glowPathRef = useRef<SVGPathElement | null>(null);
  const shimmerRef = useRef<SVGPathElement | null>(null);
  const nodeRef = useRef<SVGCircleElement | null>(null);
  const mapLayerRef = useRef<SVGGElement | null>(null);
  const tabRef = useRef<HTMLButtonElement | null>(null);
  const briefRef = useRef<HTMLDivElement | null>(null);
  const verdictRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const truthRef = useRef<HTMLDivElement | null>(null);

  const drag = useRef({ active: false, startY: 0, lastY: 0, lastT: 0, velocity: 0, moved: false, downT: 0 });

  const aimed = aimedSlug === FLAGSHIP_SLUG;

  /* ── Apply a progress value to every layer, imperatively ─────────────── */
  const applyP = useCallback((p: number, bow = 0) => {
    pRef.current = p;
    bowRef.current = bow;
    const d = pathAt(ARC, SPINE, p, bow);
    flagPathRef.current?.setAttribute('d', d);
    glowPathRef.current?.setAttribute('d', d);
    const [ex, ey] = endPointAt(ARC, SPINE, p);
    if (nodeRef.current) {
      nodeRef.current.setAttribute('cx', String(ex));
      nodeRef.current.setAttribute('cy', String(ey + tensionOffset(bow)));
      // The thread-end swells slightly under grip and settles a touch larger.
      nodeRef.current.setAttribute('r', String(6.5 + Math.max(0, bow) * 0.06 + p * 1.5));
    }
    if (shimmerRef.current) {
      // The invitation light exists only in true rest — the instant the
      // gesture begins, the thread is yours, not the page's.
      shimmerRef.current.style.visibility = p > 0.001 || Math.abs(bow) > 0.5 ? 'hidden' : '';
    }
    if (mapLayerRef.current) {
      // Ease-out recede: the world steps back as soon as the pull commits.
      const m = mapRecede(p);
      mapLayerRef.current.style.opacity = String(1 - 0.72 * m);
      mapLayerRef.current.style.transform = `scale(${1 - 0.08 * m})`;
    }
    // The journey scene: Manchester recedes, the composite bridges the
    // middle of the pull, Mumbai arrives as the open Brief's backdrop — one
    // continuous transport, driven by the same `p` as everything else here
    // (journeyOrigin/Bridge/DestinationOpacity, pull-brief-math.ts). Peak
    // amplitudes are capped below 1 (never full-strength) so the route
    // thread, labels and — once open — the Brief stay the dominant object.
    if (sceneOriginRef.current) {
      sceneOriginRef.current.style.opacity = String(journeyOriginOpacity(p) * 0.62);
      sceneOriginRef.current.style.transform = `scale(${journeyOriginScale(p)})`;
    }
    if (sceneBridgeRef.current) {
      sceneBridgeRef.current.style.opacity = String(journeyBridgeOpacity(p) * 0.58);
    }
    if (sceneDestinationRef.current) {
      sceneDestinationRef.current.style.opacity = String(journeyDestinationOpacity(p) * 0.62);
      sceneDestinationRef.current.style.transform = `scale(${journeyDestinationScale(p)})`;
    }
    if (tabRef.current) {
      tabRef.current.style.opacity = String(Math.max(0, 1 - p * 4));
      tabRef.current.style.pointerEvents = p > 0.2 ? 'none' : '';
      // An invisible button must not stay keyboard-focusable.
      tabRef.current.style.visibility = p > 0.25 ? 'hidden' : '';
    }
    if (verdictRef.current) {
      const v = verdictReveal(p);
      verdictRef.current.style.opacity = String(v);
      verdictRef.current.style.transform = `translateY(${12 * (1 - v)}px)`;
    }
    if (briefRef.current) {
      const items = briefRef.current.querySelectorAll<HTMLElement>('[data-pin]');
      items.forEach((el, i) => {
        const r = pinReveal(p, i, items.length);
        el.style.opacity = String(r);
        el.style.transform = `translateY(${12 * (1 - r)}px)`;
      });
      // Must be 'auto', not '': the container carries the `pointer-events-none`
      // class, so clearing the inline value falls back to that class (still
      // none) and leaves the Brief's controls untappable when open.
      briefRef.current.style.pointerEvents = p > 0.9 ? 'auto' : 'none';
    }
    if (barRef.current) {
      barRef.current.style.opacity = p >= 0.98 ? '1' : '0';
      // 'auto' (not '') for the same reason as the Brief container above —
      // this is what makes "Change journey" tappable once settled.
      barRef.current.style.pointerEvents = p >= 0.98 ? 'auto' : 'none';
    }
    if (truthRef.current) {
      // The surfaced truth fades as the Brief is pulled open (the reveal
      // carries the verdict in full). Clearing the inline value at rest lets
      // its one-time entrance animation play and keeps it present.
      truthRef.current.style.opacity = p > 0.001 ? String(Math.max(0, 1 - p * 4)) : '';
    }
    function tensionOffset(b: number) {
      return b * (1 - p);
    }
  }, []);

  /* ── Programmatic tween (fling / auto-open / rollback) ───────────────── */
  const tweenTo = useCallback(
    (target: number, ms: number, easing: (t: number) => number = easeOutCubic, onDone?: () => void) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (reducedRef.current || ms <= 0) {
        applyP(target);
        onDone?.();
        return;
      }
      const from = pRef.current;
      const start = performance.now();
      const step = (now: number) => {
        const raw = (now - start) / ms;
        const t = easing(raw);
        applyP(from + (target - from) * t);
        if (raw < 1) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          applyP(target);
          onDone?.();
        }
      };
      rafRef.current = requestAnimationFrame(step);
    },
    [applyP]
  );

  /* Elastic snap-back: tween the *bow* home through one damped counter-swing. */
  const snapBack = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const b0 = bowRef.current;
    if (reducedRef.current || b0 === 0) {
      applyP(0, 0);
      return;
    }
    const ms = 260;
    const start = performance.now();
    const step = (now: number) => {
      const t = (now - start) / ms;
      if (t < 1) {
        applyP(0, snapBackBow(t, b0));
        rafRef.current = requestAnimationFrame(step);
      } else {
        applyP(0, 0);
      }
    };
    rafRef.current = requestAnimationFrame(step);
  }, [applyP]);

  const open = useCallback(
    (ms = 700, easing: (t: number) => number = easeInOutCubic) => {
      phaseRef.current = 'unroll';
      tweenTo(1, reducedRef.current ? 0 : ms, easing, () => {
        phaseRef.current = 'settled';
        setSettled(true);
        setAnnounce('Journey Brief opened: Manchester to Mumbai, 8 items.');
        // The landing: a small dip-and-settle so the spine arrives with
        // weight, plus a soft settle tick where haptics exist.
        if (!reducedRef.current && briefRef.current?.animate) {
          briefRef.current.animate(
            [{ transform: 'translateY(4px)' }, { transform: 'translateY(0px)' }],
            { duration: 180, easing: 'cubic-bezier(0.16,1,0.3,1)' }
          );
        }
        try {
          navigator.vibrate?.(8);
        } catch {
          /* noop */
        }
        barRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
      });
    },
    [tweenTo]
  );

  const close = useCallback(() => {
    phaseRef.current = 'unroll';
    setSettled(false);
    tweenTo(0, reducedRef.current ? 0 : 450, easeInOutCubic, () => {
      phaseRef.current = 'rest';
      setAnnounce('Journey Brief closed. Back to the map.');
      tabRef.current?.focus();
    });
  }, [tweenTo]);

  /* ── Pointer gesture on the pull-tab ─────────────────────────────────── */
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (phaseRef.current === 'settled' || reducedRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      active: true,
      startY: e.clientY,
      lastY: e.clientY,
      lastT: performance.now(),
      velocity: 0,
      moved: false,
      downT: performance.now(),
    };
    phaseRef.current = 'tension';
    try {
      navigator.vibrate?.(10);
    } catch {
      /* best-effort haptic — absent on iOS web */
    }
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const st = drag.current;
      if (!st.active) return;
      e.preventDefault();
      const now = performance.now();
      const dy = Math.max(0, e.clientY - st.startY);
      const dt = now - st.lastT;
      if (dt > 0) st.velocity = ((e.clientY - st.lastY) / dt) * 1000;
      st.lastY = e.clientY;
      st.lastT = now;
      if (dy > 6) st.moved = true;

      const threshold = detachThreshold(window.innerHeight);
      if (dy < threshold && phaseRef.current !== 'unroll') {
        applyP(0, tensionBow(dy));
      } else {
        if (phaseRef.current !== 'unroll') {
          phaseRef.current = 'unroll';
          try {
            navigator.vibrate?.(12);
          } catch {
            /* noop */
          }
        }
        // 1:1 for 90% of the travel; gentle magnetism over the last stretch
        // so the Brief wants to complete under a committed finger.
        applyP(magnetAssist(pullProgress(dy - threshold)));
      }
    },
    [applyP]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const st = drag.current;
      if (!st.active) return;
      st.active = false;
      const clickLike = !st.moved && performance.now() - st.downT < 300;

      if (reducedRef.current) {
        if (clickLike) open(0);
        return;
      }
      if (clickLike && phaseRef.current !== 'unroll') {
        open(700, easeInOutCubic);
        return;
      }
      if (phaseRef.current === 'tension') {
        /* Below threshold: elastic snap-back (a twang, not a cut). */
        phaseRef.current = 'rest';
        snapBack();
        return;
      }
      const p = pRef.current;
      const v = Math.max(0, st.velocity);
      if (shouldComplete(p, v)) {
        /* A fling completes on the gesture's own momentum (ease-out);
           a slow committed release gets the calmer two-beat landing. */
        if (v > 0) open(flingDuration(1 - p, v), easeOutCubic);
        else open(650, easeInOutCubic);
      } else {
        phaseRef.current = 'unroll';
        tweenTo(0, 450, easeInOutCubic, () => {
          phaseRef.current = 'rest';
        });
      }
    },
    [open, tweenTo, snapBack]
  );

  /* ── Keyboard: Enter/Space open, Esc closes (global when settled) ────── */
  const onTabKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open(reducedRef.current ? 0 : 700);
      }
    },
    [open]
  );

  useEffect(() => {
    if (!settled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [settled, close]);

  /* ── Hydration setup: collapse to rest state, honour reduced motion ──── */
  useEffect(() => {
    reducedRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (stageRef.current) stageRef.current.dataset.hydrated = 'true';
    applyP(0);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* React re-renders (e.g. the aim prop changing while the Brief is open)
     re-apply JSX attributes like the path's `d` — restore the imperative
     gesture state after every commit so a keystroke can never snap the
     thread back to its rest form. */
  useEffect(() => {
    applyP(pRef.current);
  });

  /* Type-to-aim: opening via the hero's input (Enter on a flagship match). */
  useEffect(() => {
    const handler = () => open(reducedRef.current ? 0 : 700);
    window.addEventListener('jetstash:pull-flagship', handler);
    return () => window.removeEventListener('jetstash:pull-flagship', handler);
  }, [open]);

  /* Rest-state paths for non-flagship threads, memoised once. */
  const restThreads = useMemo(() => DESTINATIONS.filter((d) => d.slug !== FLAGSHIP_SLUG), []);

  const tabLeft = `${((flagship.x - VB.x) / VB.w) * 100}%`;
  const tabTop = `${((flagship.y - VB.y) / VB.h) * 100}%`;

  return (
    <div ref={stageRef} className="pb-stage relative" data-hydrated="false">
      {/* No-JS: hide the interactive map, show the Brief statically. */}
      <noscript>
        <style>{`
          .pb-stage .pb-map { display: none; }
          .pb-stage .pb-brief { position: static !important; opacity: 1 !important; width: 100% !important; max-height: none !important; overflow: visible !important; }
          .pb-stage .pb-brief [data-pin], .pb-stage .pb-verdict { opacity: 1 !important; transform: none !important; }
          .pb-stage .pb-tab { display: none; }
        `}</style>
      </noscript>

      {/* ── The Desk: map + morphing thread ──────────────────────────────── */}
      <div className="pb-map relative">
        {/* Width cap tightens on short viewports (common laptops) so the whole
            stage — pull handle included — stays inside the first screen. */}
        <div className="relative mx-auto aspect-[1330/764] w-full max-w-[920px] [@media(max-height:820px)]:max-w-[640px]">
          {/* The journey scene — decorative, never the accessible description
              (the SVG's own aria-label already carries that). Three photographs
              staged across the same pull progress as one continuous transport:
              Manchester (dominant at rest) recedes into the Manchester–Mumbai
              composite (the middle bridge), which in turn gives way to Mumbai
              (the open Brief's backdrop) — see applyP()'s scene block for the
              curves. Each layer renders only when its asset resolves; stays
              behind the SVG purely through DOM order (both are
              unpositioned-by-z-index absolute layers, so later wins). Bridge
              and destination start at opacity 0 inline (not just via applyP)
              so there's no pre-hydration flash of the wrong scene. */}
          {(originImage || journeyImage || destinationImage) && (
            <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ transition: 'none' }}>
              {originImage && (
                <div ref={sceneOriginRef} className="absolute inset-0" style={{ transformOrigin: '50% 50%', transition: 'none' }}>
                  <Image
                    src={originImage.src}
                    alt=""
                    fill
                    priority
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 920px"
                    className="object-cover object-center"
                  />
                </div>
              )}
              {journeyImage && (
                <div ref={sceneBridgeRef} className="absolute inset-0" style={{ transformOrigin: '50% 50%', transition: 'none', opacity: 0 }}>
                  <Image
                    src={journeyImage.src}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 920px"
                    className="object-cover object-center"
                  />
                </div>
              )}
              {destinationImage && (
                <div ref={sceneDestinationRef} className="absolute inset-0" style={{ transformOrigin: '50% 50%', transition: 'none', opacity: 0 }}>
                  <Image
                    src={destinationImage.src}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 920px"
                    className="object-cover object-center"
                  />
                </div>
              )}
              {/* Constant darkening (not p-driven — the Brief's own pin/bar
                  backgrounds carry the rest of the contrast once open) so
                  every scene state stays legible against the labels and,
                  later, the Brief. */}
              <div className="absolute inset-0 bg-gradient-to-b from-ink-950/15 via-ink-950/25 to-ink-950/65" />
            </div>
          )}
          <svg
            viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
            className="absolute inset-0 h-full w-full"
            role="img"
            aria-label="Journey Map: routes departing Manchester. The Manchester to Mumbai route can be pulled open into a Journey Brief."
          >
            <defs>
              <linearGradient id="pb-active" gradientUnits="userSpaceOnUse" x1={ORIGIN.x} y1={ORIGIN.y} x2={flagship.x} y2={flagship.y}>
                <stop offset="0" stopColor="#F7F2E9" stopOpacity="0.95" />
                <stop offset="0.45" stopColor="#E0B158" />
                <stop offset="1" stopColor="#C8932E" />
              </linearGradient>
              <radialGradient id="pb-man-glow" cx="0.5" cy="0.5" r="0.5">
                <stop offset="0" stopColor="#F7F2E9" stopOpacity="0.5" />
                <stop offset="0.5" stopColor="#E0B158" stopOpacity="0.16" />
                <stop offset="1" stopColor="#C8932E" stopOpacity="0" />
              </radialGradient>
              <filter id="pb-soft" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="4.5" />
              </filter>
            </defs>

            {/* Recessive map layer: the rest of the atlas is a faint ghost so
                the flagship route reads as the single hero object. */}
            <g ref={mapLayerRef} style={{ transformOrigin: '50% 50%', transition: 'none' }}>
              <g fill="none" stroke="#C8932E" strokeWidth="1" strokeLinecap="round">
                {restThreads.map((d: AtlasDestination) => (
                  <path key={d.slug} d={routePath(d)} strokeOpacity={0.09} strokeDasharray={d.direct ? undefined : '2 7'} />
                ))}
              </g>
              <circle cx={ORIGIN.x} cy={ORIGIN.y} r="52" fill="url(#pb-man-glow)" opacity="0.95" />
              <circle cx={ORIGIN.x} cy={ORIGIN.y} r="11" fill="none" stroke="#E0B158" strokeWidth="1.4" />
              <circle cx={ORIGIN.x} cy={ORIGIN.y} r="5" fill="#F7F2E9" />
              {/* Endpoint labels anchored inward so the tight crop never
                  clips them: Manchester reads rightward from its node,
                  Mumbai sits clear above its node (the pull-tab is below). */}
              <text x={ORIGIN.x + 18} y={ORIGIN.y + 44} textAnchor="start" fontFamily="var(--font-display), Georgia, serif" fontSize="26" fill="#F7F2E9">
                Manchester
              </text>
              <text x={flagship.x} y={flagship.y - 150} textAnchor="middle" fontFamily="var(--font-display), Georgia, serif" fontSize="26" fill="#F7F2E9">
                Mumbai
              </text>
            </g>

            {/* The flagship thread — the object that transforms. Bold and bright. */}
            <g fill="none" strokeLinecap="round">
              <path ref={glowPathRef} d={pathAt(ARC, SPINE, 0)} stroke="#C8932E" strokeWidth="11" strokeOpacity="0.22" filter="url(#pb-soft)" />
              <path
                ref={flagPathRef}
                d={pathAt(ARC, SPINE, 0)}
                stroke="url(#pb-active)"
                strokeWidth={aimed ? 4.4 : 3.6}
                className={aimed ? 'pb-thread-aimed' : undefined}
              />
              {/* On load, a single filament of light travels the thread once,
                  Manchester → Mumbai, then fades at the destination as the
                  verdict resolves below — the light finding the fact. Not a
                  loop; hidden the instant the gesture begins (applyP). */}
              <path
                ref={shimmerRef}
                d={pathAt(ARC, SPINE, 0)}
                stroke="#F7F2E9"
                strokeWidth="3.6"
                className="pb-shimmer"
                aria-hidden="true"
              />
              <circle ref={nodeRef} cx={flagship.x} cy={flagship.y} r="6" fill="#E0B158" />
            </g>
          </svg>

          {/* The pull-tab: a real button, ≥44px, overlaid at the Mumbai end. */}
          <button
            ref={tabRef}
            type="button"
            aria-expanded={settled}
            aria-label="Pull open the Manchester to Mumbai check"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={onTabKeyDown}
            onClick={() => {
              // Reduced motion disables the drag pipeline entirely, so the
              // plain click event carries the open instead (instant crossfade).
              if (reducedRef.current && phaseRef.current === 'rest') open(0);
            }}
            className="pb-tab group absolute z-10 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none items-center justify-center rounded-full active:cursor-grabbing"
            style={{ left: tabLeft, top: tabTop }}
          >
            {/* Idle cue: a brass ring pulses outward from the handle so the
                signature interaction is unmistakable in the first second.
                Reduced motion collapses it via the global rule in globals.css. */}
            <span
              aria-hidden="true"
              className="pb-tab-halo pointer-events-none absolute inset-0 m-auto h-14 w-14 rounded-full border-2 border-brass-300"
            />
            {/* Solid brass handle — the primary object on the stage, reading as
                the one thing to grab. */}
            <span
              aria-hidden="true"
              className={`relative flex h-14 w-14 items-center justify-center rounded-full shadow-brass-glow transition-[transform,background-color] duration-150 group-active:scale-90 ${
                aimed ? 'bg-brass-300 text-ink-900' : 'bg-brass text-ink-900 group-hover:bg-brass-300'
              }`}
            >
              <ArrowRight
                className="h-6 w-6 rotate-90 transition-transform duration-150 group-hover:translate-y-0.5"
                strokeWidth={2.5}
              />
            </span>
            {/* Label sits to the LEFT of the handle, reading toward it — so it
                can never clip off the right edge where Mumbai sits. */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-full top-1/2 mr-2.5 flex -translate-y-1/2 items-center whitespace-nowrap rounded-full bg-ink-900/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-brass-100 ring-1 ring-brass-400/30"
            >
              Pull to check this route
            </span>
          </button>
        </div>
      </div>

      {/* ── The surfaced truth — the one dated fact this route holds, lit once
          on load (the light lands, then this resolves) and left present at
          rest. A visual echo (aria-hidden) of the verdict the pull opens in
          full below, which screen readers already carry; the outer div's
          opacity is faded by applyP while the Brief is open, so the fact is
          never shown twice. Nesting keeps the one-time entrance (inner) and
          the interactive fade (outer) from fighting. ────────────────────── */}
      <div ref={truthRef} className="mx-auto mt-3 max-w-xl text-center sm:mt-4">
        <p aria-hidden="true" className="pb-truth-in text-balance font-display text-[15px] leading-snug text-sand-100 sm:text-base">
          {statusCopy.verdictLine}
        </p>
      </div>

      {/* ── The Brief: verdict + pins, revealed by the pull ──────────────── */}
      <div
        ref={briefRef}
        role="region"
        aria-label="Journey Brief: Manchester to Mumbai"
        className={`pb-brief pointer-events-none transition-[max-height] duration-500 ease-out max-sm:overflow-hidden ${
          settled ? 'max-sm:max-h-[1200px]' : 'max-sm:max-h-0'
        } sm:absolute sm:bottom-[2%] sm:left-[19%] sm:right-2 sm:top-[4%]`}
      >
        {/* Compact journey bar — appears at settle. */}
        <div ref={barRef} className="mb-4 flex flex-wrap items-center gap-3 opacity-0 transition-opacity duration-200">
          <span className="inline-flex items-center gap-2.5 rounded-full border border-brass/30 bg-ink-900/80 py-1.5 pl-4 pr-3">
            <span className="font-display text-base leading-none text-sand-50">Manchester → Mumbai</span>
            <span aria-hidden="true" className="h-4 w-px bg-white/15" />
            <button
              type="button"
              onClick={close}
              className="text-[13px] font-semibold text-brass-300 underline decoration-brass-300/40 underline-offset-4 transition-colors duration-150 hover:text-brass-200"
            >
              Change journey
            </button>
          </span>
        </div>

        {/* Verdict — lead with the strongest verified insight, then the evidence.
            "Journey Brief" is introduced here, at the moment the visitor is
            holding one — never as unexplained arrival terminology. */}
        <div ref={verdictRef} className="pb-verdict max-w-2xl" style={{ opacity: 0 }}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-brass-200">Your Journey Brief</p>
          <h3 className="mt-2 font-display text-xl leading-tight text-sand-50 sm:text-2xl">
            {statusCopy.verdictLine}
          </h3>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-200">{statusCopy.evidenceDetail}</p>
        </div>

        {/* Pins, in journey order, each in its honest state. */}
        <ul className="mt-4 grid max-w-3xl gap-2 sm:grid-cols-2">
          {PINS.map((pin) => (
            <li
              key={pin.key}
              data-pin
              className="rounded-md border border-white/10 bg-ink-900/70 px-3.5 py-2.5"
              style={{ opacity: 0 }}
            >
              <span className="flex items-center gap-2">
                <PinIcon state={pin.state} />
                <span className="text-[13px] font-semibold text-sand-100">{pin.label}</span>
              </span>
              <span className="mt-1 block text-xs leading-snug text-ink-300">{pin.detail}</span>
            </li>
          ))}
        </ul>

        <div className="mt-4" data-pin style={{ opacity: 0 }}>
          {/* The public route page — never the founder-gated prototype, which
              404s in production. */}
          <Link
            href="/routes/manchester-mumbai"
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-sm bg-brass px-5 text-sm font-semibold text-ink-900 transition-all hover:bg-brass-400 active:scale-[0.985]"
          >
            Open the full route check
            <ArrowRight className="h-4 w-4" strokeWidth={2.25} />
          </Link>
        </div>
      </div>

      {/* Screen-reader announcements for open/close. */}
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
    </div>
  );
}
