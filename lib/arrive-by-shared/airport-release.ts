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
 * Adding an entry is the Phase D public-rollout decision, made airport by
 * airport, never something a probe can do. Each release is bound to an
 * evidence review date: once that date passes without a fresh probe and an
 * updated entry, the airport falls back to internal_only (fail closed).
 */

export type GenericAirportReleaseStatus = 'internal_only' | 'public_beta' | 'public';

export interface ReleaseEntry {
  status: 'public_beta' | 'public';
  /** ISO date the release was decided. */
  decidedDate: string;
  /** Who/what approved it -- never blank, so a release is never an unexplained flag. */
  approvedNote: string;
  /** Last day (inclusive, UTC) the release stands on its recorded capability evidence. After it, the airport is internal_only again. */
  evidenceReviewDueDate: string;
}

/** Keyed by IATA. Absent = internal_only. */
export const ARRIVE_BY_RELEASED_AIRPORTS: Readonly<Record<string, ReleaseEntry>> = {
  // Doha-only public beta first (founder direction, 21 October 2026). Capability evidence: Phase C
  // live probe 30 September 2026 (identity 0.72 km from the catalogue point; DRIVE to Al Khor
  // confirmed). Road-only, airport-level estimates; same-country destinations only. Review 90 days
  // after the probe.
  DOH: {
    status: 'public_beta',
    decidedDate: '2026-10-21',
    approvedNote: 'Founder direction 21 Oct 2026: Doha-only Arrive By public beta first, before the other evidenced airports; takes effect only with a separately approved Production release.',
    evidenceReviewDueDate: '2026-12-29',
  },
};

const todayUtc = () => new Date().toISOString().slice(0, 10);

export function getGenericAirportRelease(
  code: string,
  table: Readonly<Record<string, ReleaseEntry>> = ARRIVE_BY_RELEASED_AIRPORTS,
  nowIso: string = todayUtc(),
): GenericAirportReleaseStatus {
  const entry = table[code];
  if (!entry || nowIso.slice(0, 10) > entry.evidenceReviewDueDate) return 'internal_only';
  return entry.status;
}

export function isPubliclyReleased(status: GenericAirportReleaseStatus): boolean {
  return status === 'public_beta' || status === 'public';
}

export function assertValidReleaseEntry(code: string, entry: ReleaseEntry): void {
  if (!/^[A-Z]{3}$/.test(code)) throw new Error(`Release entry ${code}: not an IATA code.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.decidedDate)) throw new Error(`Release entry ${code}: decidedDate must be YYYY-MM-DD.`);
  if (!entry.approvedNote.trim()) throw new Error(`Release entry ${code}: an approval note is required.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.evidenceReviewDueDate)) throw new Error(`Release entry ${code}: evidenceReviewDueDate must be YYYY-MM-DD.`);
  if (entry.evidenceReviewDueDate <= entry.decidedDate) throw new Error(`Release entry ${code}: evidenceReviewDueDate must be after decidedDate.`);
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
