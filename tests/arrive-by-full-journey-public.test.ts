import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/arrive-by/journey/route';
import { checkPublicJourneyRateLimit } from '@/lib/arrive-by-shared/rate-limit';

const body = {
  start: 'Preston', departureAirport: 'MAN', arrivalAirport: 'ISB', destination: 'Mirpur',
  flight: { departsLocal: '2027-01-15T11:00', arrivesLocal: '2027-01-15T23:30' },
  preferences: { departureAirportBufferMinutes: 120, arrivalExitMinutes: 60 },
};

const request = (ip = '198.51.100.200', input = body) => new NextRequest('http://localhost/api/arrive-by/journey', {
  method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify(input),
});

afterEach(() => vi.unstubAllEnvs());

describe('public full-journey launch surface', () => {
  it('fails closed in production without durable budget storage before a Google request', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('GOOGLE_ROUTES_API_KEY', 'test-key');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('has a five-per-minute public limiter and does not send raw client identity to the counter key', async () => {
    const env = { NODE_ENV: 'development' };
    const ip = '198.51.100.201';
    for (let count = 0; count < 5; count += 1) expect(await checkPublicJourneyRateLimit(request(ip), env)).toEqual({ limited: false });
    expect(await checkPublicJourneyRateLimit(request(ip), env)).toEqual({ limited: true });
    const source = readFileSync(join(process.cwd(), 'lib', 'arrive-by-shared', 'rate-limit.ts'), 'utf8');
    expect(source).toContain("createHash('sha256')");
    expect(source).toContain('ARRIVE_BY_RATE_LIMIT_MAX');
  });

  it('refuses an unreleased global road airport before making a Google request', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('GOOGLE_ROUTES_API_KEY', 'test-key');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const response = await POST(request('198.51.100.202', { ...body, arrivalAirport: 'DXB', destination: 'Atlantis The Royal' }));
    expect(response.status).toBe(200);
    const plan = await response.json();
    expect(plan).toMatchObject({ notEvidenced: { reason: 'AIRPORT_NOT_SUPPORTED' } });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('keeps secrets and internal diagnostics out of the public UI, while preserving the arrival-only query flow', () => {
    const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');
    const component = read('components', 'arrive-by-full-journey.tsx');
    const route = read('app', 'api', 'arrive-by', 'journey', 'route.ts');
    const shell = read('components', 'arrive-by-shell.tsx');
    expect(component).toContain('/api/arrive-by/journey');
    expect(component).not.toMatch(/ARRIVE_BY_INTERNAL_TOKEN|x-arrive-by-internal-token|Internal:.*Google calls/);
    expect(route).not.toMatch(/checkInternalAccess|INTERNAL_TOKEN_HEADER/);
    expect(shell).toContain('resolveShellDispatch(searchParams.get(\'airport\'), lookup)');
    expect(shell).toContain('ArriveByFullJourney');
  });
});
