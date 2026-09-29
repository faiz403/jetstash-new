import { redirect } from 'next/navigation';

/**
 * Legacy Pakistan Arrive By beta route — superseded by the canonical
 * /arrive-by shell (Phase 4). Redirects to the unified selector rather
 * than guessing a single Pakistan airport: the old surface supported
 * ISB/LHE/KHI, so a visitor lands on the shell and picks their own.
 */

export const dynamic = 'force-dynamic';

export default function ArriveByPakistanLegacyRedirect() {
  redirect('/arrive-by');
}
