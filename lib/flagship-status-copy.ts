import { getRouteBySlug, getRouteStatus } from '@/data/routes';
import { getAirlinesBySlugs } from '@/data/airlines';
import { routeStatusEvents, type RouteStatusEvent } from '@/data/route-status-events';
import { getRouteStatusCopy, getEffectiveRoutePresentation, type RouteStatusViewModel, type ResolvedServiceNotice, type ResolvedCitation } from '@/lib/route-status-copy';

/**
 * The featured homepage thread's safe, sourced copy — see the Route Status
 * V1 implementation addendum §3, the final audit §4, and the second final
 * audit (evidence-leak fix). Every field here is generated from a validated
 * RouteStatusViewModel and its resolved citations/service notices; this
 * file must never contain a hard-coded airline name, a hard-coded date, an
 * assumed "a service change is currently active" assertion, or a promised
 * future check date that isn't backed by a current operational scheduling
 * model (there is none here, so none is ever promised). A route with no
 * active notice states exactly that — plainly, not by omission. Every date
 * is rendered human-readable ("31 August 2026"), never raw ISO.
 */
export interface FlagshipStatusCopy {
  /** The 'Route status' pin's detail line. */
  routeDetail: string;
  /** The 'Service change' pin's detail line. */
  changeDetail: string;
  /** The at-rest surfaced-truth line and the opened Brief's verdict headline. */
  verdictLine: string;
  /** The 'Evidence' pin's detail line AND the paragraph beneath the opened verdict — the ONLY evidence text this surface renders. */
  evidenceDetail: string;
}

const FALLBACK: FlagshipStatusCopy = {
  routeDetail: "We can't currently confirm this route's direct service — check directly with the airline before booking.",
  changeDetail: "We can't currently confirm this route's direct service — check directly with the airline before booking.",
  verdictLine: "We can't currently confirm this route's direct service — check directly with the airline before booking.",
  evidenceDetail: 'Current direct-service evidence is awaiting verification.',
};

function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** null (never a fabricated date) when the citation carries no accessedAt. */
function formatCitationDate(citation: ResolvedCitation | undefined): string | null {
  if (!citation?.accessedAt) return null;
  return formatDate(citation.accessedAt);
}

function describeNotice(notice: ResolvedServiceNotice): string {
  const publisher = notice.citations[0]?.publisher ?? notice.airlineName;
  const date = formatDate(notice.effectiveFrom);
  if (notice.kind === 'service-ended') {
    return `${notice.airlineName}'s direct service has ended (${publisher}, from ${date}). Check current options directly with the airline.`;
  }
  if (notice.kind === 'status-reverification-pending') {
    return `${notice.airlineName}'s announced change date (${date}) has passed and hasn't yet been reconfirmed by ${publisher} — check directly before booking.`;
  }
  // 'withdrawal-announced'
  return `${publisher} has announced a change to ${notice.airlineName}'s service, with effect from ${date} — check before booking travel from that date.`;
}

/**
 * Pure mapper — no route lookup, no ledger read, no wall clock. Fully
 * testable against a synthetic RouteStatusViewModel, independent of the
 * real Manchester–Mumbai ledger data. `airlineNames` is the exact,
 * already-filtered list of currently-attributable airline names for this
 * route (see buildFlagshipStatusCopy below) — never re-derived here.
 *
 * `evidenceDetail` never asserts a source is specifically "the airline's
 * own schedule" — the resolved citation only proves a publisher, URL and
 * accessed date, never a source *type* — so `routeDetail`/`verdictLine`
 * use the restrained "Direct service currently verified" framing instead
 * of the old, over-specific claim.
 */
export function mapViewModelToFlagshipCopy(viewModel: RouteStatusViewModel, airlineNames: string[]): FlagshipStatusCopy {
  const airlineList = airlineNames.length > 0 ? airlineNames.join(', ') : 'the operating airline';

  switch (viewModel.kind) {
    case 'verified-direct': {
      const checkedDate = formatCitationDate(viewModel.citations[0]);
      const evidenceDetail = checkedDate ? `Current route evidence checked ${checkedDate}.` : 'Current route evidence is on record.';
      const routeDetail = `Direct, flown by ${airlineList}. Direct service currently verified.`;
      if (viewModel.serviceNotices.length === 0) {
        return {
          routeDetail,
          changeDetail: 'No active service-change notice for this route.',
          verdictLine: `Direct today, flown by ${airlineList}. Direct service currently verified.`,
          evidenceDetail,
        };
      }
      const changeDetail = viewModel.serviceNotices.map(describeNotice).join(' ');
      return { routeDetail, changeDetail, verdictLine: changeDetail, evidenceDetail };
    }
    case 'withdrawal-announced': {
      const citation = viewModel.citations[0];
      const publisher = citation?.publisher ?? 'The airline';
      const checkedDate = formatCitationDate(citation);
      const evidenceDetail = checkedDate ? `Service-change evidence: ${publisher} · checked ${checkedDate}.` : `Service-change evidence: ${publisher}.`;
      return {
        routeDetail: `Direct, flown by ${airlineList}. Direct service currently verified.`,
        changeDetail: viewModel.explanation,
        verdictLine: `${publisher} has announced a change to this service, with effect from ${formatDate(viewModel.effectiveFrom)} — check before booking travel from that date.`,
        evidenceDetail,
      };
    }
    case 'service-ended': {
      const citation = viewModel.citations[0];
      const publisher = citation?.publisher ?? 'the airline';
      const checkedDate = formatCitationDate(citation);
      const evidenceDetail = checkedDate ? `Service-end evidence: ${publisher} · checked ${checkedDate}.` : `Service-end evidence: ${publisher}.`;
      return {
        routeDetail: 'Direct service ended. Check current options directly with the airline.',
        changeDetail: viewModel.explanation,
        verdictLine: 'This direct service has ended. Check current options directly with the airline before booking.',
        evidenceDetail,
      };
    }
    case 'transition-boundary-pending': {
      const checkedDate = formatCitationDate(viewModel.citations[0]);
      const evidenceDetail = checkedDate
        ? `Service-change evidence: ${viewModel.publisher} · checked ${checkedDate}; current operation awaiting reverification.`
        : `Service-change evidence: ${viewModel.publisher}; current operation awaiting reverification.`;
      return {
        routeDetail: `${viewModel.publisher}'s announced change date has passed. We haven't yet reconfirmed this service — check directly before booking.`,
        changeDetail: viewModel.body,
        verdictLine: viewModel.body,
        evidenceDetail,
      };
    }
    case 'neutral-pending':
      return FALLBACK;
  }
}

/**
 * The full pipeline: looks up the named route, derives its Route Status,
 * resolves and validates the customer-facing view model, and maps it to
 * FlagshipStatusCopy — the one function the homepage server component
 * calls. Computed server-side (never in the 'use client' pull-brief.tsx)
 * so the client bundle stays free of the ledger/copy-layer data files.
 */
export function buildFlagshipStatusCopy(routeSlug: string, allEvents: RouteStatusEvent[] = routeStatusEvents, nowIso: string = new Date().toISOString().slice(0, 10)): FlagshipStatusCopy {
  const route = getRouteBySlug(routeSlug);
  if (!route) return FALLBACK;
  const status = getRouteStatus(route, allEvents, nowIso);
  if (!status) return FALLBACK;
  const viewModel = getRouteStatusCopy(route, status, allEvents, nowIso);
  const presentationAirlineSlugs = getEffectiveRoutePresentation(route, allEvents, nowIso).airlineSlugs;
  const airlineNames = getAirlinesBySlugs(presentationAirlineSlugs).map((a) => a.name);
  return mapViewModelToFlagshipCopy(viewModel, airlineNames);
}
