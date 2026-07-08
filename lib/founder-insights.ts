import { deals } from '@/data/deals';
import { routes, getRouteAirport, getRouteDestination } from '@/data/routes';
import { destinations, getDestinationBySlug } from '@/data/destinations';
import { getAirportBySlug } from '@/data/airports';
import { getObservationsByRoute } from '@/data/fare-observations';
import { routeWarnings } from '@/data/route-warnings';
import { imageCoverage } from '@/lib/brand-images';
import { BOOKING_PROVIDERS, PRIMARY_PROVIDER_ID } from '@/lib/booking-providers';

/**
 * Founder Command Centre insights — every figure here is derived from the
 * same /data files the public site renders from, plus environment variables.
 * Nothing is estimated or invented: where a fact can't be known from code
 * (Brevo subscriber counts, inbox contents, Brevo attribute setup), the
 * section says so honestly instead of showing a made-up number. Same
 * content-integrity rules as the public site (see CLAUDE.md).
 */

export type FounderStatus = 'attention' | 'watch' | 'ok' | 'setup';

export interface FounderItem {
  label: string;
  detail: string;
  status: FounderStatus;
  /** Internal link to the page this item concerns, when one exists. */
  href?: string;
}

export interface FounderSection {
  id: string;
  title: string;
  status: FounderStatus;
  /** One-sentence answer to "what's the state here?" */
  headline: string;
  items: FounderItem[];
  /** What to actually do about it — file paths and concrete steps. */
  action?: string;
}

// ── Thresholds (days). Chosen for a hand-checked fare site: fares are
// re-checked roughly monthly, so "watch" warms up before "attention" fires.
const DEAL_WATCH_DAYS = 21;
const DEAL_ATTENTION_DAYS = 35;
const OBS_WATCH_DAYS = 30;
const OBS_ATTENTION_DAYS = 45;
const SERVICE_END_WATCH_DAYS = 90;

function daysBetween(fromIso: string, now: Date): number {
  const from = new Date(`${fromIso}T00:00:00Z`);
  return Math.floor((now.getTime() - from.getTime()) / 86_400_000);
}

function formatShortDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function worst(statuses: FounderStatus[]): FounderStatus {
  if (statuses.includes('attention')) return 'attention';
  if (statuses.includes('setup')) return 'setup';
  if (statuses.includes('watch')) return 'watch';
  return 'ok';
}

function routeLabel(routeSlug: string): string {
  const route = routes.find((r) => r.slug === routeSlug);
  if (!route) return routeSlug;
  const airport = getRouteAirport(route);
  const dest = getRouteDestination(route);
  return airport && dest ? `${airport.city} → ${dest.city}` : routeSlug;
}

// ── 1. Routes needing fare checks ────────────────────────────────────────
function routesNeedingFareChecks(now: Date): FounderSection {
  const noHistory: FounderItem[] = [];
  const stale: FounderItem[] = [];

  for (const route of routes) {
    const observations = getObservationsByRoute(route.slug);
    const label = routeLabel(route.slug);
    const href = `/routes/${route.slug}`;
    if (observations.length === 0) {
      noHistory.push({
        label,
        detail: 'No fare history yet. The route page shows no tracked fares.',
        status: 'watch',
        href,
      });
    } else {
      const latest = observations[observations.length - 1];
      const age = daysBetween(latest.observedDate, now);
      if (age >= OBS_ATTENTION_DAYS) {
        stale.push({ label, detail: `Last checked ${age} days ago (${formatShortDate(latest.observedDate)}).`, status: 'attention', href });
      } else if (age >= OBS_WATCH_DAYS) {
        stale.push({ label, detail: `Last checked ${age} days ago (${formatShortDate(latest.observedDate)}).`, status: 'watch', href });
      }
    }
  }

  stale.sort((a, b) => (a.status === b.status ? 0 : a.status === 'attention' ? -1 : 1));
  const items = [...stale, ...noHistory];
  const status = worst(items.map((i) => i.status));
  const withHistory = routes.length - noHistory.length;

  return {
    id: 'fare-checks',
    title: 'Routes needing fare checks',
    status,
    headline:
      items.length === 0
        ? `All ${routes.length} routes have fresh fare history.`
        : `${stale.length} route${stale.length === 1 ? '' : 's'} with ageing checks · ${noHistory.length} of ${routes.length} routes have no fare history yet (${withHistory} tracked).`,
    items,
    action:
      'Check the fare on TravelUp or the airline\'s own site, then append a new entry to data/fare-observations.ts (never overwrite) and update the matching deal in data/deals.ts with the same date.',
  };
}

// ── 2. Deals with old lastChecked dates ──────────────────────────────────
function dealsNeedingRecheck(now: Date): FounderSection {
  const aged = deals
    .map((deal) => ({ deal, age: daysBetween(deal.lastChecked, now) }))
    .filter(({ age }) => age >= DEAL_WATCH_DAYS)
    .sort((a, b) => b.age - a.age);

  const items: FounderItem[] = aged.map(({ deal, age }) => ({
    label: `${deal.fromCity} → ${deal.toCity} (${deal.cabin})`,
    detail: `Checked ${age} days ago (${formatShortDate(deal.lastChecked)}) · £${deal.indicativePrice.toLocaleString('en-GB')} ${deal.airline}.`,
    status: age >= DEAL_ATTENTION_DAYS ? 'attention' : 'watch',
    href: `/destinations/${deal.toDestinationSlug}`,
  }));

  const oldest = deals.reduce((max, d) => Math.max(max, daysBetween(d.lastChecked, now)), 0);

  return {
    id: 'deal-freshness',
    title: 'Deals with old lastChecked dates',
    status: worst(items.map((i) => i.status)),
    headline:
      items.length === 0
        ? `All ${deals.length} example fares checked within ${DEAL_WATCH_DAYS} days.`
        : `${items.length} of ${deals.length} fares are ${DEAL_WATCH_DAYS}+ days old. The oldest is ${oldest} days.`,
    items,
    action: `Re-check each fare and update lastChecked in data/deals.ts. The site renders these dates publicly ("Example fare checked …"), so honesty depends on keeping them current.`,
  };
}

// ── 3. Booking provider configuration ────────────────────────────────────
function affiliateStatus(): FounderSection {
  const primary = BOOKING_PROVIDERS[PRIMARY_PROVIDER_ID];
  const hasTracking = Object.keys(primary.affiliateParams).length > 0;
  const skyscanner = BOOKING_PROVIDERS.skyscanner;

  return {
    id: 'affiliate',
    title: 'Booking provider configuration',
    status: hasTracking && primary.supportsDeepLink ? 'ok' : 'setup',
    headline: !primary.supportsDeepLink
      ? `Primary provider is ${primary.name}. Deep-linking is OFF — a guessed URL shape landed users on a TravelUp error page in production, so every booking link falls back to their real homepage instead. No affiliate tracking parameters yet either, so every click-through is currently unpaid. Skyscanner stays disabled (application declined pre-launch).`
      : hasTracking
        ? `Primary provider is ${primary.name}, deep-linking is on, and every outbound link carries its affiliate tracking parameters.`
        : `Primary provider is ${primary.name} with deep-linking on, but it has no affiliate tracking parameters yet — every click-through is currently unpaid.`,
    items: [],
    action: `Sign up for ${primary.name}'s affiliate programme (via Commission Junction: https://signup.cj.com/member/signup/publisher/?cid=6248437, or their own page at travelup.com/en-us/company/affiliate-programme) to get real tracking parameters and their actual deep-link URL structure. Add the tracking parameters to BOOKING_PROVIDERS.${PRIMARY_PROVIDER_ID}.affiliateParams and, once the real query/path schema is confirmed, update getRouteBookingUrl and flip supportsDeepLink to true in lib/booking-providers.ts. To re-enable ${skyscanner.name} later, flip its enabled flag and add its params in the same file.`,
  };
}

// ── 4. Missing real photography ──────────────────────────────────────────
function photographyStatus(): FounderSection {
  // Counted from the same image manifest the site renders from — drop files
  // into public/images/ (per docs/visual-identity.md) and these figures
  // update on the next build.
  const coverage = imageCoverage();
  const destTotal = destinations.length;
  const allCovered = coverage.destinations >= destTotal;

  return {
    id: 'photography',
    title: 'Missing real photography',
    status: allCovered ? 'ok' : coverage.total > 0 ? 'watch' : 'setup',
    headline:
      coverage.total === 0
        ? `No real photography yet. All ${destTotal} destinations render the generated brand panel. The full shot list, prompts and naming convention live in docs/visual-identity.md.`
        : `${coverage.destinations} of ${destTotal} destinations have real photography · ${coverage.heroes} hero backdrops · ${coverage.airports} of 11 airports · ${coverage.guides} guide images.`,
    items: [],
    action:
      'Produce images per docs/visual-identity.md (production order at the end of that file) and drop them into public/images/{destinations,heroes,airports,guides}/ named by slug. No code changes needed.',
  };
}

// ── 5 & 6. Quote requests / Travel Club — env-connected services ─────────
function quoteRequestStatus(): FounderSection {
  const connected = Boolean(process.env.RESEND_API_KEY);
  const inbox = process.env.CONTACT_TO_EMAIL ?? 'hello@jetstash.co.uk';

  return {
    id: 'quotes',
    title: 'Quote requests',
    status: connected ? 'ok' : 'setup',
    headline: connected
      ? `Connected via Resend. Every quote request is emailed to ${inbox}. There is no request log or count here: the inbox is the source of truth, so check it directly.`
      : 'Not connected yet. RESEND_API_KEY is not set, so the quote form fails clearly with a 503 instead of pretending to work.',
    items: [],
    action: connected
      ? `Also decide where leads should really route (one inbox vs partner agents). Currently ${inbox}. See README item 9.`
      : 'Create a Resend account, verify the sending domain, and set RESEND_API_KEY and CONTACT_TO_EMAIL in Vercel project settings.',
  };
}

function travelClubStatus(): FounderSection {
  const connected = Boolean(process.env.BREVO_API_KEY && process.env.BREVO_LIST_ID);

  return {
    id: 'travel-club',
    title: 'Travel Club signups',
    status: connected ? 'ok' : 'setup',
    headline: connected
      ? 'Connected via Brevo. Signups save with airport/interest preferences. Subscriber counts and segments live in the Brevo dashboard; this page does not duplicate them.'
      : 'Not connected yet. BREVO_API_KEY / BREVO_LIST_ID are not set, so the signup form fails clearly with a 503 instead of silently dropping emails.',
    items: [],
    action: connected
      ? 'Confirm the custom contact attributes exist in Brevo (NEAREST_AIRPORT, TRAVEL_INTEREST, and the five WATCH_* fields). Brevo silently drops attributes it does not recognise, and that cannot be verified from code.'
      : 'Create a Brevo account and list, add the custom contact attributes (README items 3 and 8), then set both env vars in Vercel.',
  };
}

// ── 7. Broken or placeholder links ───────────────────────────────────────
// Booking URLs are now generated from lib/booking-providers.ts rather than
// hand-typed per deal, so the class of bug this section used to catch
// (malformed partner URLs, stale embedded dates) is architecturally gone.
// What's still worth checking: every deal's fromAirportSlug/toDestinationSlug
// must resolve to a real Airport/Destination, or its booking link silently
// falls back to a generic (non-route) search — see getDealBookingUrl.
function linkHealth(): FounderSection {
  const items: FounderItem[] = [];

  for (const deal of deals) {
    const airport = getAirportBySlug(deal.fromAirportSlug);
    const destination = getDestinationBySlug(deal.toDestinationSlug);
    if (!airport || !destination) {
      items.push({
        label: `${deal.fromCity} → ${deal.toCity} (${deal.cabin})`,
        detail: !airport
          ? `fromAirportSlug "${deal.fromAirportSlug}" does not match any Airport — this deal's booking link silently falls back to a generic search.`
          : `toDestinationSlug "${deal.toDestinationSlug}" does not match any Destination — this deal's booking link silently falls back to a generic search.`,
        status: 'attention',
      });
    }
  }

  return {
    id: 'links',
    title: 'Broken or placeholder links',
    status: worst(items.map((i) => i.status)),
    headline:
      items.length === 0
        ? `All ${deals.length} deals resolve to a real airport and destination, so every booking link is route-specific.`
        : `${items.length} deal${items.length === 1 ? '' : 's'} have a slug that doesn't resolve — their booking link degrades to a generic search. Details below.`,
    items,
    action: 'Fix the fromAirportSlug/toDestinationSlug in data/deals.ts to match a real entry in data/airports.ts / data/destinations.ts.',
  };
}

// ── 8. Route warnings needing review ─────────────────────────────────────
function warningsForReview(now: Date): FounderSection {
  const items: FounderItem[] = routeWarnings
    .filter((w) => w.status === 'active')
    .map((w) => ({
      label: `${routeLabel(w.routeSlug)}: ${w.title}`,
      detail: `Severity: ${w.severity}. Still accurate? If resolved, flip status to 'resolved' in data/route-warnings.ts (never delete).`,
      status: w.severity === 'critical' ? 'attention' : 'watch',
      href: `/routes/${w.routeSlug}`,
    }));

  for (const route of routes) {
    if (!route.directServiceEndDate) continue;
    const daysAway = -daysBetween(route.directServiceEndDate, now);
    if (daysAway < 0) {
      items.push({
        label: `${routeLabel(route.slug)}: direct service end date has passed`,
        detail: `Ended ${formatShortDate(route.directServiceEndDate)}. Follow the README "Time-bound direct services" update procedure: flip the route to connecting and move the end note into the timeline.`,
        status: 'attention',
        href: `/routes/${route.slug}`,
      });
    } else if (daysAway <= SERVICE_END_WATCH_DAYS) {
      items.push({
        label: `${routeLabel(route.slug)}: direct service ends ${formatShortDate(route.directServiceEndDate)}`,
        detail: `${daysAway} days away. When the date passes, apply the README "Time-bound direct services" procedure so the route stays honest.`,
        status: 'watch',
        href: `/routes/${route.slug}`,
      });
    }
  }

  return {
    id: 'warnings',
    title: 'Route warnings needing review',
    status: worst(items.map((i) => i.status)),
    headline:
      items.length === 0
        ? 'No active warnings and no approaching service-end dates.'
        : `${items.length} item${items.length === 1 ? '' : 's'} to re-verify against current airline schedules.`,
    items,
    action: 'Verify each against the airline\'s own booking system. The site\'s standard is schedules, not press releases.',
  };
}

// ── 9. Pages with stale content ──────────────────────────────────────────
function staleContent(now: Date): FounderSection {
  const items: FounderItem[] = [];

  const newest = deals.reduce((max, d) => (d.lastChecked > max ? d.lastChecked : max), deals[0].lastChecked);
  const newestAge = daysBetween(newest, now);
  items.push({
    label: 'Homepage & /deals: "Most recent check" label',
    detail: `The freshest fare check shown publicly is ${formatShortDate(newest)} (${newestAge} days ago). This label is derived from data, so it only improves when a fare is actually re-checked.`,
    status: newestAge >= DEAL_ATTENTION_DAYS ? 'attention' : newestAge >= DEAL_WATCH_DAYS ? 'watch' : 'ok',
    href: '/deals',
  });

  items.push({
    label: 'Privacy policy: "Last updated: June 2026"',
    detail: 'Hand-dated. Re-read it whenever data handling changes (new provider, analytics, etc.) and update the date honestly.',
    status: 'ok',
    href: '/privacy-policy',
  });

  items.push({
    label: 'India hub & Manchester airport copy: IndiGo withdrawal wording',
    detail: 'Both mention the 31 Aug / 1 Sep 2026 IndiGo Manchester withdrawal in prose. When the route pages get their post-withdrawal update, update this copy in the same pass.',
    status: 'watch',
    href: '/india',
  });

  return {
    id: 'stale-content',
    title: 'Pages with stale content',
    status: worst(items.map((i) => i.status)),
    headline: 'Date-bearing content on public pages, oldest signals first.',
    items,
  };
}

// ── 10. Launch checklist ─────────────────────────────────────────────────
export interface ChecklistItem {
  label: string;
  detail: string;
  done: boolean;
  /** 'auto' = derived from code/env at render time; 'manual' = judgement recorded here. */
  verifiedBy: 'auto' | 'manual';
}

function launchChecklist(): { section: FounderSection; checklist: ChecklistItem[]; doneCount: number } {
  const brevoReady = Boolean(process.env.BREVO_API_KEY && process.env.BREVO_LIST_ID);
  const resendReady = Boolean(process.env.RESEND_API_KEY);
  const primaryProvider = BOOKING_PROVIDERS[PRIMARY_PROVIDER_ID];
  const hasTracking = Object.keys(primaryProvider.affiliateParams).length > 0;
  const photoCoverage = imageCoverage();
  const photosComplete = photoCoverage.destinations >= destinations.length;

  const checklist: ChecklistItem[] = [
    {
      label: 'Real production build passes',
      detail: 'npm run build compiles all 90+ pages; verified on every commit and by Vercel deploys.',
      done: true,
      verifiedBy: 'manual',
    },
    {
      label: 'Real photography',
      detail:
        photoCoverage.destinations === 0
          ? `All ${destinations.length} destinations still use the generated panel (deliberate, and it ships fine, but photography converts better).`
          : `${photoCoverage.destinations} of ${destinations.length} destinations now have real Signature Collection photography; the rest still use the generated panel.`,
      done: photosComplete,
      verifiedBy: 'auto',
    },
    {
      label: 'Newsletter wired up (Brevo env vars)',
      detail: brevoReady ? 'BREVO_API_KEY and BREVO_LIST_ID are set in this environment.' : 'BREVO_API_KEY / BREVO_LIST_ID not set in this environment.',
      done: brevoReady,
      verifiedBy: 'auto',
    },
    {
      label: 'Contact form wired up (Resend env vars)',
      detail: resendReady ? 'RESEND_API_KEY is set in this environment.' : 'RESEND_API_KEY not set in this environment.',
      done: resendReady,
      verifiedBy: 'auto',
    },
    {
      label: 'Real, current fare data',
      detail: 'Every price in data/deals.ts is still example/indicative data (see the file\'s header comment). Replace with genuinely researched fares.',
      done: false,
      verifiedBy: 'manual',
    },
    {
      label: 'Affiliate tracking parameters on booking links',
      detail: hasTracking
        ? `${primaryProvider.name} (the primary provider) carries affiliate tracking parameters.`
        : `${primaryProvider.name} (the primary provider) has no affiliate tracking parameters yet — see lib/booking-providers.ts.`,
      done: hasTracking,
      verifiedBy: 'auto',
    },
    {
      label: `${primaryProvider.name} deep-link schema confirmed`,
      detail: primaryProvider.supportsDeepLink
        ? `Deep-linking is on — confirmed against ${primaryProvider.name}'s real integration docs.`
        : `Deep-linking is OFF. A guessed origin/destination/cabinClass URL shape landed users on a ${primaryProvider.name} error page in production, so every booking link falls back to their homepage. Sign up for their affiliate programme to get the real schema, then update lib/booking-providers.ts.`,
      done: primaryProvider.supportsDeepLink,
      verifiedBy: 'auto',
    },
    {
      label: 'Brevo custom contact attributes created',
      detail: 'NEAREST_AIRPORT, TRAVEL_INTEREST + five WATCH_* attributes. Cannot be verified from code, so confirm in the Brevo dashboard and tick off mentally.',
      done: false,
      verifiedBy: 'manual',
    },
    {
      label: 'Quote-request leads route somewhere real',
      detail: 'Decide: one founder inbox, shared inbox, or partner-agent rotation. Then set CONTACT_TO_EMAIL accordingly (README item 9).',
      done: false,
      verifiedBy: 'manual',
    },
  ];

  const doneCount = checklist.filter((c) => c.done).length;

  return {
    checklist,
    doneCount,
    section: {
      id: 'launch',
      title: 'Launch checklist',
      status: doneCount === checklist.length ? 'ok' : 'setup',
      headline: `${doneCount} of ${checklist.length} complete. Mirrors the README "Required before launch" section, which stays the source of truth.`,
      items: [],
    },
  };
}

// ── Snapshot ─────────────────────────────────────────────────────────────
export interface FounderSnapshot {
  sections: FounderSection[];
  checklist: ChecklistItem[];
  checklistDone: number;
  /** The ordered "what needs my attention today" digest. */
  today: FounderItem[];
}

export function getFounderSnapshot(now: Date): FounderSnapshot {
  const { section: launchSection, checklist, doneCount } = launchChecklist();

  const sections: FounderSection[] = [
    routesNeedingFareChecks(now),
    dealsNeedingRecheck(now),
    affiliateStatus(),
    photographyStatus(),
    quoteRequestStatus(),
    travelClubStatus(),
    linkHealth(),
    warningsForReview(now),
    staleContent(now),
    launchSection,
  ];

  // Today digest: every section reporting attention leads; setup items that
  // block revenue or honesty come next; watch items only if the list is short.
  const today: FounderItem[] = [];
  for (const section of sections) {
    if (section.status === 'attention') {
      today.push({
        label: section.title,
        detail: section.headline,
        status: 'attention',
        href: `#${section.id}`,
      });
    }
  }
  for (const section of sections) {
    if (section.status === 'setup') {
      today.push({ label: section.title, detail: section.headline, status: 'setup', href: `#${section.id}` });
    }
  }
  if (today.length < 5) {
    for (const section of sections) {
      if (section.status === 'watch') {
        today.push({ label: section.title, detail: section.headline, status: 'watch', href: `#${section.id}` });
      }
    }
  }

  return { sections, checklist, checklistDone: doneCount, today: today.slice(0, 6) };
}
