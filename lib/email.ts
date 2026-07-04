const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && EMAIL_PATTERN.test(value);
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
      console.error('Brevo error:', res.status, text);
      return { ok: false, status: 502, message: 'Could not complete sign-up. Please try again.' };
    }

    return { ok: true };
  } catch (err) {
    console.error('Brevo contact upsert failed:', err);
    return { ok: false, status: 500, message: 'Could not complete sign-up. Please try again.' };
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
      const text = await res.text();
      console.error('Resend error:', res.status, text);
      return { ok: false, status: 502, message: failureMessage };
    }

    return { ok: true };
  } catch (err) {
    console.error('Resend send failed:', err);
    return { ok: false, status: 500, message: failureMessage };
  }
}
