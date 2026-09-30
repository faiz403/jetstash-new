/**
 * The RELEASE gate: "have we chosen to expose this airport publicly?"
 *
 * Deliberately separate from the CAPABILITY gate (airport-capability.ts:
 * "can Arrive By safely calculate a journey from this airport?"). A
 * successful live capability probe is evidence, not a launch: it lets us
 * store proof for LHR, DXB, DEL ... while they stay internal-only, and a
 * public rollout is a later, explicit decision made airport by airport.
 *
 *   internal_only  Default. Capability may be proven and stored, but the public
 *                  shell and API refuse the airport.
 *   public_beta    Exposed to users as a beta (still noindex).
 *   public         Exposed to users.
 *
 * A generic (catalogue-derived) airport is publicly usable only when it is
 * BOTH `road_supported` AND released `public_beta`/`public`. The four explicit
 * profiles (MAN, ISB, LHE, KHI) carry their own public state in the override
 * registry and are unaffected by this table. A `temporarily_unsupported`
 * kill switch beats any release status.
 *
 * ARRIVE_BY_RELEASED_AIRPORTS is empty on purpose. Adding an entry is the
 * Phase D public-rollout decision, not something a probe can do.
 */

export type GenericAirportReleaseStatus = 'internal_only' | 'public_beta' | 'public';

export interface ReleaseEntry {
  status: 'public_beta' | 'public';
  /** ISO date the release was decided. */
  decidedDate: string;
  /** Who/what approved it -- never blank, so a release is never an unexplained flag. */
  approvedNote: string;
}

/** Keyed by IATA. Absent = internal_only. */
export const ARRIVE_BY_RELEASED_AIRPORTS: Readonly<Record<string, ReleaseEntry>> = {};

export function getGenericAirportRelease(
  code: string,
  table: Readonly<Record<string, ReleaseEntry>> = ARRIVE_BY_RELEASED_AIRPORTS,
): GenericAirportReleaseStatus {
  return table[code]?.status ?? 'internal_only';
}

export function isPubliclyReleased(status: GenericAirportReleaseStatus): boolean {
  return status === 'public_beta' || status === 'public';
}

export function assertValidReleaseEntry(code: string, entry: ReleaseEntry): void {
  if (!/^[A-Z]{3}$/.test(code)) throw new Error(`Release entry ${code}: not an IATA code.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.decidedDate)) throw new Error(`Release entry ${code}: decidedDate must be YYYY-MM-DD.`);
  if (!entry.approvedNote.trim()) throw new Error(`Release entry ${code}: an approval note is required.`);
}

for (const [code, entry] of Object.entries(ARRIVE_BY_RELEASED_AIRPORTS)) assertValidReleaseEntry(code, entry);

/**
 * Local-development-only switch so the generic road UI can be exercised
 * against internal-only airports without releasing them. Honoured ONLY when
 * NODE_ENV is 'development' (`next dev`): a production build, a production
 * server and the test runner never see it as true, so it cannot expose an
 * airport to real users.
 */
export function isInternalQaReleaseEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV === 'development' && env.ARRIVE_BY_INTERNAL_QA === '1';
}
