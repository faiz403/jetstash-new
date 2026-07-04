import { ImageResponse } from 'next/og';
import { getRouteBySlug, getRouteAirport, getRouteDestination } from '@/data/routes';

// @vercel/og's Node runtime fails to resolve its bundled font on some
// platforms (ERR_INVALID_URL); the edge runtime is its supported home.
export const runtime = 'edge';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export const alt = 'JetStash route guide';

// Brand palette (mirrors tailwind.config.js — ImageResponse can't read Tailwind).
const INK = '#0B0E14';
const INK_LIGHT = '#9CA3B0';
const BRASS = '#C8932E';
const SAND = '#F7F2E9';

export default function OgImage({ params }: { params: { slug: string } }) {
  const route = getRouteBySlug(params.slug);
  const airport = route ? getRouteAirport(route) : undefined;
  const dest = route ? getRouteDestination(route) : undefined;

  const from = airport?.city ?? 'UK';
  const to = dest?.city ?? 'the world';
  // flightTime and frequency strings already say direct/connecting — don't repeat it.
  const detail = route ? `${route.flightTime} · ${route.frequency}` : '';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: INK,
          backgroundImage: `radial-gradient(ellipse at top right, rgba(200,147,46,0.22), transparent 60%)`,
          padding: 72,
          fontFamily: 'Georgia, serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              border: `2px solid ${BRASS}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: BRASS,
              fontSize: 26,
            }}
          >
            ✈
          </div>
          <div style={{ display: 'flex', color: SAND, fontSize: 36 }}>JetStash</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', color: BRASS, fontSize: 28, textTransform: 'uppercase', letterSpacing: 4 }}>
            Route guide
          </div>
          <div style={{ display: 'flex', color: SAND, fontSize: 84, marginTop: 12, lineHeight: 1.05 }}>
            {from} → {to}
          </div>
          {detail ? (
            <div style={{ display: 'flex', color: INK_LIGHT, fontSize: 32, marginTop: 20 }}>{detail}</div>
          ) : null}
        </div>

        <div style={{ display: 'flex', color: INK_LIGHT, fontSize: 24 }}>
          Booking windows · Peak periods · Fare history — jetstash.co.uk
        </div>
      </div>
    ),
    size
  );
}
