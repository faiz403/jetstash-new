import { describe, expect, it, vi } from 'vitest';
import {
  INDEXNOW_HOST,
  INDEXNOW_ENDPOINT,
  INDEXNOW_KEY,
  INDEXNOW_MAX_BATCH_SIZE,
  buildIndexNowPayload,
  normalizeIndexNowUrl,
  submitIndexNow,
} from '@/lib/indexnow';
import { siteConfig } from '@/lib/site-config';

const BHX_ATQ = 'https://jetstash.co.uk/routes/birmingham-amritsar';

describe('IndexNow public production allowlist', () => {
  it('is locked to JetStash\'s canonical production origin', () => {
    expect(INDEXNOW_HOST).toBe(siteConfig.domain);
  });

  it('accepts a canonical public production URL', () => {
    expect(normalizeIndexNowUrl(BHX_ATQ)).toBe(BHX_ATQ);
  });

  it('deduplicates canonical URLs before building a bounded payload', () => {
    const payload = buildIndexNowPayload([BHX_ATQ, BHX_ATQ, 'https://jetstash.co.uk/guides']);
    expect(payload).toEqual({
      host: 'jetstash.co.uk',
      key: INDEXNOW_KEY,
      keyLocation: `https://jetstash.co.uk/${INDEXNOW_KEY}.txt`,
      urlList: [BHX_ATQ, 'https://jetstash.co.uk/guides'],
    });
  });

  it.each([
    'https://example.com/routes/birmingham-amritsar',
    'http://jetstash.co.uk/routes/birmingham-amritsar',
    'http://localhost:3000/routes/birmingham-amritsar',
    'https://jetstash-new-git-feat-seo-indexnow-jet-stash.vercel.app/routes/birmingham-amritsar',
    'https://jetstash.co.uk/founder/arrive-by',
    'https://jetstash.co.uk/arrive-by',
    'https://jetstash.co.uk/api/contact',
    'https://jetstash.co.uk/routes/birmingham-amritsar?preview=true',
    'not a URL',
  ])('rejects non-public or malformed input: %s', (url) => {
    expect(() => normalizeIndexNowUrl(url)).toThrow();
  });

  it('rejects batches over the deliberately conservative limit', () => {
    expect(() => buildIndexNowPayload(Array.from({ length: INDEXNOW_MAX_BATCH_SIZE + 1 }, (_, i) => `https://jetstash.co.uk/routes/example-${i}`))).toThrow(/at most/);
  });
});

describe('IndexNow server-side submission', () => {
  it('posts the exact bounded payload to the protocol endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '' });
    await expect(submitIndexNow([BHX_ATQ], fetchMock)).resolves.toEqual({ ok: true, status: 200, submitted: 1 });
    expect(fetchMock).toHaveBeenCalledWith(INDEXNOW_ENDPOINT, expect.objectContaining({
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(buildIndexNowPayload([BHX_ATQ])),
    }));
  });

  it('handles an IndexNow network failure without throwing', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
    await expect(submitIndexNow([BHX_ATQ], fetchMock)).resolves.toEqual({ ok: false, reason: 'network-error', detail: 'offline' });
  });
});
