import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { createRequire } from 'module';
import { renderToStaticMarkup } from 'react-dom/server';
import { routes } from '@/data/routes';
import { destinations } from '@/data/destinations';
import { airportNotes } from '@/data/airport-notes';
import { travellerTips } from '@/data/traveller-tips';
import { guides } from '@/data/guides';
import { deals } from '@/data/deals';
import RoutePage from '@/app/routes/[slug]/page';
import PakistanHubPage from '@/app/pakistan/page';
import GulfHubPage from '@/app/gulf/page';
import { DealCard } from '@/components/ui/deal-card';
import { formatDirectServiceNote, getVerifiedDirectServices } from '@/lib/hub-service-notes';
import { getEffectiveRoutePresentation } from '@/lib/route-status-copy';
import { routeStatusEvents } from '@/data/route-status-events';
import { fareObservations } from '@/data/fare-observations';
import { toTravellerFareNote } from '@/lib/fare-note-display';

// First-impression sprint 1 (22 Oct 2026).
const ROOT = join(__dirname, '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const TODAY = '2026-10-22';

describe('no internal or evidence-review wording in customer-visible data', () => {
  // These phrases describe how JetStash checked something, not what a traveller
  // needs to know. "see note" points at a note the visitor cannot see.
  const BANNED = [/\bthis session\b/i, /\bevidence check\b/i, /\bprimary evidence\b/i, /\bdestination evidence\b/i, /\bsee note\b/i, /\bservice shape\b/i];
  const hit = (text: string) => BANNED.filter((re) => re.test(text)).map(String);

  it('route records: flightTime, frequency, intro and bookingWindowNote (every route, whatever its current status)', () => {
    const offenders = routes.flatMap((r) =>
      [r.flightTime, r.frequency, r.intro, r.bookingWindowNote].flatMap((field) => hit(field ?? '').map((h) => `${r.slug}: ${h}`))
    );
    expect(offenders).toEqual([]);
  });

  it('destinations, airport notes, traveller tips and guides', () => {
    const blobs: [string, string][] = [
      ['destinations', JSON.stringify(destinations)],
      ['airportNotes', JSON.stringify(airportNotes)],
      ['travellerTips', JSON.stringify(travellerTips)],
      ['guides', JSON.stringify(guides)],
    ];
    const offenders = blobs.flatMap(([name, text]) => hit(text).map((h) => `${name}: ${h}`));
    expect(offenders).toEqual([]);
  });

  it('canonical presentation, share text and social detail for every route (today and after every verification lapse)', () => {
    const offenders = ['2026-10-22', '2027-06-30'].flatMap((day) =>
      routes.flatMap((r) => {
        const p = getEffectiveRoutePresentation(r, routeStatusEvents, day);
        return [p.summary, p.shareText, p.socialDetail, p.flightTime ?? '', p.frequency ?? ''].flatMap((t) => hit(t).map((h) => `${day} ${r.slug}: ${h}`));
      })
    );
    expect(offenders).toEqual([]);
  });

  it('traveller-facing fare notes (the sanitiser output, not the append-only observation text)', () => {
    const offenders = fareObservations.flatMap((o) => hit(toTravellerFareNote(o.priceNote)).map((h) => `${o.id}: ${h}`));
    expect(offenders).toEqual([]);
  });

  it('keeps the uncertainty: the Heathrow-Jeddah duration still says it is not reconfirmed', () => {
    const r = routes.find((x) => x.slug === 'london-heathrow-jeddah')!;
    expect(r.flightTime).toBe("About 6h 15m, per Saudia's published route figure; not yet reconfirmed against a current Saudia schedule");
  });
});

describe('fare cards state route type and fare type beside the price', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`));
  });
  afterEach(() => vi.useRealTimers());

  it('Manchester-Islamabad: "Connecting fare, not nonstop" and the plain explanation come before the lower self-transfer offer and the booking button', async () => {
    const html = renderToStaticMarkup(await RoutePage({ params: Promise.resolve({ slug: 'manchester-islamabad' }) }));
    const price = html.indexOf('return</p>');
    const tag = html.indexOf('Connecting fare, not nonstop');
    const callout = html.indexOf('Nonstop flights are listed for this route, but this tracked fare is a connecting journey');
    const lower = html.indexOf('Lower fare also seen');
    const cta = html.indexOf('flights on Trip.com');
    expect(price).toBeGreaterThan(-1);
    expect(tag).toBeGreaterThan(price);
    expect(callout).toBeGreaterThan(tag);
    expect(lower).toBeGreaterThan(callout);
    expect(cta).toBeGreaterThan(lower);
  });

  it('never implies the connecting fare is nonstop, and keeps the route\'s own direct status visible', async () => {
    const html = renderToStaticMarkup(await RoutePage({ params: Promise.resolve({ slug: 'manchester-islamabad' }) }));
    expect(html).toContain('Direct flights available');
    expect(html).toContain('Connecting outbound');
    expect(html).not.toMatch(/Connecting fare[^<]*\bis nonstop\b/i);
  });

  it('a connecting route with a connecting fare gets no mismatch tag (nothing to reconcile)', async () => {
    const html = renderToStaticMarkup(await RoutePage({ params: Promise.resolve({ slug: 'manchester-karachi' }) }));
    expect(html).not.toContain('Connecting fare, not nonstop');
  });

  it('deal card: the cue and explanation sit directly under the price, ahead of the travel dates', () => {
    const deal = deals.find((d) => d.id === 'man-dxb-economy')!;
    const html = renderToStaticMarkup(DealCard({ deal, nowIso: '2026-10-20' })).replace(/\s+/g, ' ');
    const tag = html.indexOf('Connecting fare, not nonstop');
    expect(tag).toBeGreaterThan(-1);
    expect(tag).toBeLessThan(html.indexOf('Travel '));
    expect(html).not.toContain('Airline: verification pending');
  });
});

describe('Pakistan and Gulf hub copy makes no unsupported price or popularity claims', () => {
  it('Pakistan hub: derived direct-route note, neutral intro, no price comparison', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`));
    try {
      const props = PakistanHubPage().props as { intro: string; visaNote: string; practicalNotes: { title: string; body: string }[] };
      expect(props.intro).not.toMatch(/same depth|huge number|actually matters/i);
      const all = props.practicalNotes.map((n) => `${n.title} ${n.body}`).join(' ');
      expect(all).not.toMatch(/often at a lower fare|can be cheaper|competitive one-stop|usually the most direct/i);
      const direct = props.practicalNotes.find((n) => /verified direct/i.test(n.title))!;
      expect(direct.body).toMatch(/Manchester to Lahore/);
      expect(direct.body).toMatch(/Manchester to Islamabad/);
      expect(props.visaNote).not.toMatch(/within 7 days|typically do not require/i);
      expect(props.visaNote).toMatch(/valid NICOP, SNICOP or Pakistan Origin Card \(POC\)/);
      expect(props.visaNote).toMatch(/expired, lost or renewing card is treated differently/);
    } finally {
      vi.useRealTimers();
    }
  });

  it('Gulf hub: no price-premium or "rarely affects flight pricing" claims', () => {
    const props = GulfHubPage().props as { practicalNotes: { title: string; body: string }[] };
    const all = props.practicalNotes.map((n) => `${n.title} ${n.body}`).join(' ');
    expect(all).not.toMatch(/peak price|significant price premium|rarely affects flight pricing|not the price|sometimes works out cheaper/i);
    expect(all).toMatch(/has not tracked whether Ramadan changes flight prices/);
  });

  it('shared hub template, Umrah page and Umrah guide drop the unsupported generalisations', () => {
    expect(read('components/sections/region-hub-page.tsx')).not.toContain('Most trips here are family visits');
    const umrah = read('app/umrah/page.tsx');
    expect(umrah).not.toMatch(/Package prices rise significantly|3–4 months ahead is common practice/);
    expect(umrah).toContain('JetStash has not tracked package prices');
    expect(JSON.stringify(guides)).not.toMatch(/buys noticeably more package|prices rise accordingly/);
  });

  it('never attaches an airline to an origin it was not verified for', () => {
    const air = (originName: string, airlineNames: string[]) => ({ routeSlug: originName, originName, airlineNames });
    expect(formatDirectServiceNote('Amritsar', [air('Birmingham', ['Air India'])]).body).toMatch(/^Air India's direct Amritsar service from Birmingham/);
    expect(formatDirectServiceNote('Amritsar', [air('Birmingham', ['Air India']), air('London Gatwick', ['Air India'])]).body).toMatch(/^Air India's direct Amritsar service from Birmingham and London Gatwick/);
    const mixed = formatDirectServiceNote('Dhaka', [air('Manchester', ['Biman Bangladesh Airlines']), air('London Heathrow', ['Emirates'])]);
    expect(mixed.body).toMatch(/^The direct Dhaka service from Manchester and London Heathrow/);
    expect(mixed.body).not.toMatch(/Biman|Emirates/);
    expect(formatDirectServiceNote('Dhaka', [air('Manchester', [])]).body).toMatch(/^The direct Dhaka service/);
  });

  it('derived direct-service helper agrees with canonical verification at fixed dates', () => {
    const amritsar = ['birmingham-amritsar', 'london-gatwick-amritsar', 'manchester-amritsar', 'leeds-bradford-amritsar'];
    expect(getVerifiedDirectServices(amritsar, '2026-10-22').map((s) => s.originName)).toEqual(['Birmingham']);
    expect(getVerifiedDirectServices(amritsar, '2026-10-10').map((s) => s.originName)).toEqual(['Birmingham', 'London Gatwick']);
    expect(getVerifiedDirectServices(amritsar, '2026-12-31')).toEqual([]);
  });
});

describe('keyboard focus and hover contrast meet WCAG thresholds on the real design tokens', () => {
  const require_ = createRequire(import.meta.url);
  const colours = require_('../tailwind.config.js').theme.extend.colors as Record<string, Record<string, string>>;
  const lum = (hex: string) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (a: string, b: string) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  it('focus ring: ink on white and on sand (3:1 minimum), light brass on the dark surfaces', () => {
    expect(ratio(colours.ink['900'], '#FFFFFF')).toBeGreaterThanOrEqual(3);
    expect(ratio(colours.ink['900'], colours.sand['50'])).toBeGreaterThanOrEqual(3);
    for (const dark of [colours.ink['900'], colours.ink['950'], colours.ink['800']]) {
      expect(ratio(colours.brass['300'], dark)).toBeGreaterThanOrEqual(3);
    }
    // The previous single brass ring failed on white:
    expect(ratio(colours.brass['500'], '#FFFFFF')).toBeLessThan(3);
  });

  it('light-surface components no longer override the global ring with brass', () => {
    for (const f of ['components/arrive-by-shell.tsx', 'components/arrive-by-full-journey.tsx', 'components/arrive-by-result-explanations.tsx', 'components/sections/quote-request-form.tsx']) {
      expect(read(f), f).not.toMatch(/focus-visible:outline-brass(?![-\w])|has-\[:focus-visible\]:outline-brass(?![-\w])/);
    }
  });

  it('the one Arrive By link that sits on the dark page background keeps a light ring (an ink ring would be 1:1 there)', () => {
    const darkLink = read('components/arrive-by-shell.tsx')
      .split(/\r?\n/)
      .find((l) => l.includes('Change airport'))!;
    expect(darkLink).toContain('focus-visible:outline-brass-300');
    expect(darkLink).not.toContain('outline-ink-900');
  });

  it('globals.css uses the two-tone ring, and ink buttons hover to brass-700 (sand text 4.5:1), never brass-600 (about 3.9:1)', () => {
    const css = read('app/globals.css');
    expect(css).toContain("outline: 2px solid theme('colors.ink.900');");
    expect(css).toContain("outline-color: theme('colors.brass.300');");
    expect(ratio(colours.sand['50'], colours.brass['700'])).toBeGreaterThanOrEqual(4.5);
    expect(ratio(colours.sand['50'], colours.brass['600'])).toBeLessThan(4.5);
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(join(ROOT, dir))) {
        const rel = `${dir}/${name}`;
        if (statSync(join(ROOT, rel)).isDirectory()) walk(rel);
        else if (/\.tsx$/.test(name) && read(rel).includes('hover:bg-brass-600')) offenders.push(rel);
      }
    };
    walk('components');
    walk('app');
    expect(offenders).toEqual([]);
  });
});
