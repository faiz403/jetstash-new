import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Accepting Google Ads measurement while DECLINING site statistics must still let the intended Google conversion fire (October 2026).
 * Uses the real track(), consent helpers and conversion module with a fake browser and a gtag spy: a local simulation, so no real
 * advertising conversion is sent anywhere.
 */
function browser(local: Record<string, string>, withGtag = true) {
  const data = { ...local };
  const gtag = vi.fn();
  vi.stubGlobal('window', {
    localStorage: { getItem: (k: string) => (k in data ? data[k] : null), setItem: () => undefined, removeItem: () => undefined },
    sessionStorage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined },
    dispatchEvent: () => true,
    ...(withGtag ? { gtag } : {}),
  });
  return gtag;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.doUnmock('@vercel/analytics');
  vi.resetModules();
});

async function loadTrack() {
  vi.resetModules();
  const vercelTrack = vi.fn();
  vi.doMock('@vercel/analytics', () => ({ track: vercelTrack }));
  const { track } = await import('@/lib/analytics');
  return { track, vercelTrack };
}

describe('Google Ads conversion is independent of the Site statistics choice', () => {
  it('measurement accepted + statistics declined: the conversion fires, nothing goes to Vercel', async () => {
    const gtag = browser({ 'jetstash-ad-consent': 'granted', 'jetstash-stats-consent': 'denied' });
    const { track, vercelTrack } = await loadTrack();
    track('tripcom_click', { route: 'manchester-lahore', source: 'route-hero' });
    expect(gtag).toHaveBeenCalledWith('event', 'conversion', expect.objectContaining({ send_to: expect.stringMatching(/^AW-18378433991\//) }));
    expect(vercelTrack).not.toHaveBeenCalled();
  });

  it('measurement accepted + statistics undecided: the conversion fires, nothing goes to Vercel', async () => {
    const gtag = browser({ 'jetstash-ad-consent': 'granted' });
    const { track, vercelTrack } = await loadTrack();
    track('tripcom_hotel_click', { route: 'x' });
    expect(gtag).toHaveBeenCalledTimes(1);
    expect(vercelTrack).not.toHaveBeenCalled();
  });

  it('measurement declined: the Google tag was never loaded, so no gtag exists and nothing fires', async () => {
    const gtag = browser({ 'jetstash-ad-consent': 'denied', 'jetstash-stats-consent': 'granted' }, false);
    const { track, vercelTrack } = await loadTrack();
    expect(() => track('tripcom_click', { route: 'x' })).not.toThrow();
    expect(gtag).not.toHaveBeenCalled();
    expect(vercelTrack).toHaveBeenCalled(); // statistics allowed: the ordinary event still goes to Vercel
  });

  it('no attribution handoff without BOTH permissions: ads-only sends no acquisition_handoff anywhere', async () => {
    const gtag = browser({ 'jetstash-ad-consent': 'granted' });
    const { track, vercelTrack } = await loadTrack();
    track('tripcom_click', { route: 'x' });
    expect(vercelTrack.mock.calls.some((c) => c[0] === 'acquisition_handoff')).toBe(false);
    expect(gtag).toHaveBeenCalledTimes(1);
  });
});
