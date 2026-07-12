import attributeList from './brevo-attributes.json';

/**
 * Single source of truth for every custom Brevo contact attribute this app
 * writes — backed by JSON (not a .ts array) specifically so
 * scripts/setup-brevo-attributes.mjs, a plain Node script, can read the
 * exact same list without duplicating it.
 *
 * Two consumers read this list so they can never drift apart the way they
 * did in practice (all seven were missing from the connected Brevo account
 * despite matching README/code documentation exactly):
 *   - app/api/subscribe/route.ts and app/api/route-watch/route.ts use
 *     BREVO_ATTRIBUTE_NAMES as the object keys when building the
 *     `attributes` payload sent to Brevo's contacts API.
 *   - scripts/setup-brevo-attributes.mjs creates any of these that don't
 *     yet exist in the connected Brevo account, via Brevo's
 *     `POST /v3/contacts/attributes/{category}/{name}` endpoint.
 *
 * Brevo requires a contact attribute to be predefined before it will save
 * a value for it — sending a key it doesn't recognise doesn't error, it's
 * silently dropped (see lib/email.ts's upsertBrevoContact). That silence is
 * exactly what let this list go out of sync with the real account without
 * any form ever failing: signups kept succeeding while every preference
 * field was quietly discarded. Run `npm run brevo:setup` after adding a
 * new attribute here, or after connecting a fresh Brevo account.
 */

export interface BrevoAttributeDef {
  name: string;
  type: 'text';
  usedBy: string;
  description: string;
}

export const BREVO_ATTRIBUTE_LIST: BrevoAttributeDef[] = attributeList as BrevoAttributeDef[];

/** e.g. BREVO_ATTRIBUTE_NAMES.NEAREST_AIRPORT — always derived from brevo-attributes.json, never hand-typed at a call site. */
export const BREVO_ATTRIBUTE_NAMES: Record<string, string> = Object.fromEntries(
  BREVO_ATTRIBUTE_LIST.map((a) => [a.name, a.name])
);
