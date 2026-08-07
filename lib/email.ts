const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254; // RFC 5321 §4.5.3.1.3 practical mailbox-address limit.

export function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_EMAIL_LENGTH && EMAIL_PATTERN.test(value);
}

interface BrevoContactResult {
  ok: true;
}

interface BrevoContactError {
  ok: false;
  status: number;
  message: string;
}

/**
 * Upserts a contact into a Brevo list via the official Contacts API
 * (POST /v3/contacts with updateEnabled: true) — an existing contact is
 * updated and added to the list rather than failing. A 400 is only treated
 * as success when Brevo's error code says the contact already exists
 * (duplicate_parameter); any other 400 (bad list ID, malformed payload) is
 * a real failure and must surface, or the form would claim success while
 * saving nothing.
 */
export async function upsertBrevoContact({
  apiKey,
  listId,
  email,
  attributes,
}: {
  apiKey: string;
  listId: string;
  email: string;
  attributes?: Record<string, string>;
}): Promise<BrevoContactResult | BrevoContactError> {
  try {
    const res = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        listIds: [Number(listId)],
        updateEnabled: true,
        ...(attributes && Object.keys(attributes).length > 0 ? { attributes } : {}),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      let code: string | undefined;
      try {
        code = (JSON.parse(text) as { code?: string }).code;
      } catch {
        // Non-JSON error body — fall through to the failure path.
      }
      if (res.status === 400 && code === 'duplicate_parameter') {
        return { ok: true };
      }
      // Never log `text` — Brevo error bodies routinely echo the submitted
      // email or attribute values back (e.g. duplicate_parameter errors
      // name the contact's own address). Status code and, where present,
      // Brevo's own machine-readable error code are safe: neither is
      // submitted data.
      console.error('Brevo contact upsert failed: provider error', { op: 'upsert_contact', status: res.status, code });
      return { ok: false, status: 502, message: 'Could not complete sign-up. Please try again.' };
    }

    return { ok: true };
  } catch {
    // Never log the caught error object — a fetch failure's own message
    // frequently includes the request URL, which for this call never
    // contains PII (no email in the upsert URL), but the pattern is kept
    // identical to getBrevoContact below for consistency and to guard
    // against a future change to this URL reintroducing one.
    console.error('Brevo contact upsert failed: network error', { op: 'upsert_contact' });
    return { ok: false, status: 500, message: 'Could not complete sign-up. Please try again.' };
  }
}

/**
 * The result of a Brevo contact lookup, as a 3-state discriminated union.
 * `not_found` means Brevo gave a confirmed "this email has no contact"
 * answer (HTTP 404) — safe to treat as a genuinely new signup. `uncertain`
 * covers every case where that isn't actually known: a network failure, a
 * non-404 error status (auth failure, rate limit, malformed request, Brevo
 * outage), or a 200 response whose body doesn't parse or doesn't match the
 * expected shape. Collapsing `not_found` and `uncertain` into one falsy
 * value was the bug this type replaces — it made a transient Brevo problem
 * indistinguishable from "no existing contact", which let a caller
 * overwrite a real contact's existing data. Callers must handle all three
 * cases explicitly and must never treat `uncertain` as `not_found`.
 */
export type BrevoContactLookupResult =
  | { status: 'found'; attributes: Record<string, string> }
  | { status: 'not_found' }
  | { status: 'uncertain' };

/**
 * Reads a contact's current custom attributes by email — used by Route
 * Watch to merge a newly-watched route into WATCH_ROUTE's existing value
 * rather than overwriting it (JETSTASH_PRINCIPLES.md §14.2's multi-route
 * model). See BrevoContactLookupResult above for the three possible
 * outcomes — callers must fail closed on `uncertain` rather than treating
 * it as `not_found`.
 */
export async function getBrevoContact(apiKey: string, email: string): Promise<BrevoContactLookupResult> {
  try {
    const res = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
      headers: { 'api-key': apiKey, Accept: 'application/json' },
    });
    if (res.status === 404) return { status: 'not_found' };
    if (!res.ok) {
      // Auth failure, rate limit, malformed request, Brevo outage, etc. —
      // an unconfirmed result, not evidence the contact doesn't exist.
      // Status code only: never log the response body, which can echo the
      // looked-up email back (e.g. in a validation-error message).
      console.error('Brevo contact lookup failed: provider error', { op: 'get_contact', status: res.status });
      return { status: 'uncertain' };
    }
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      console.error('Brevo contact lookup failed: malformed response', { op: 'get_contact', status: res.status });
      return { status: 'uncertain' };
    }
    const attributes = (body as { attributes?: unknown } | null)?.attributes;
    if (attributes === undefined) {
      // A 200 with no `attributes` key at all is a legitimate shape for a
      // contact with no custom attributes set yet — not malformed.
      return { status: 'found', attributes: {} };
    }
    if (attributes === null || typeof attributes !== 'object' || Array.isArray(attributes)) {
      console.error('Brevo contact lookup failed: unexpected attributes shape', { op: 'get_contact', status: res.status });
      return { status: 'uncertain' };
    }
    return { status: 'found', attributes: attributes as Record<string, string> };
  } catch {
    // Never log the caught error object — a fetch failure's message can
    // include the request URL, which embeds the looked-up email.
    console.error('Brevo contact lookup failed: network error', { op: 'get_contact' });
    return { status: 'uncertain' };
  }
}

interface ResendEmailResult {
  ok: true;
}

interface ResendEmailError {
  ok: false;
  status: number;
  message: string;
}

/** Sends a transactional email via Resend, from the site's standard forms sender. */
export async function sendResendEmail({
  apiKey,
  to,
  subject,
  text,
  replyTo,
  failureMessage,
}: {
  apiKey: string;
  to: string;
  subject: string;
  text: string;
  replyTo: string;
  failureMessage: string;
}): Promise<ResendEmailResult | ResendEmailError> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'JetStash <forms@jetstash.co.uk>',
        to,
        subject,
        text,
        reply_to: replyTo,
      }),
    });

    if (!res.ok) {
      // Never log the response body — Resend error bodies can echo the
      // `to`/`reply_to` address or message content back. Status code only.
      console.error('Resend send failed: provider error', { op: 'send_email', status: res.status });
      return { ok: false, status: 502, message: failureMessage };
    }

    return { ok: true };
  } catch {
    // Never log the caught error object — message text can include the
    // request payload or a submitted address.
    console.error('Resend send failed: network error', { op: 'send_email' });
    return { ok: false, status: 500, message: failureMessage };
  }
}
