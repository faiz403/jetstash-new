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
 * Upserts a contact into a Brevo list. A 400 from Brevo usually means "contact
 * already exists" and is treated as success, matching Brevo's own semantics.
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

    if (!res.ok && res.status !== 400) {
      const text = await res.text();
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
