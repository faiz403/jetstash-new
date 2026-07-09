import { deals } from '@/data/deals';
import { routes, getRouteAirport, getRouteDestination } from '@/data/routes';
import { destinations, getDestinationBySlug } from '@/data/destinations';
import { getAirportBySlug } from '@/data/airports';
import { fareObservations, getObservationsByRoute } from '@/data/fare-observations';
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

/**
 * Business-priority tier — the lens this dashboard leads with, ahead of
 * the more technical FounderStatus:
 *   'blocker'      — broken or dishonest right now. A visitor hits an
 *                     error, or the site claims something that isn't true.
 *                     Fix before treating the site as genuinely live.
 *   'revenue'       — works today, but leaves money or conversion on the
 *                     table (unpaid clicks, unresearched fares, unrouted
 *                     leads). No visitor-facing breakage.
 *   'nice-to-have'  — polish or enrichment with no deadline and no
 *                     functional/revenue impact either way.
 */
export type BusinessPriority = 'blocker' | 'revenue' | 'nice-to-have';

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
  priority: BusinessPriority;
  /** One-sentence answer to "what's the state here?" */
  headline: string;
  items: FounderItem[];
  /** What to actually do about it — file paths and concrete steps. */
  action?: string;
}

// ── Thresholds (days). Fare observations don't go stale (a historical
// range/check is honest at any age), so there is deliberately no watch/
// attention threshold for them any more — only for route service-end dates,
// which are genuine deadlines.
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

// ── 1. Fare observation coverage ─────────────────────────────────────────
// A calm backlog, not a deadline: a fare observation never goes "wrong" as
// it ages — an honest historical range or single check is just as true a
// year later, it just doesn't get any tighter. So there's nothing to
// escalate here, only routes worth enriching with a fresh check whenever
// convenient. Replaces the old age-based "stale deal" alarms entirely.
function fareObservationCoverage(): FounderSection {
  const noHistory: FounderItem[] = routes
    .filter((route) => getObservationsByRoute(route.slug).length === 0)
    .map((route) => ({
      label: routeLabel(route.slug),
      detail: 'No fare observations logged yet — its deal cards show route facts instead of a price until one is.',
      status: 'watch',
      href: `/routes/${route.slug}`,
    }));

  const withHistory = routes.length - noHistory.length;

  return {
    id: 'fare-checks',
    title: 'Fare observation coverage',
    priority: 'nice-to-have',
    status: noHistory.length > 0 ? 'watch' : 'ok',
    headline:
      noHistory.length === 0
        ? `All ${routes.length} routes have at least one logged fare observation.`
        : `${withHistory} of ${routes.length} routes have at least one fare observation · ${noHistory.length} have none yet. No deadline — log one whenever convenient to add a price to that route's deal cards.`,
    items: noHistory,
    action:
      'Optional, no deadline: check a fare on TravelUp or the airline\'s own site, then append a new entry to data/fare-observations.ts (never overwrite existing entries — it\'s an append-only history log).',
  };
}

// ── 3. Booking provider configuration ────────────────────────────────────
function affiliateStatus(): FounderSection {
  const primary = BOOKING_PROVIDERS[PRIMARY_PROVIDER_ID];
  const skyscanner = BOOKING_PROVIDERS.skyscanner;

  return {
    id: 'affiliate',
    title: 'Booking provider configuration',
    priority: 'revenue',
    status: !primary.hasTracking ? 'setup' : primary.supportsDeepLink ? 'ok' : 'watch',
    headline: !primary.hasTracking
      ? `Primary provider is ${primary.name}, but it has no real tracking link yet — every click-through is unpaid. Skyscanner stays disabled (application declined pre-launch).`
      : !primary.supportsDeepLink
        ? `Primary provider is ${primary.name}, tracked via a real CJ link (see lib/booking-providers.ts) — every click-through now earns commission. Deep-linking is still off though (a guessed URL shape broke in production once already), so links land on TravelUp's own default page rather than a specific destination.`
        : `Primary provider is ${primary.name}, tracked and deep-linking to manually verified destination pages.`,
    items: [],
    action: !primary.hasTracking
      ? `Sign up for ${primary.name}'s affiliate programme (via Commission Junction: https://signup.cj.com/member/signup/publisher/?cid=6248437) to get a real tracking link, then set it as BOOKING_PROVIDERS.${PRIMARY_PROVIDER_ID}.baseUrl in lib/booking-providers.ts.`
      : `Optional, no deadline: manually visit travelup.com, confirm a real destination URL works, add it to VERIFIED_DEEP_LINKS in lib/booking-providers.ts, then flip supportsDeepLink to true once at least one entry is confirmed. To re-enable ${skyscanner.name} later, flip its enabled flag and add its real tracking link in the same file.`,
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
    priority: 'nice-to-have',
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
    priority: 'blocker',
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
    priority: 'blocker',
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
    priority: 'blocker',
    status: worst(items.map((i) => i.status)),
    headline:
      items.length === 0
        ? `All ${deals.length} deals resolve to a real airport and destination, so every booking link is route-specific.`
        : `${items.length} deal${items.length === 1 ? '' : 's'} have a slug that doesn't resolve — their booking link degrades to a generic search. Details below.`,
    items,
    action: 'Fix the fromAirportSlug/toDestinationSlug in data/deals.ts to match a real entry in data/airports.ts / data/destinations.ts.',
  };
}

// ── 7b. Time-bound service changes ───────────────────────────────────────
// The one category with a real forcing date: unlike a re-verify backlog
// item, an announced withdrawal WILL make the site wrong the day it passes
// if nothing's done — no code change needed to trigger the false claim.
function serviceChangesStatus(now: Date): FounderSection {
  const items: FounderItem[] = [];

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
    id: 'service-changes',
    title: 'Time-bound service changes',
    priority: 'blocker',
    status: worst(items.map((i) => i.status)),
    headline:
      items.length === 0
        ? 'No announced direct-service withdrawals within the next 90 days.'
        : `${items.length} announced service change${items.length === 1 ? '' : 's'} with a real date — nothing wrong yet, but the site will start claiming a direct service that no longer exists the day this passes unaddressed.`,
    items,
    action: 'Follow the README "Time-bound direct services" procedure before the date passes: flip the route to connecting-only and move the withdrawal note into its history.',
  };
}

// ── 8. Route warnings needing review ─────────────────────────────────────
// A calm re-verify backlog, same philosophy as fare observation coverage:
// every warning here already describes the site's copy as hedged/honest
// today (no direct claim being made that isn't true) — the task is just to
// periodically confirm that's still the case as schedules drift.
function warningsForReview(): FounderSection {
  const items: FounderItem[] = routeWarnings
    .filter((w) => w.status === 'active')
    .map((w) => ({
      label: `${routeLabel(w.routeSlug)}: ${w.title}`,
      detail: `Severity: ${w.severity}. Still accurate? If resolved, flip status to 'resolved' in data/route-warnings.ts (never delete).`,
      status: 'watch' as FounderStatus,
      href: `/routes/${w.routeSlug}`,
    }));

  return {
    id: 'warnings',
    title: 'Route warnings to re-verify',
    priority: 'nice-to-have',
    status: items.length > 0 ? 'watch' : 'ok',
    headline:
      items.length === 0
        ? 'No active route warnings.'
        : `${items.length} item${items.length === 1 ? '' : 's'} worth re-verifying against current airline schedules. No deadline — the site's copy already hedges each of these honestly today.`,
    items,
    action: 'Verify each against the airline\'s own booking system. The site\'s standard is schedules, not press releases.',
  };
}

// ── 9. Pages with stale content ──────────────────────────────────────────
function staleContent(): FounderSection {
  const items: FounderItem[] = [];

  // Informational only — an observation log has no staleness to escalate,
  // unlike the single "current price" this label used to be derived from.
  const newest = fareObservations.reduce((max, o) => (o.observedDate > max ? o.observedDate : max), fareObservations[0].observedDate);
  items.push({
    label: 'Homepage & /deals: "Most recent check" label',
    detail: `The freshest fare observation logged is ${formatShortDate(newest)}, from ${fareObservations.length} observations logged in total. Purely informational — no deadline attached.`,
    status: 'ok',
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
    priority: 'nice-to-have',
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
  priority: BusinessPriority;
  /** 'auto' = derived from code/env at render time; 'manual' = judgement recorded here. */
  verifiedBy: 'auto' | 'manual';
}

function launchChecklist(): { section: FounderSection; checklist: ChecklistItem[]; doneCount: number } {
  const brevoReady = Boolean(process.env.BREVO_API_KEY && process.env.BREVO_LIST_ID);
  const resendReady = Boolean(process.env.RESEND_API_KEY);
  const primaryProvider = BOOKING_PROVIDERS[PRIMARY_PROVIDER_ID];
  const hasTracking = primaryProvider.hasTracking;
  const photoCoverage = imageCoverage();
  const photosComplete = photoCoverage.destinations >= destinations.length;

  const checklist: ChecklistItem[] = [
    {
      label: 'Real production build passes',
      detail: 'npm run build compiles all 90+ pages; verified on every commit and by Vercel deploys.',
      done: true,
      priority: 'blocker',
      verifiedBy: 'manual',
    },
    {
      label: 'Real photography',
      detail:
        photoCoverage.destinations === 0
          ? `All ${destinations.length} destinations still use the generated panel (deliberate, and it ships fine, but photography converts better).`
          : `${photoCoverage.destinations} of ${destinations.length} destinations now have real Signature Collection photography; the rest still use the generated panel.`,
      done: photosComplete,
      priority: 'nice-to-have',
      verifiedBy: 'auto',
    },
    {
      label: 'Newsletter wired up (Brevo env vars)',
      detail: brevoReady ? 'BREVO_API_KEY and BREVO_LIST_ID are set in this environment.' : 'BREVO_API_KEY / BREVO_LIST_ID not set in this environment.',
      done: brevoReady,
      priority: 'blocker',
      verifiedBy: 'auto',
    },
    {
      label: 'Contact form wired up (Resend env vars)',
      detail: resendReady ? 'RESEND_API_KEY is set in this environment.' : 'RESEND_API_KEY not set in this environment.',
      done: resendReady,
      priority: 'blocker',
      verifiedBy: 'auto',
    },
    {
      label: 'Fare observations reflect genuinely researched prices',
      detail:
        'Deal cards now show an honest range/check from data/fare-observations.ts instead of a hardcoded price, which removes the staleness risk — but the £ figures currently logged are still the original example numbers, not independently verified market fares. Replace them with genuinely researched checks over time (no deadline; log via the Fare observation coverage section above).',
      done: false,
      priority: 'revenue',
      verifiedBy: 'manual',
    },
    {
      label: 'Real tracking link on booking links',
      detail: hasTracking
        ? `${primaryProvider.name} (the primary provider) is a real, commission-earning CJ tracking link.`
        : `${primaryProvider.name} (the primary provider) has no real tracking link yet — see lib/booking-providers.ts.`,
      done: hasTracking,
      priority: 'revenue',
      verifiedBy: 'auto',
    },
    {
      label: `${primaryProvider.name} deep-link destinations verified`,
      detail: primaryProvider.supportsDeepLink
        ? `Deep-linking is on — at least one VERIFIED_DEEP_LINKS entry has been manually confirmed.`
        : `Deep-linking is OFF. A guessed URL shape broke in production once already, so links use the tracked homepage/search fallback (still commission-earning) rather than a specific destination. Manually visit travelup.com, confirm a real destination URL, add it to VERIFIED_DEEP_LINKS in lib/booking-providers.ts, then flip supportsDeepLink to true.`,
      done: primaryProvider.supportsDeepLink,
      priority: 'revenue',
      verifiedBy: 'auto',
    },
    {
      label: 'Brevo custom contact attributes created',
      detail: 'NEAREST_AIRPORT, TRAVEL_INTEREST + five WATCH_* attributes. Cannot be verified from code, so confirm in the Brevo dashboard and tick off mentally.',
      done: false,
      priority: 'revenue',
      verifiedBy: 'manual',
    },
    {
      label: 'Quote-request leads route somewhere real',
      detail: 'Decide: one founder inbox, shared inbox, or partner-agent rotation. Then set CONTACT_TO_EMAIL accordingly (README item 9).',
      done: false,
      priority: 'revenue',
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
      // Not grouped with the other sections — it's a flat mirror of the
      // README spanning all three priorities itself (each item carries its
      // own), rendered as its own full-width block. This tag is unused for
      // grouping but required by the shared interface.
      priority: 'blocker',
      status: doneCount === checklist.length ? 'ok' : 'setup',
      headline: `${doneCount} of ${checklist.length} complete. Mirrors the README "Required before launch" section, which stays the source of truth.`,
      items: [],
    },
  };
}

// ── Snapshot ─────────────────────────────────────────────────────────────
export interface FounderSnapshot {
  /** Every section (not the launch checklist), grouped by business priority — what this dashboard leads with. */
  grouped: Record<BusinessPriority, FounderSection[]>;
  launchSection: FounderSection;
  checklist: ChecklistItem[];
  checklistDone: number;
  /** The ordered "what needs my attention today" digest. */
  today: FounderItem[];
}

export function getFounderSnapshot(now: Date): FounderSnapshot {
  const { section: launchSection, checklist, doneCount } = launchChecklist();

  const sections: FounderSection[] = [
    quoteRequestStatus(),
    travelClubStatus(),
    linkHealth(),
    serviceChangesStatus(now),
    affiliateStatus(),
    fareObservationCoverage(),
    photographyStatus(),
    warningsForReview(),
    staleContent(),
  ];

  const grouped: Record<BusinessPriority, FounderSection[]> = {
    blocker: sections.filter((s) => s.priority === 'blocker'),
    revenue: sections.filter((s) => s.priority === 'revenue'),
    'nice-to-have': sections.filter((s) => s.priority === 'nice-to-have'),
  };

  // Today digest: business priority leads — every not-ok blocker section
  // first, then every not-ok revenue section, then nice-to-have only if
  // there's still room. Technical status only breaks ties within a tier.
  // This is what "prioritise the business, not just the loudest technical
  // alarm" means in practice.
  const priorityOrder: BusinessPriority[] = ['blocker', 'revenue', 'nice-to-have'];
  const statusRank: Record<FounderStatus, number> = { attention: 0, setup: 1, watch: 2, ok: 3 };
  const notOk = sections
    .filter((s) => s.status !== 'ok')
    .sort((a, b) => {
      const byPriority = priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority);
      return byPriority !== 0 ? byPriority : statusRank[a.status] - statusRank[b.status];
    });

  const today: FounderItem[] = notOk
    .slice(0, 6)
    .map((section) => ({ label: section.title, detail: section.headline, status: section.status, href: `#${section.id}` }));

  return { grouped, launchSection, checklist, checklistDone: doneCount, today };
}
