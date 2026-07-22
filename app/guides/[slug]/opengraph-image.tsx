import { ImageResponse } from 'next/og';
import { getGuideBySlug } from '@/data/guides';

// Same rationale as the route/destination OG images: @vercel/og's Node
// runtime fails to resolve its bundled font on some platforms
// (ERR_INVALID_URL); the edge runtime is its supported home.
export const runtime = 'edge';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export const alt = 'JetStash travel guide';

// Brand palette (mirrors tailwind.config.js — ImageResponse can't read Tailwind).
const INK = '#0B0E14';
const INK_LIGHT = '#9CA3B0';
const BRASS = '#C8932E';
const SAND = '#F7F2E9';

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);

  const title = guide?.title ?? 'Travel guides';

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
            Travel guide
          </div>
          <div style={{ display: 'flex', color: SAND, fontSize: 60, marginTop: 16, lineHeight: 1.12 }}>
            {title}
          </div>
        </div>

        <div style={{ display: 'flex', color: INK_LIGHT, fontSize: 24 }}>
          Practical, verifiable, no invented urgency · jetstash.co.uk
        </div>
      </div>
    ),
    size
  );
}
