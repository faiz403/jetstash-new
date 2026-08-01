import type { BaggageType, ConnectionRiskPreference, DeadlineStrictness, PlanningAssumption } from './types';

/**
 * Every number Arrive By's backward-planning arithmetic uses, named and
 * justified, in one place — never a magic number inline in engine.ts. Each
 * is a deliberately generic, adjustable PLANNING ASSUMPTION, distinct from
 * a verified JetStash route fact (those live in data/routes.ts and are
 * read, never recomputed, by lib/arrive-by/route-support.ts). Changing a
 * number here changes every result; that is the point — one place to
 * tune, one place to review.
 */

// ── Indicative journey duration ──────────────────────────────────────────

/**
 * A direct long-haul flight across JetStash's current supported network
 * (Manchester to the Gulf or South Asia) — Dubai at the short end, Lahore/
 * Islamabad at the long end. Deliberately a RANGE, not a single figure:
 * this MVP does not parse route.flightTime's free text into an exact
 * per-route duration (that text is written for human readers, not for
 * arithmetic, and its wording can change without notice). The engine uses
 * the upper bound when planning backwards from a deadline, so the
 * recommended departure window errs early rather than late.
 */
export const DIRECT_JOURNEY_DURATION_RANGE_HOURS = { min: 6.5, max: 10.5 } as const;

/**
 * A connecting journey via a Gulf or South Asian hub — one stop, boarding
 * to landing, excluding the connection buffer below (which is additional).
 * Wider than the direct range because a connecting itinerary's total air
 * time varies more by routing.
 */
export const CONNECTING_JOURNEY_DURATION_RANGE_HOURS = { min: 11, max: 18 } as const;

// ── Destination-side buffers ─────────────────────────────────────────────

/** Disembarkation, immigration where applicable, and moving through the arrival airport to the exit — before any baggage-specific time. Applies to every arrival regardless of baggage. */
export const DESTINATION_PROCESSING_BUFFER_MINUTES = 45;

/** Additional time for checked-baggage collection at the destination carousel, on top of DESTINATION_PROCESSING_BUFFER_MINUTES. Zero for hand-luggage-only, since there is nothing to collect. */
export const CHECKED_BAGGAGE_DESTINATION_BUFFER_MINUTES = 35;

// ── Schedule-risk buffer (protects the deadline itself) ──────────────────

/** A strict, must-not-miss deadline (e.g. a specific appointment time) gets a larger cushion against schedule risk — delay, late immigration queues, anything that could eat into the margin — than a flexible one. */
export const STRICT_DEADLINE_BUFFER_MINUTES = 60;

/** A flexible deadline (the traveller has some genuine slack) still gets a real buffer, just a smaller one. */
export const FLEXIBLE_DEADLINE_BUFFER_MINUTES = 20;

// ── Connection buffers (connecting journeys only) ────────────────────────

/** A sensible minimum planning allowance for a single connection — deliberately more generous than an airline's own minimum-connection-time, since this is a customer-facing planning cushion, not an operational MCT figure JetStash has no authority to state. */
export const STANDARD_CONNECTION_BUFFER_MINUTES = 90;

/** Additional protection for a traveller who has said they'd rather not risk a tight connection at all. Replaces STANDARD_CONNECTION_BUFFER_MINUTES rather than adding to it. */
export const CAUTIOUS_CONNECTION_BUFFER_MINUTES = 150;

/** Extra allowance on a connecting journey specifically for checked baggage — bags must be transferred airside, which hand luggage never risks. */
export const CHECKED_BAGGAGE_CONNECTION_BUFFER_MINUTES = 30;

/** A connecting journey at or beyond this total indicative duration (flight time + connection buffer) is long enough that the departure recommendation should carry an explicit overnight/previous-day warning, not just a time. */
export const OVERNIGHT_WARNING_THRESHOLD_HOURS = 15;

// ── UK origin-airport preparation ─────────────────────────────────────────

/** How long before the assumed departure a traveller with hand luggage only should reasonably plan to be at the UK airport — check-in (where needed), security, and reaching the gate. */
export const UK_AIRPORT_PREPARATION_HAND_LUGGAGE_MINUTES = 120;

/** The same allowance for checked baggage — bag drop adds real queuing time most hand-luggage-only journeys don't have. */
export const UK_AIRPORT_PREPARATION_CHECKED_BAGGAGE_MINUTES = 180;

// ── Departure-timing bucket ───────────────────────────────────────────────

/** A recommended UK-departure local time at or after this hour counts as "previous evening" rather than "previous day" when it falls a day before the deadline's UK-equivalent date. */
export const EVENING_DEPARTURE_THRESHOLD_HOUR = 17;

// ── Disclaimer ─────────────────────────────────────────────────────────

/** Present, verbatim, on every result Arrive By returns — see ARRIVE_BY_MVP.md §13. */
export const NON_LIVE_SCHEDULE_DISCLAIMER =
  'This is an indicative planning window, not a live schedule search. It does not confirm that a specific flight, seat, fare, or connection is available, and it does not guarantee arrival by your deadline. Check live schedules directly with the airline or a booking site before travelling.';

// ── Assumption descriptors (for a specific request) ──────────────────────

export function getDestinationBufferAssumptions(baggage: BaggageType): PlanningAssumption[] {
  const list: PlanningAssumption[] = [
    {
      name: 'Destination processing buffer',
      value: `${DESTINATION_PROCESSING_BUFFER_MINUTES} minutes`,
      rationale: 'Disembarkation, immigration where applicable, and reaching the terminal exit after landing.',
    },
  ];
  if (baggage === 'checked-baggage') {
    list.push({
      name: 'Checked-baggage destination buffer',
      value: `${CHECKED_BAGGAGE_DESTINATION_BUFFER_MINUTES} minutes`,
      rationale: 'Additional allowance for checked-baggage collection at the destination carousel.',
    });
  }
  return list;
}

export function getScheduleRiskAssumption(strictness: DeadlineStrictness): PlanningAssumption {
  return strictness === 'strict'
    ? {
        name: 'Strict-deadline schedule-risk buffer',
        value: `${STRICT_DEADLINE_BUFFER_MINUTES} minutes`,
        rationale: 'A larger protective margin before a must-not-miss deadline, to absorb ordinary schedule risk.',
      }
    : {
        name: 'Flexible-deadline schedule-risk buffer',
        value: `${FLEXIBLE_DEADLINE_BUFFER_MINUTES} minutes`,
        rationale: 'A smaller margin, since a flexible deadline already carries some genuine slack.',
      };
}

export function getConnectionAssumptions(baggage: BaggageType, preference: ConnectionRiskPreference): PlanningAssumption[] {
  const base: PlanningAssumption =
    preference === 'cautious'
      ? {
          name: 'Cautious connection buffer',
          value: `${CAUTIOUS_CONNECTION_BUFFER_MINUTES} minutes`,
          rationale: 'Extra protection for a traveller who prefers not to risk a tight connection.',
        }
      : {
          name: 'Standard connection buffer',
          value: `${STANDARD_CONNECTION_BUFFER_MINUTES} minutes`,
          rationale: 'A sensible minimum planning allowance for one connection — a customer-facing cushion, not an airline minimum-connection-time claim.',
        };
  const list = [base];
  if (baggage === 'checked-baggage') {
    list.push({
      name: 'Checked-baggage connection buffer',
      value: `${CHECKED_BAGGAGE_CONNECTION_BUFFER_MINUTES} minutes`,
      rationale: 'Additional allowance because checked bags must be transferred airside between flights.',
    });
  }
  return list;
}

export function getUkPreparationAssumption(baggage: BaggageType): PlanningAssumption {
  return baggage === 'checked-baggage'
    ? {
        name: 'UK airport preparation allowance (checked baggage)',
        value: `${UK_AIRPORT_PREPARATION_CHECKED_BAGGAGE_MINUTES} minutes`,
        rationale: 'Time to reach the UK departure airport, drop checked baggage, clear security, and reach the gate.',
      }
    : {
        name: 'UK airport preparation allowance (hand luggage only)',
        value: `${UK_AIRPORT_PREPARATION_HAND_LUGGAGE_MINUTES} minutes`,
        rationale: 'Time to reach the UK departure airport, clear security, and reach the gate.',
      };
}

export function getDurationAssumption(journeyType: 'direct' | 'connecting'): PlanningAssumption {
  return journeyType === 'direct'
    ? {
        name: 'Indicative direct journey duration',
        value: `${DIRECT_JOURNEY_DURATION_RANGE_HOURS.min}–${DIRECT_JOURNEY_DURATION_RANGE_HOURS.max} hours`,
        rationale: 'The typical range across JetStash’s direct network; the upper bound is used so the recommended departure errs early, not late.',
      }
    : {
        name: 'Indicative connecting journey duration',
        value: `${CONNECTING_JOURNEY_DURATION_RANGE_HOURS.min}–${CONNECTING_JOURNEY_DURATION_RANGE_HOURS.max} hours`,
        rationale: 'The typical range for a one-stop itinerary via a Gulf or South Asian hub, before the separate connection buffer; the upper bound is used for the same reason.',
      };
}
