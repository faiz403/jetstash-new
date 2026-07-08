'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

/**
 * The JetStash Route Atlas — the site's signature feature.
 *
 * Implemented 1:1 from the approved design concept
 * (public/concepts/manchester-route-map-v2.html): every coordinate, curve
 * and label position below is copied from that blueprint, which plots each
 * city at its projected real lat/lon (x = 60 + (lon+12)·15.745,
 * y = 170 + (58−lat)·18.6, nudged only for label clearance).
 *
 * Composition, bottom to top:
 *   1. Ink panel with the brand's dawn glow (CSS, matches every dark hero).
 *   2. The Signature Manchester photograph as a ground strip — blurred,
 *      mirrored, ~10-16% opacity, masked so only the airport-at-dusk band
 *      survives and the photo's own sky never competes with the map.
 *   3. Hand-inked coastlines at true geography (deliberately soft: an atlas
 *      etching, never Google Maps), plus a whisper of graticule.
 *   4. The departure: all eastern routes leave Manchester as one climbing
 *      stream on a shared heading (as real departures do) before fanning to
 *      their destinations. Marrakech departs south as the lone westbound.
 *      Solid = direct from Manchester, dashed = via connection — same
 *      honesty rule as data/routes.ts.
 *   5. One aircraft, drawn in the map's own medium, leading the climb-out.
 *
 * Interactions: hover/tap/focus a destination to light only its route,
 * enlarge its marker and swell the Manchester glow; the gateway card
 * (destination name, country, "Explore destination") updates in place.
 * No prices, no invented statistics — per the brief. Mobile replaces the
 * map's tap targets with the established chip selector.
 */

interface AtlasDestination {
  slug: string;
  label: string;
  country: string;
  x: number;
  y: number;
  /** Second cubic control point — first is the shared climb-out (360,196). */
  c2: [number, number];
  /** Marrakech is the lone westbound and skips the shared climb-out. */
  westbound?: boolean;
  direct: boolean;
  href: string;
  /** Label placement relative to the marker. */
  lp: 'left' | 'right' | 'above' | 'below';
}

const ORIGIN = { x: 214, y: 254 };
const CLIMB_OUT: [number, number] = [360, 196];

// Abu Dhabi has no destination page yet, so its gateway links to the Gulf
// hub — swap the href once an Abu Dhabi guide exists.
const DESTINATIONS: AtlasDestination[] = [
  { slug: 'lahore', label: 'Lahore', country: 'Pakistan', x: 1410, y: 668, c2: [851, 348], direct: true, href: '/destinations/lahore', lp: 'left' },
  { slug: 'islamabad', label: 'Islamabad', country: 'Pakistan', x: 1392, y: 610, c2: [838, 317], direct: true, href: '/destinations/islamabad', lp: 'left' },
  { slug: 'karachi', label: 'Karachi', country: 'Pakistan', x: 1304, y: 786, c2: [812, 412], direct: true, href: '/destinations/karachi', lp: 'left' },
  { slug: 'delhi', label: 'Delhi', country: 'India', x: 1464, y: 717, c2: [881, 373], direct: true, href: '/destinations/delhi', lp: 'right' },
  { slug: 'amritsar', label: 'Amritsar', country: 'India', x: 1440, y: 641, c2: [866, 334], direct: false, href: '/destinations/amritsar', lp: 'right' },
  { slug: 'ahmedabad', label: 'Ahmedabad', country: 'India', x: 1392, y: 821, c2: [855, 430], direct: false, href: '/destinations/ahmedabad', lp: 'left' },
  { slug: 'mumbai', label: 'Mumbai', country: 'India', x: 1397, y: 894, c2: [863, 468], direct: true, href: '/destinations/mumbai', lp: 'left' },
  { slug: 'dubai', label: 'Dubai', country: 'UAE', x: 1124, y: 770, c2: [728, 408], direct: true, href: '/destinations/dubai', lp: 'right' },
  { slug: 'abu-dhabi', label: 'Abu Dhabi', country: 'UAE', x: 1098, y: 806, c2: [720, 428], direct: true, href: '/gulf', lp: 'below' },
  { slug: 'doha', label: 'Doha', country: 'Qatar', x: 1050, y: 782, c2: [696, 417], direct: true, href: '/destinations/doha', lp: 'left' },
  { slug: 'jeddah', label: 'Jeddah', country: 'Saudi Arabia', x: 866, y: 849, c2: [621, 463], direct: false, href: '/destinations/jeddah', lp: 'left' },
  { slug: 'istanbul', label: 'Istanbul', country: 'Turkey', x: 706, y: 486, c2: [560, 300], direct: true, href: '/destinations/istanbul', lp: 'above' },
  { slug: 'marrakech', label: 'Marrakech', country: 'Morocco', x: 123, y: 661, c2: [104, 443], westbound: true, direct: true, href: '/destinations/marrakech', lp: 'right' },
];

function routePath(d: AtlasDestination): string {
  const c1 = d.westbound ? '240 292' : `${CLIMB_OUT[0]} ${CLIMB_OUT[1]}`;
  return `M ${ORIGIN.x} ${ORIGIN.y} C ${c1}, ${d.c2[0]} ${d.c2[1]}, ${d.x} ${d.y}`;
}

/** Two-line label (city + small-caps country) placed around the marker. */
function DestinationLabel({ d, active }: { d: AtlasDestination; active: boolean }) {
  const nameFill = '#F7F2E9';
  const nameOpacity = active ? 1 : 0.68;
  const countryFill = active ? '#E0B158' : '#6B7280';
  const nameSize = active ? 17 : 16;
  const countryProps = {
    fontFamily: 'var(--font-sans), Arial, sans-serif',
    fontSize: 8.5,
    fontWeight: 600,
    letterSpacing: 1.8,
    fill: countryFill,
  } as const;
  const nameProps = {
    fontFamily: 'var(--font-display), Georgia, serif',
    fontSize: nameSize,
    fill: nameFill,
    opacity: nameOpacity,
  } as const;

  if (d.lp === 'left') {
    return (
      <g className="pointer-events-none transition-opacity duration-300">
        <text x={d.x - 16} y={d.y - 4} textAnchor="end" {...nameProps}>{d.label}</text>
        <text x={d.x - 16} y={d.y + 12} textAnchor="end" {...countryProps}>{d.country.toUpperCase()}</text>
      </g>
    );
  }
  if (d.lp === 'right') {
    return (
      <g className="pointer-events-none transition-opacity duration-300">
        <text x={d.x + 16} y={d.y - 4} {...nameProps}>{d.label}</text>
        <text x={d.x + 17} y={d.y + 12} {...countryProps}>{d.country.toUpperCase()}</text>
      </g>
    );
  }
  if (d.lp === 'above') {
    return (
      <g className="pointer-events-none transition-opacity duration-300">
        <text x={d.x} y={d.y - 42} textAnchor="middle" {...countryProps}>{d.country.toUpperCase()}</text>
        <text x={d.x} y={d.y - 27} textAnchor="middle" {...nameProps}>{d.label}</text>
      </g>
    );
  }
  return (
    <g className="pointer-events-none transition-opacity duration-300">
      <text x={d.x - 4} y={d.y + 26} textAnchor="middle" {...nameProps}>{d.label}</text>
      <text x={d.x - 4} y={d.y + 42} textAnchor="middle" {...countryProps}>{d.country.toUpperCase()}</text>
    </g>
  );
}

export function RouteMapHero() {
  const [activeSlug, setActiveSlug] = useState<string>('lahore');
  const active = DESTINATIONS.find((d) => d.slug === activeSlug) ?? DESTINATIONS[0];

  return (
    <div className="relative overflow-hidden rounded-lg border border-white/10 bg-gradient-to-b from-ink-900 to-ink-950">
      {/* Ground strip: the Signature Manchester photograph as pure atmosphere.
          Mirrored so its sunset sits beneath the map's quietest corner;
          masked so only the airport-at-dusk band survives — the photo's own
          sky (and anything in it) never competes with the cartography. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.16] [mask-image:linear-gradient(to_top,rgba(0,0,0,0.95)_0%,rgba(0,0,0,0.6)_16%,transparent_46%)]"
      >
        <Image
          src="/images/airports/manchester.webp"
          alt=""
          fill
          sizes="(max-width: 1024px) 100vw, 1320px"
          className="-scale-x-100 object-cover object-bottom blur-[9px]"
        />
      </div>
      {/* The brand's dawn glow, exactly as on every dark hero */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(200,147,46,0.14),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_85%_75%,_rgba(200,147,46,0.07),transparent_50%)]" />

      <div className="relative px-6 pt-7 sm:px-10 sm:pt-9">
        {/* header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-brass-200">The JetStash Route Atlas</span>
            <h2 className="mt-2 font-display text-2xl text-sand-50 sm:text-4xl">Manchester to the destinations that matter</h2>
          </div>
          <p className="hidden text-[13px] text-ink-400 lg:block">Hover a destination to light its route</p>
          <p className="text-[13px] text-ink-400 lg:hidden">Select a destination to light its route</p>
        </div>

        {/* mobile chip selector — the map's tap targets are too fine below sm */}
        <div className="-mx-6 mt-5 flex gap-2 overflow-x-auto px-6 pb-1 no-scrollbar sm:hidden" role="group" aria-label="Choose a destination">
          {DESTINATIONS.map((d) => {
            const isActive = d.slug === activeSlug;
            return (
              <button
                key={`chip-${d.slug}`}
                onClick={() => setActiveSlug(d.slug)}
                aria-pressed={isActive}
                className={
                  isActive
                    ? 'shrink-0 rounded-full bg-brass px-4 py-2 text-sm font-semibold text-ink-900'
                    : 'shrink-0 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-ink-200'
                }
              >
                {d.label}
              </button>
            );
          })}
        </div>

        {/* the atlas */}
        <div className="relative mt-2 sm:mt-4">
          <svg
            viewBox="0 160 1600 830"
            className="hidden h-auto w-full sm:block"
            role="group"
            aria-label="Route atlas: flights departing Manchester across Europe, North Africa, the Gulf and South Asia"
          >
            <defs>
              <radialGradient id="atlas-fade" cx="0.5" cy="0.54" r="0.72">
                <stop offset="0" stopColor="#ffffff" />
                <stop offset="0.72" stopColor="#ffffff" />
                <stop offset="1" stopColor="#000000" />
              </radialGradient>
              <mask id="atlas-coast-fade">
                <rect x="0" y="0" width="1600" height="1000" fill="url(#atlas-fade)" />
              </mask>
              <radialGradient id="atlas-dot-glow" cx="0.5" cy="0.5" r="0.5">
                <stop offset="0" stopColor="#C8932E" stopOpacity="0.85" />
                <stop offset="0.5" stopColor="#C8932E" stopOpacity="0.25" />
                <stop offset="1" stopColor="#C8932E" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="atlas-man-glow" cx="0.5" cy="0.5" r="0.5">
                <stop offset="0" stopColor="#F7F2E9" stopOpacity="0.55" />
                <stop offset="0.5" stopColor="#E0B158" stopOpacity="0.18" />
                <stop offset="1" stopColor="#C8932E" stopOpacity="0" />
              </radialGradient>
              <linearGradient
                id="atlas-active-route"
                gradientUnits="userSpaceOnUse"
                x1={ORIGIN.x}
                y1={ORIGIN.y}
                x2={active.x}
                y2={active.y}
              >
                <stop offset="0" stopColor="#F7F2E9" stopOpacity="0.95" />
                <stop offset="0.45" stopColor="#E0B158" />
                <stop offset="1" stopColor="#C8932E" />
              </linearGradient>
              <filter id="atlas-soft-blur" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="4.5" />
              </filter>
              <filter id="atlas-grain">
                <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
              </filter>
            </defs>

            {/* cartography: hand-inked coastlines at true geography */}
            <g mask="url(#atlas-coast-fade)">
              <g stroke="#F7F2E9" strokeOpacity="0.045" fill="none" strokeWidth="1">
                <path d="M 60 356 Q 800 322 1540 356" />
                <path d="M 60 620 Q 800 594 1540 620" />
                <path d="M 60 868 Q 800 848 1540 868" />
                <path d="M 420 170 Q 434 570 412 970" />
                <path d="M 800 170 Q 812 570 796 970" />
                <path d="M 1180 170 Q 1190 570 1176 970" />
              </g>
              <g stroke="#F7F2E9" strokeOpacity="0.13" fill="none" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M 159 318 Q 172 316 186 313 Q 208 310 228 306 Q 252 302 270 298 Q 268 294 260 291 Q 270 282 276 270 Q 262 268 254 265 Q 250 252 247 243 Q 236 234 227 226 Q 219 212 213 200 Q 215 192 216 185 Q 218 177 219 170 M 159 180 Q 158 200 161 220 Q 178 224 192 228 Q 197 243 201 256 Q 188 257 177 257 Q 170 272 165 287 Q 184 290 202 293 Q 189 294 177 296 Q 167 307 159 318 Z" />
                <path d="M 151 243 Q 154 258 154 272 Q 134 281 115 291 Q 101 284 91 276 Q 91 257 93 239 Q 106 230 120 222 Q 137 232 151 243 Z" />
                <path d="M 279 300 Q 262 314 249 330 Q 214 338 177 349 Q 200 370 230 393 Q 231 405 232 417 Q 226 430 221 442 Q 167 439 112 436 Q 105 470 101 505 Q 102 517 104 529 Q 105 545 107 561 Q 128 566 150 570 Q 158 574 165 578 M 180 566 Q 213 542 249 516 Q 266 498 284 479 Q 297 460 312 442 Q 322 443 332 443 Q 360 433 389 423 Q 417 446 446 470 Q 460 480 474 490 Q 487 516 501 542 Q 509 524 517 505 Q 528 502 539 499 Q 547 488 556 477 Q 565 505 575 533 Q 586 550 598 568 Q 612 555 627 542 Q 645 528 663 514 Q 663 506 664 499 Q 685 492 706 486 Q 729 478 753 471 Q 786 476 820 481 Q 849 483 878 486 Q 891 481 905 477" />
                <path d="M 675 535 Q 682 548 690 561 Q 711 561 732 562 Q 754 569 776 577 Q 797 572 819 568 Q 813 593 808 618 Q 798 640 789 663 Q 778 666 768 670 Q 755 664 743 663 Q 731 665 720 668 Q 697 667 674 667 Q 658 661 642 656 Q 603 654 565 652 Q 551 667 537 682 Q 515 664 493 646 Q 475 641 457 637 Q 432 627 408 618 Q 409 591 410 564 Q 398 563 387 562 Q 342 563 297 564 Q 268 574 240 585 Q 221 588 202 592 Q 180 587 158 583 M 163 590 Q 152 603 142 616 Q 135 620 129 624 Q 112 643 95 663 Q 96 673 98 683 Q 91 698 84 713 Q 72 739 60 765" />
                <path d="M 762 693 Q 772 715 783 737 Q 795 765 808 793 Q 821 825 834 858 Q 844 881 855 905 Q 866 932 878 960" />
                <path d="M 800 702 Q 812 729 824 756 Q 830 784 837 812 Q 850 832 863 853 Q 879 879 895 905 Q 909 930 923 955" />
                <path d="M 1009 698 Q 1018 708 1028 719 Q 1033 736 1039 754 Q 1044 764 1049 774 Q 1055 768 1060 762 Q 1060 770 1061 778 Q 1076 788 1091 799 Q 1104 788 1118 778 Q 1127 769 1137 761 Q 1145 783 1154 806 Q 1170 819 1186 832 Q 1193 847 1201 862" />
                <path d="M 1017 687 Q 1032 714 1047 741 Q 1063 748 1080 756 Q 1096 755 1112 754 Q 1128 749 1145 745 Q 1160 758 1175 771 Q 1196 775 1217 780 Q 1240 780 1264 780 Q 1283 784 1302 788 Q 1314 800 1327 813 Q 1339 821 1351 830 Q 1370 837 1389 845 Q 1391 858 1394 871 Q 1395 883 1396 895 Q 1400 909 1405 923 Q 1409 939 1414 955" />
                <path strokeOpacity="0.05" d="M 1036 421 Q 1060 444 1080 468 Q 1090 496 1097 525 Q 1088 546 1078 566 Q 1063 563 1049 561 Q 1036 538 1026 514 Q 1025 488 1025 462 Q 1030 441 1036 421 Z" />
              </g>
              <g fill="none" stroke="#F7F2E9" strokeOpacity="0.06" strokeWidth="1">
                <ellipse cx="487" cy="553" rx="16" ry="9" transform="rotate(-14 487 553)" />
                <ellipse cx="641" cy="594" rx="14" ry="4" transform="rotate(-8 641 594)" />
                <ellipse cx="772" cy="596" rx="10" ry="4" />
              </g>
            </g>

            {/* routes at rest: one departure stream, then the fan */}
            <g fill="none" stroke="#C8932E" strokeWidth="1.2" strokeLinecap="round">
              {DESTINATIONS.map((d) => (
                <path
                  key={`route-${d.slug}`}
                  d={routePath(d)}
                  strokeOpacity={d.direct ? 0.32 : 0.3}
                  strokeDasharray={d.direct ? undefined : '2 7'}
                />
              ))}
            </g>

            {/* the lit route */}
            <g fill="none" strokeLinecap="round">
              <path d={routePath(active)} stroke="#C8932E" strokeWidth="7" strokeOpacity="0.14" filter="url(#atlas-soft-blur)" />
              <path d={routePath(active)} stroke="url(#atlas-active-route)" strokeWidth="2" />
            </g>

            {/* the departure: one aircraft leading the climb-out */}
            <g transform="translate(352 202) rotate(-17)" aria-hidden="true">
              <circle r="26" fill="url(#atlas-man-glow)" opacity="0.5" />
              <g fill="#E0B158">
                <path d="M -22 0 L 6 -3.2 L 20 -0.8 Q 24 0 20 0.8 L 6 3.2 L -22 0 Z" />
                <path d="M -3 -1.8 L 7 -14 L 12 -14 L 5 -2 Z" />
                <path d="M -3 1.8 L 7 14 L 12 14 L 5 2 Z" />
                <path d="M -19 -1 L -13 -6.8 L -9.6 -6.8 L -14 -0.8 Z" />
                <path d="M -19 1 L -13 6.8 L -9.6 6.8 L -14 0.8 Z" />
              </g>
            </g>

            {/* origin: Manchester Airport — prominent, softly glowing */}
            <g>
              <circle
                cx={ORIGIN.x}
                cy={ORIGIN.y}
                r="42"
                fill="url(#atlas-man-glow)"
                className="transition-opacity duration-300"
                opacity={0.9}
              />
              <circle cx={ORIGIN.x} cy={ORIGIN.y} r="18" fill="none" stroke="#F7F2E9" strokeOpacity="0.3" />
              <circle cx={ORIGIN.x} cy={ORIGIN.y} r="10" fill="none" stroke="#E0B158" strokeWidth="1.3" />
              <circle cx={ORIGIN.x} cy={ORIGIN.y} r="4.2" fill="#F7F2E9" />
              <text
                x={ORIGIN.x - 18}
                y={ORIGIN.y + 34}
                textAnchor="end"
                fontFamily="var(--font-display), Georgia, serif"
                fontSize="22"
                fill="#F7F2E9"
              >
                Manchester Airport
              </text>
              <text
                x={ORIGIN.x - 18}
                y={ORIGIN.y + 52}
                textAnchor="end"
                fontFamily="var(--font-sans), Arial, sans-serif"
                fontSize="9"
                fontWeight="600"
                letterSpacing="2.2"
                fill="#E0B158"
              >
                MAN · UK DEPARTURES
              </text>
            </g>

            {/* destinations */}
            {DESTINATIONS.map((d) => {
              const isActive = d.slug === activeSlug;
              return (
                <g key={`dest-${d.slug}`}>
                  <circle
                    cx={d.x}
                    cy={d.y}
                    r={isActive ? 20 : 14}
                    fill="url(#atlas-dot-glow)"
                    opacity={isActive ? 1 : 0.6}
                    className="pointer-events-none transition-all duration-300"
                  />
                  {isActive && (
                    <circle cx={d.x} cy={d.y} r="8" fill="none" stroke="#E0B158" strokeWidth="1.2" strokeOpacity="0.8" className="pointer-events-none" />
                  )}
                  <circle
                    cx={d.x}
                    cy={d.y}
                    r={isActive ? 4 : 2.8}
                    fill={isActive ? '#E0B158' : '#C8932E'}
                    fillOpacity={isActive ? 1 : 0.85}
                    className="pointer-events-none transition-all duration-300"
                  />
                  {/* generous invisible hit area; the visible dot stays fine */}
                  <circle
                    cx={d.x}
                    cy={d.y}
                    r="22"
                    fill="transparent"
                    className="cursor-pointer"
                    tabIndex={0}
                    role="button"
                    aria-label={`Show the Manchester to ${d.label} route`}
                    onMouseEnter={() => setActiveSlug(d.slug)}
                    onFocus={() => setActiveSlug(d.slug)}
                    onClick={() => setActiveSlug(d.slug)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') setActiveSlug(d.slug);
                    }}
                  />
                  <DestinationLabel d={d} active={isActive} />
                </g>
              );
            })}

            {/* compass, understated */}
            <g transform="translate(1512 880)" stroke="#C8932E" strokeOpacity="0.4" fill="none" aria-hidden="true">
              <circle r="13" />
              <path d="M 0 -13 L 0 -20" strokeWidth="1.4" />
              <path d="M 0 -6 L 3 3 L 0 1 L -3 3 Z" fill="#C8932E" fillOpacity="0.5" stroke="none" />
            </g>
            <text x="1512" y="916" textAnchor="middle" fontFamily="var(--font-sans), Arial, sans-serif" fontSize="8" fontWeight="600" letterSpacing="2" fill="#6B7280" aria-hidden="true">
              N
            </text>

            {/* signature film grain */}
            <rect x="0" y="160" width="1600" height="830" filter="url(#atlas-grain)" opacity="0.04" style={{ mixBlendMode: 'overlay' }} aria-hidden="true" />
          </svg>

          {/* gateway card: fixed calm position over the map's empty north-east
              on larger screens, stacked below the chips on mobile */}
          <div
            aria-live="polite"
            className="mt-4 w-full rounded-md border border-white/10 bg-ink-950/85 p-5 backdrop-blur-sm sm:absolute sm:right-2 sm:top-2 sm:mt-0 sm:w-[290px] lg:right-4 lg:top-4"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-brass-200">
              Manchester → {active.label}
            </p>
            <p className="mt-2 font-display text-2xl leading-tight text-sand-50">{active.label}</p>
            <p className="mt-0.5 text-sm text-ink-300">{active.country}</p>
            <Link
              href={active.href}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brass-300 transition-colors hover:text-brass-200"
            >
              Explore destination
              <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
            </Link>
          </div>
        </div>
      </div>

      {/* caption + legend */}
      <div className="relative flex flex-col gap-2 px-6 pb-6 pt-4 sm:flex-row sm:items-center sm:justify-between sm:px-10 sm:pb-7">
        <p className="text-xs text-ink-400">
          Drawn for beauty, checked for honesty. Positions are approximate; every route is real.
        </p>
        <p className="hidden items-center gap-2 text-xs text-ink-300 sm:flex">
          <span className="inline-block w-8 border-t-[1.6px] border-brass/75" aria-hidden="true" />
          Direct
          <span className="ml-3 inline-block w-8 border-t-[1.6px] border-dashed border-brass/60" aria-hidden="true" />
          Via connection
        </p>
      </div>
    </div>
  );
}
