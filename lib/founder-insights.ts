import { deals } from '@/data/deals';
import { routes, getRouteAirport, getRouteDestination, getRouteStatus, type Route } from '@/data/routes';
import { routeStatusEvents } from '@/data/route-status-events';
import { destinations, getDestinationBySlug } from '@/data/destinations';
import { getAirportBySlug } from '@/data/airports';
import { fareObservations, getObservationsByRoute, getLatestObservation } from '@/data/fare-observations';
import { generateRouteWatchFareCandidates } from '@/lib/route-watch-fare-trigger';
import { routeWarnings } from '@/data/route-warnings';
import { imageCoverage } from '@/lib/brand-images';
import { hasTripComRoute, PROVIDER_NAME } from '@/lib/booking-providers';
import { BOOK_BY_PRIORITY_ROUTE_SLUGS } from '@/lib/booking-intelligence';
import { computeAllReadinessSnapshots, VERDICT_COPY } from '@/lib/travel-intelligence-engine';
import { travelReadyRules, isRuleStale } from '@/data/travel-ready-rules';
import { TRAVEL_READY_SUPPORTED_COUNTRIES } from '@/lib/travel-ready-check';
import { siteConfig } from '@/lib/site-config';
import {
  OBSERVATION_FRESH_DAYS,
  OBSERVATION_STALE_DAYS,
  SERVICE_END_WATCH_DAYS,
  RULE_REVIEW_WATCH_DAYS,
} from '@/lib/freshness-thresholds';

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

// Freshness/review thresholds live in lib/freshness-thresholds.ts, the single
// place every "how old is too old" number is defined — imported above.

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

// ── 0. Travel Intelligence Engine — alert queue ──────────────────────────
// Detection is automated (JETSTASH_PRINCIPLES.md §14.2); sending stays
// human. This surfaces every priority route whose engine verdict currently
// warrants a look for a possible Route Watch send — never auto-sent, never
// escalated past 'watch', because a verdict worth reviewing is not the same
// as a site defect.
function engineAlertQueue(now: Date): FounderSection {
  const snapshots = computeAllReadinessSnapshots(now);
  const items: FounderItem[] = snapshots
    .filter((s) => s.verdict === 'wait-critical' || s.verdict === 'ready-with-caution')
    .map((s) => ({
      label: `${routeLabel(s.routeSlug)}: ${VERDICT_COPY[s.verdict].label}`,
      detail:
        s.reasons.find((r) => r.source === 'route-warning')?.detail ??
        'Engine verdict changed — review whether this is worth a Route Watch send.',
      status: 'watch' as FounderStatus,
      href: `/routes/${s.routeSlug}`,
    }));

  return {
    id: 'engine-queue',
    title: 'Travel Intelligence Engine — alert queue',
    priority: 'nice-to-have',
    status: items.length > 0 ? 'watch' : 'ok',
    headline:
      items.length === 0
        ? `No active warnings on any of the ${snapshots.length} engine-covered routes — nothing flagged for review.`
        : `${items.length} of ${snapshots.length} engine-covered routes have a verdict worth reviewing for a Route Watch send. No deadline — nothing sends itself.`,
    items,
    action: 'Review each route, confirm the underlying fact is still accurate, and send a Route Watch email to that route\'s watchers via Brevo if it\'s genuinely worth their attention — same manual-send model as Travel Club.',
  };
}

// ── 0b. Route Watch — meaningful lower-fare candidates ───────────────────
// PR #143: makes the "I care most about a lower fare" Route Watch intent
// (lib/route-watch-options.ts) genuinely operable, without weakening
// JetStash's existing Standout Fare evidence standard to manufacture
// candidates. Deterministic from fareObservations alone — no Brevo call
// here; the founder checks WATCH_ROUTE + WATCH_INTENT === 'best-fare'
// subscribers manually in Brevo at send time (see
// docs/project-control/ROUTE_WATCH_PILOT_PROCEDURE.md). Deliberately reuses
// generateRouteWatchFareCandidates (lib/route-watch-fare-trigger.ts), which
// itself reuses Fare Watcher's existing engine unchanged — never a second,
// looser threshold invented just to keep this queue non-empty. Zero
// candidates is an honest, expected result on a given day, not a defect.
function routeWatchFareCandidates(now: Date): FounderSection {
  const nowIso = now.toISOString().slice(0, 10);
  const candidates = generateRouteWatchFareCandidates(fareObservations, nowIso);

  const items: FounderItem[] = candidates.map((c) => ({
    label: `${routeLabel(c.routeSlug)}: ${c.currency} ${c.currentFare} (${c.qualification === 'standout-candidate' ? 'standout candidate' : 'notable drop'})`,
    detail:
      `£${c.currentFare} vs a comparable median of £${c.baselineMedian} (previous low £${c.previousLow}) — `
      + `£${c.differencePounds} / ${c.differencePercent.toFixed(1)}% below median, from ${c.baselineSampleSize} comparable prior checks. `
      + `Checked ${c.checkedDate}, travel ${c.travelDates.departureDate} to ${c.travelDates.returnDate}, ${c.airlineOrProvider}. `
      + `Verify the source, then check Brevo for WATCH_ROUTE + WATCH_INTENT=best-fare subscribers on this route before deciding whether to send.`,
    status: 'watch',
    href: `/routes/${c.routeSlug}`,
  }));

  return {
    id: 'route-watch-fare-candidates',
    title: 'Route Watch — lower-fare candidates',
    priority: 'nice-to-have',
    status: items.length > 0 ? 'watch' : 'ok',
    headline:
      items.length === 0
        ? "No fare observation currently clears Fare Watcher's strong evidence threshold (≥£25 and ≥10% below a ≥3-point comparable median) — nothing qualifies for a Route Watch lower-fare send today. That's expected on a thin archive, not a gap to work around."
        : `${items.length} fare observation${items.length === 1 ? '' : 's'} clear Fare Watcher's strong evidence threshold and may be worth a manual Route Watch send to that route's "I care most about a lower fare" subscribers. Nothing sends itself.`,
    items,
    action:
      'For each candidate: verify the source, check Brevo for WATCH_ROUTE + WATCH_INTENT=best-fare subscribers on this route, check the private operating log and Brevo campaign history for a duplicate (see docs/project-control/ROUTE_WATCH_PILOT_PROCEDURE.md), then send manually via Brevo Campaigns only if genuinely worth it — same manual-send model as the route-status queue above.',
  };
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
      'Optional, no deadline: check a fare on Trip.com or the airline\'s own site, then append a new entry to data/fare-observations.ts (never overwrite existing entries — it\'s an append-only history log).',
  };
}

// ── 3. Booking provider configuration ────────────────────────────────────
function affiliateStatus(): FounderSection {
  const supportedCount = routes.filter((r) => hasTripComRoute(r.slug)).length;
  const unsupportedCount = routes.length - supportedCount;

  return {
    id: 'affiliate',
    title: 'Booking provider configuration',
    priority: 'revenue',
    status: 'ok',
    headline: `${PROVIDER_NAME} is the sole active provider (TravelUp removed — its generic-search CTA reset the traveller's departure airport). ${supportedCount} of ${routes.length} routes have a genuine, dashboard-generated affiliate link; the other ${unsupportedCount} remain intentionally unsupported where Trip.com's own tools do not provide a safe exact dateless link — those fail closed with no booking CTA, by design, rather than falling back to a generic link.`,
    items: [],
    action:
      'No action needed for the covered routes — every link is the exact, unedited output of Trip.com\'s Affiliate Link dashboard, never hand-typed or guessed (see lib/booking-providers.ts). If Trip.com later adds Heathrow/Gatwick-specific deep-linking, regenerate those routes\' links the same way through the dashboard and add them to TRIPCOM_ROUTE_URLS.',
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
  const inbox = process.env.CONTACT_TO_EMAIL ?? siteConfig.contactEmail;

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
// must resolve to a real Airport/Destination — otherwise its booking CTA
// fails closed (no CTA at all, never a generic fallback search).
function linkHealth(): FounderSection {
  const items: FounderItem[] = [];

  for (const deal of deals) {
    const airport = getAirportBySlug(deal.fromAirportSlug);
    const destination = getDestinationBySlug(deal.toDestinationSlug);
    if (!airport || !destination) {
      items.push({
        label: `${deal.fromCity} → ${deal.toCity} (${deal.cabin})`,
        detail: !airport
          ? `fromAirportSlug "${deal.fromAirportSlug}" does not match any Airport — this deal's booking CTA fails closed (no CTA shown).`
          : `toDestinationSlug "${deal.toDestinationSlug}" does not match any Destination — this deal's booking CTA fails closed (no CTA shown).`,
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
        : `${items.length} deal${items.length === 1 ? '' : 's'} have a slug that doesn't resolve — their booking CTA fails closed instead of showing anything. Details below.`,
    items,
    action: 'Fix the fromAirportSlug/toDestinationSlug in data/deals.ts to match a real entry in data/airports.ts / data/destinations.ts.',
  };
}

// ── 7b. Time-bound service changes ───────────────────────────────────────
// Every time-bound direct-service change is modelled in the Route Status V1
// ledger (data/route-status-events.ts), never in a per-route field — this
// section reads getRouteStatus() for every route the ledger manages,
// instead of iterating a since-removed directServiceEndDate field. An
// announcement alone is never proof of occurrence: a route whose announced
// date has passed still needs a founder to separately verify and record
// what actually happened (service-ended, cancelled, or rescheduled) — this
// section flags exactly that gap, it never assumes the outcome.
function serviceChangesStatus(now: Date): FounderSection {
  const items: FounderItem[] = [];
  const nowIso = now.toISOString().slice(0, 10);

  for (const route of routes) {
    const status = getRouteStatus(route, routeStatusEvents, nowIso);
    if (!status) continue;

    if (status.status === 'withdrawal-announced') {
      const daysAway = -daysBetween(status.effectiveFrom, now);
      if (daysAway <= SERVICE_END_WATCH_DAYS) {
        items.push({
          label: `${routeLabel(route.slug)}: announced change with effect from ${formatShortDate(status.effectiveFrom)}`,
          detail: `${daysAway} days away. Once this date passes, verify with the airline whether the service actually ended, was postponed, or continues, and record the outcome as a new dated event in the Route Status ledger.`,
          status: 'watch',
          href: `/routes/${route.slug}`,
        });
      }
    } else if (status.status === 'verification-pending' && status.pendingReason.kind === 'transition-boundary-reached') {
      items.push({
        label: `${routeLabel(route.slug)}: announced change date has passed, not yet reverified`,
        detail: `Effective from ${formatShortDate(status.pendingReason.effectiveFrom)}. The route is correctly showing as pending — verify with the airline whether the service actually ended, was postponed, or continues, and append the outcome as a new dated event in the ledger. The announcement alone is never recorded as proof of occurrence.`,
        status: 'attention',
        href: `/routes/${route.slug}`,
      });
    } else if (status.status === 'verification-pending' && status.pendingReason.kind === 'conflicting-ledger-evidence') {
      items.push({
        label: `${routeLabel(route.slug)}: Route Status ledger has conflicting evidence`,
        detail: `Diagnostic: ${status.pendingReason.diagnostic}. The route is correctly showing as pending, but the underlying ledger entries need review — see data/route-status-events.ts.`,
        status: 'attention',
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
        ? 'No announced service changes need attention right now.'
        : `${items.length} ledger-managed service change${items.length === 1 ? '' : 's'} need${items.length === 1 ? 's' : ''} a founder look — either a reverification is due, or the ledger data itself needs review.`,
    items,
    action:
      'Verify the real outcome using primary evidence once an announced date passes, then append the appropriate service-ended, withdrawal-rescheduled, or withdrawal-cancelled event to the Route Status ledger (data/route-status-events.ts) — see README "Time-bound direct services". Never infer a connecting service from a withdrawal; that requires its own independent evidence.',
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

// ── 8b. Book-By Countdown data cadence ───────────────────────────────────
// A calm enrichment backlog, same philosophy as fare observation coverage —
// nothing here is launch-critical, because the Book-By panel (§14 of
// JETSTASH_PRINCIPLES.md) degrades honestly on its own: thin or absent data
// just means it falls back to calendar-only guidance with no price context,
// never a false claim. This section exists purely to support the weekly
// logging workflow the feature depends on, not to manufacture urgency about
// it — priority stays 'nice-to-have' throughout. Status escalates to
// 'attention' only once an observation passes OBSERVATION_STALE_DAYS
// (significantly, not just due for a refresh) — the panel above still
// degrades honestly either way, this is purely a founder-side signal that a
// priority route's price context has been quietly stale for a while.
function bookByCadenceStatus(now: Date): FounderSection {
  const nowIso = now.toISOString().slice(0, 10);
  const items: FounderItem[] = [];

  for (const routeSlug of BOOK_BY_PRIORITY_ROUTE_SLUGS) {
    const label = routeLabel(routeSlug);
    const observations = getObservationsByRoute(routeSlug);
    const latest = getLatestObservation(routeSlug);
    const hasDepartureDate = observations.some((o) => Boolean(o.departureDate));

    if (!latest) {
      items.push({
        label,
        detail: 'No fare observations logged yet for this priority route — its Book-By panel shows calendar-only guidance with no price context.',
        status: 'watch',
        href: `/routes/${routeSlug}`,
      });
      continue;
    }

    const ageDays = daysBetween(latest.observedDate, now);
    if (ageDays > OBSERVATION_STALE_DAYS) {
      items.push({
        label,
        detail: `Latest observation is ${ageDays} days old (checked ${formatShortDate(latest.observedDate)}) — significantly overdue for a priority route, not just due a refresh.`,
        status: 'attention',
        href: `/routes/${routeSlug}`,
      });
    } else if (ageDays > OBSERVATION_FRESH_DAYS) {
      items.push({
        label,
        detail: `Latest observation is ${ageDays} days old (checked ${formatShortDate(latest.observedDate)}) — due a fresh weekly check.`,
        status: 'watch',
        href: `/routes/${routeSlug}`,
      });
    } else if (!hasDepartureDate) {
      items.push({
        label,
        detail: 'Observations are fresh, but none record departureDate yet — add it on the next logged check so days-out price curves can start accumulating (Phase 2/3, see JETSTASH_PRINCIPLES.md §14).',
        status: 'watch',
        href: `/routes/${routeSlug}`,
      });
    }
  }

  const okCount = BOOK_BY_PRIORITY_ROUTE_SLUGS.length - items.length;

  return {
    id: 'bookby-cadence',
    title: 'Book-By Countdown data cadence',
    priority: 'nice-to-have',
    status: items.length > 0 ? worst(items.map((i) => i.status)) : 'ok',
    headline:
      items.length === 0
        ? `All ${BOOK_BY_PRIORITY_ROUTE_SLUGS.length} priority routes have a fresh (≤${OBSERVATION_FRESH_DAYS}-day) observation recording a departure date.`
        : `${okCount} of ${BOOK_BY_PRIORITY_ROUTE_SLUGS.length} priority routes are fully current · ${items.length} worth a weekly check. No deadline — the panel degrades honestly on its own; this is enrichment, not a launch blocker.`,
    items,
    action:
      'Weekly logging workflow: check a fare on Trip.com or the airline\'s own site for each priority route, then append a new data/fare-observations.ts entry — set departureDate to the date you\'d actually book for (typically the route\'s next upcoming peak period). Never overwrite an existing entry.',
  };
}

// ── 8b. Travel Ready Check — rules ops ───────────────────────────────────
// Rule freshness is a trust/compliance concern, not pure commercial cadence
// like Book-By's fare checks — hence 'revenue' priority rather than
// 'nice-to-have'. The public UI already degrades safely on its own (a
// stale rule shows "official confirmation required" instead of continuing
// to look current, per JETSTASH_PRINCIPLES.md §14.3) — this section is the
// founder's reminder to actually go re-verify, not a sign anything is
// currently dishonest.

function travelReadyOpsStatus(now: Date): FounderSection {
  const nowIso = now.toISOString().slice(0, 10);
  const items: FounderItem[] = [];

  for (const rule of travelReadyRules) {
    const daysToReview = Math.floor(
      (new Date(`${rule.reviewDueDate}T00:00:00Z`).getTime() - new Date(`${nowIso}T00:00:00Z`).getTime()) / 86_400_000
    );
    if (isRuleStale(rule, nowIso)) {
      items.push({
        label: `${rule.country} · ${rule.ruleType}`,
        detail: `Past its review date (due ${formatShortDate(rule.reviewDueDate)}) — the public check now shows "official confirmation required" for this rule rather than presenting it as current.`,
        status: 'attention',
        href: '/travel-ready-check',
      });
    } else if (daysToReview <= RULE_REVIEW_WATCH_DAYS) {
      items.push({
        label: `${rule.country} · ${rule.ruleType}`,
        detail: `Due for re-verification in ${daysToReview} day${daysToReview === 1 ? '' : 's'} (${formatShortDate(rule.reviewDueDate)}) — re-check the official source before it lapses.`,
        status: 'watch',
        href: '/travel-ready-check',
      });
    }
  }

  const coveredCountries = new Set(travelReadyRules.map((r) => r.country)).size;
  const status = worst(items.map((i) => i.status));

  return {
    id: 'travel-ready-ops',
    title: 'Travel Ready Check — rules ops',
    priority: 'revenue',
    status,
    headline:
      items.length === 0
        ? `All ${travelReadyRules.length} rules across ${coveredCountries}/${TRAVEL_READY_SUPPORTED_COUNTRIES.length} supported countries are fresh.`
        : `${items.length} of ${travelReadyRules.length} rules need attention across ${coveredCountries}/${TRAVEL_READY_SUPPORTED_COUNTRIES.length} supported countries. Coverage is deliberately limited to British passport holders plus NICOP/POC (Pakistan), OCI (India) and NVR (Bangladesh) document holders — every other nationality gets an honest "not enough information", not a guess.`,
    items,
    action:
      'Re-check the rule\'s official source directly (never a blog or forum), update requirement/officialSource if anything changed, then bump lastVerifiedDate to today and reviewDueDate 6 months out in data/travel-ready-rules.ts.',
  };
}

// ── 8c. Route verification review status ─────────────────────────────────
// PR #146: Route.verification.reviewDueDate already gates public display
// via isCurrentClaimValid()/getEffectiveRoutePresentation() (data/routes.ts)
// — an expired review already fails closed to neutral "Verification
// pending" copy on its own, never a stale "verified" claim continuing to
// show. What was missing was founder visibility: nothing previously
// surfaced which routes were approaching or past that date, so a founder
// could not realistically track dozens of individual dates by memory. This
// section is purely derived from existing route data — read-only, no
// network call, no persisted state — and never changes a review date, a
// verification status, or any customer-facing presentation; it only tells
// the founder where to look. Reuses RULE_REVIEW_WATCH_DAYS
// (lib/freshness-thresholds.ts) as the "approaching" horizon, the same
// convention travelReadyOpsStatus above already uses for Travel Ready
// rules — not a new threshold invented for this section. That horizon
// controls only when this dashboard shows a reminder; it never changes
// what reviewDueDate itself means or how the public site behaves.
//
// Service-ended reminder suppression (Rolling Reverification Batch 4
// follow-up, 4 September 2026): a route's verification.reviewDueDate can
// lapse long after its current truth has already been fully and separately
// settled by a verified `service-ended` event in the Route Status V1 ledger
// (data/route-status-events.ts) — re-verifying a schedule for a service
// that has verifiably stopped operating is not useful founder work.
// hasCurrentlyEndedService() below reuses getRouteStatus(), the same
// ledger-derivation helper serviceChangesStatus() (§7b above) already
// calls, rather than inventing a second interpretation of route status.
// Confirmed cases at time of writing: manchester-mumbai and
// manchester-delhi (both IndiGo withdrawals, effective 31 August 2026).
const MAX_DUE_SOON_ITEMS_SHOWN = 15;

/**
 * True when a route's CURRENT effective truth is a verified service-ended
 * state — not merely "this route once had a service-ended event." getRouteStatus()
 * re-derives this fresh against nowIso every call: a service-ended event
 * carries its own currentClaimValidBefore and can itself go stale, and a
 * later event can supersede an earlier one (see data/route-status-events.ts
 * and resolveServiceLifecycle()'s doc comment in data/routes.ts) — so a
 * route whose service later resumed, or whose ended-claim itself expires
 * without being refreshed, automatically falls back out of this check with
 * no separate tracking needed here. Routes the ledger doesn't manage at all
 * (getRouteStatus() returns null) are never affected.
 */
function hasCurrentlyEndedService(route: Route, nowIso: string): boolean {
  return getRouteStatus(route, routeStatusEvents, nowIso)?.status === 'service-ended';
}

function routeVerificationReviewStatus(now: Date): FounderSection {
  const nowIso = now.toISOString().slice(0, 10);
  const verifiedRoutes = routes.filter((r) => r.verification && !hasCurrentlyEndedService(r, nowIso));

  const withDays = verifiedRoutes.map((route) => ({
    route,
    daysToReview: Math.floor(
      (new Date(`${route.verification!.reviewDueDate}T00:00:00Z`).getTime() - new Date(`${nowIso}T00:00:00Z`).getTime()) / 86_400_000
    ),
  }));

  const overdue = withDays.filter((r) => r.daysToReview < 0).sort((a, b) => a.daysToReview - b.daysToReview);
  const dueSoon = withDays
    .filter((r) => r.daysToReview >= 0 && r.daysToReview <= RULE_REVIEW_WATCH_DAYS)
    .sort((a, b) => a.daysToReview - b.daysToReview);
  const healthyCount = withDays.length - overdue.length - dueSoon.length;

  const overdueItems: FounderItem[] = overdue.map(({ route, daysToReview }) => {
    const daysOverdue = Math.abs(daysToReview);
    return {
      label: `${routeLabel(route.slug)}: overdue by ${daysOverdue} day${daysOverdue === 1 ? '' : 's'}`,
      detail: `Review was due ${formatShortDate(route.verification!.reviewDueDate)} — this route's presentation has already failed closed to neutral "Verification pending" copy. Re-check the evidence against verification.sourceName/sourceUrl and update verification.verifiedDate/reviewDueDate in data/routes.ts if still supported, or leave it as-is if not.`,
      status: 'attention',
      href: `/routes/${route.slug}`,
    };
  });

  // Kept concise on purpose (§6): with the current review-date clustering,
  // dozens of routes can legitimately fall inside the watch window at once
  // — rendering every one as a full card would make the section unusable.
  // The nearest MAX_DUE_SOON_ITEMS_SHOWN are listed individually (most
  // actionable first); the remainder is summarised as one count so the
  // section stays honest about total volume without becoming a wall of
  // cards. The headline below always states the true, uncapped totals.
  const dueSoonShown = dueSoon.slice(0, MAX_DUE_SOON_ITEMS_SHOWN);
  const dueSoonItems: FounderItem[] = dueSoonShown.map(({ route, daysToReview }) => ({
    label: `${routeLabel(route.slug)}: due in ${daysToReview} day${daysToReview === 1 ? '' : 's'}`,
    detail: `Review due ${formatShortDate(route.verification!.reviewDueDate)} — re-check the evidence before it lapses, or let it fail closed honestly if nothing current supports it.`,
    status: 'watch',
    href: `/routes/${route.slug}`,
  }));
  const hiddenDueSoonCount = dueSoon.length - dueSoonShown.length;
  if (hiddenDueSoonCount > 0) {
    dueSoonItems.push({
      label: `+ ${hiddenDueSoonCount} more route${hiddenDueSoonCount === 1 ? '' : 's'} due within ${RULE_REVIEW_WATCH_DAYS} days`,
      detail: 'Not listed individually to keep this section readable — see verification.reviewDueDate across data/routes.ts for the full list.',
      status: 'watch',
    });
  }

  const items = [...overdueItems, ...dueSoonItems];

  return {
    id: 'route-verification-review',
    title: 'Route verification reviews',
    priority: 'revenue',
    status: worst(items.map((i) => i.status)),
    headline:
      overdue.length === 0 && dueSoon.length === 0
        ? `All ${verifiedRoutes.length} verified routes are within a healthy review window.`
        : `${overdue.length} route${overdue.length === 1 ? '' : 's'} overdue for re-verification, ${dueSoon.length} due within ${RULE_REVIEW_WATCH_DAYS} days, ${healthyCount} healthy. An expired review already fails closed to neutral presentation on its own — this is a review-timing reminder, not a sign anything dishonest is currently showing.`,
    items,
    action:
      'For an overdue or soon-due route: re-check the evidence against verification.sourceName/sourceUrl, then update verification.verifiedDate and reviewDueDate in data/routes.ts if the direct/connecting claim still holds. If nothing current supports it, leave the review date as-is — the route already fails closed to honest neutral copy automatically; this dashboard never extends a review date or reverifies a route on its own.',
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
    label: 'Privacy policy: "Last updated: July 2026"',
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
  const tripComSupportedCount = routes.filter((r) => hasTripComRoute(r.slug)).length;
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
      detail: `Every ${PROVIDER_NAME} URL in lib/booking-providers.ts is the exact, unedited output of Trip.com's own affiliate dashboard, carrying JetStash's genuine Allianceid/SID — never hand-typed or guessed.`,
      done: true,
      priority: 'revenue',
      verifiedBy: 'auto',
    },
    {
      label: `${PROVIDER_NAME} route coverage`,
      detail: `${tripComSupportedCount} of ${routes.length} routes have a dashboard-verified link. The rest remain fail-closed where Trip.com's tools do not provide a safe exact dateless link — not a gap to fill by guessing a URL.`,
      done: true,
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
      detail: `Routes to ${siteConfig.contactEmail} by default (lib/site-config.ts), overridable via CONTACT_TO_EMAIL in Vercel — a real inbox, not a placeholder. Revisit if this should become a shared inbox or partner-agent rotation later.`,
      done: true,
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
    engineAlertQueue(now),
    routeWatchFareCandidates(now),
    fareObservationCoverage(),
    bookByCadenceStatus(now),
    travelReadyOpsStatus(now),
    routeVerificationReviewStatus(now),
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
