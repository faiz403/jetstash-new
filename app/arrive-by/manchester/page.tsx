import { redirect } from 'next/navigation';

/**
 * Legacy Manchester Arrive By beta route — superseded by the canonical
 * /arrive-by shell (Phase 4). Redirects rather than 404s so any link
 * already shared during the earlier beta keeps working, landing the
 * visitor on the same MAN journey flow via the unified shell.
 */

export const dynamic = 'force-dynamic';

export default function ArriveByManchesterLegacyRedirect() {
  redirect('/arrive-by?airport=MAN');
}
