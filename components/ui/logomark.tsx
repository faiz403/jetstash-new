/**
 * JetStash logomark — brass route-arc monogram. One source of truth so the
 * header, footer and any future surfaces render the identical mark.
 */
export function Logomark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="15" stroke="#C8932E" strokeWidth="1.4" />
      <path
        d="M9 19.5L16 8L23 19.5M11.5 16H20.5"
        stroke="#C8932E"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="23.5" r="1.6" fill="#C8932E" />
    </svg>
  );
}
