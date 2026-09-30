/**
 * IndexNow ownership is proven by a public text file, so this value is a
 * verification token rather than a secret. It must match the root-level
 * public/<key>.txt file exactly. Keep it separate from all provider keys.
 */
export const INDEXNOW_KEY = '8f6ea9be8c184887a6c876c85d1925d4';
export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
export const INDEXNOW_MAX_BATCH_SIZE = 100;
// Kept dependency-free so the Node CLI can execute this module without a
// bundler. tests/indexnow.test.ts locks these values to siteConfig.
export const INDEXNOW_HOST = 'jetstash.co.uk';
export const INDEXNOW_ORIGIN = `https://${INDEXNOW_HOST}`;

const PUBLIC_STATIC_PATHS = new Set([
  '/',
  '/about',
  '/affiliate-disclosure',
  '/airports',
  '/business-class',
  '/contact',
  '/deals',
  '/destinations',
  '/family-holidays',
  '/gulf',
  '/guides',
  '/india',
  '/pakistan',
  '/privacy-policy',
  '/quote-request',
  '/routes',
  '/tracked-fares',
  '/travel-club',
  '/travel-ready-check',
  '/umrah',
]);

const PUBLIC_DYNAMIC_PATHS = [
  /^\/routes\/[a-z0-9]+(?:-[a-z0-9]+)*$/,
  /^\/airports\/[a-z0-9]+(?:-[a-z0-9]+)*$/,
  /^\/destinations\/[a-z0-9]+(?:-[a-z0-9]+)*$/,
  /^\/guides\/[a-z0-9]+(?:-[a-z0-9]+)*$/,
];

const BLOCKED_PREFIXES = ['/api', '/arrive-by', '/founder', '/_next'];

export type IndexNowPayload = {
  host: typeof INDEXNOW_HOST;
  key: typeof INDEXNOW_KEY;
  keyLocation: string;
  urlList: string[];
};

export type IndexNowSubmissionResult =
  | { ok: true; status: number; submitted: number }
  | { ok: false; reason: 'http-error' | 'network-error'; status?: number; detail: string };

export type FetchLike = (input: string, init: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'text'>>;

function isPublicPath(pathname: string): boolean {
  return PUBLIC_STATIC_PATHS.has(pathname) || PUBLIC_DYNAMIC_PATHS.some((pattern) => pattern.test(pathname));
}

/**
 * Accept only canonical, production, customer-facing URLs. This is an
 * allowlist: a future internal namespace remains rejected until it is
 * deliberately added as public, instead of being submitted by accident.
 */
export function normalizeIndexNowUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid URL: ${value}`);
  }

  if (url.protocol !== 'https:' || url.hostname !== INDEXNOW_HOST || url.port || url.username || url.password) {
    throw new Error(`Only canonical ${INDEXNOW_ORIGIN} URLs may be submitted: ${value}`);
  }
  if (url.search || url.hash) {
    throw new Error(`IndexNow URLs must be canonical and cannot include a query or fragment: ${value}`);
  }
  if (url.pathname !== '/' && url.pathname.endsWith('/')) {
    throw new Error(`IndexNow URLs must not have a trailing slash: ${value}`);
  }
  if (BLOCKED_PREFIXES.some((prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)) || !isPublicPath(url.pathname)) {
    throw new Error(`URL is not an indexable public JetStash page: ${value}`);
  }
  return url.toString();
}

export function buildIndexNowPayload(values: string[]): IndexNowPayload {
  const urlList = [...new Set(values.map(normalizeIndexNowUrl))];
  if (urlList.length === 0) throw new Error('Provide at least one public production URL.');
  if (urlList.length > INDEXNOW_MAX_BATCH_SIZE) {
    throw new Error(`This workflow accepts at most ${INDEXNOW_MAX_BATCH_SIZE} URLs per submission.`);
  }

  return {
    host: INDEXNOW_HOST,
    key: INDEXNOW_KEY,
    keyLocation: `${INDEXNOW_ORIGIN}/${INDEXNOW_KEY}.txt`,
    urlList,
  };
}

export async function submitIndexNow(
  values: string[],
  fetchImpl: FetchLike = fetch,
): Promise<IndexNowSubmissionResult> {
  const payload = buildIndexNowPayload(values);
  try {
    const response = await fetchImpl(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    });
    if (response.ok) return { ok: true, status: response.status, submitted: payload.urlList.length };

    const detail = (await response.text()).slice(0, 300);
    return { ok: false, reason: 'http-error', status: response.status, detail };
  } catch (error) {
    return {
      ok: false,
      reason: 'network-error',
      detail: error instanceof Error ? error.message : 'Unknown network error',
    };
  }
}
