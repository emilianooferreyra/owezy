/**
 * Owezy's mark: the ledger ("libreta") mascot seen from the front, drawn as vectors so it stays
 * sharp from a 16px favicon to a big logo. Plain SVG with fixed colors, so the same markup also
 * renders inside next/og's ImageResponse (the generated favicon and app icons).
 */
export const MARK_COLORS = { cover: "#4f6e23", ink: "#1d2a10", accent: "#eef25a" } as const;

export function OwezyMark({ size = 32, title }: { size?: number; title?: string }) {
  const { cover, ink, accent } = MARK_COLORS;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      data-owezy-mark=""
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      {/* Cover: nearly square, as in the approved artwork */}
      <rect x="6.3" y="2" width="55.4" height="59.4" rx="9" fill={cover} stroke={ink} strokeWidth="4.2" />
      {/* Spine */}
      <path d="M16.6 3.5 V60" stroke={ink} strokeWidth="2.5" />
      {/* Rings, drawn over the cover's left edge */}
      {[14.9, 26, 37.4, 48.2].map((y) => (
        <rect key={y} x="1.6" y={y - 2.85} width="11.2" height="5.7" rx="2.85" fill={accent} stroke={ink} strokeWidth="3" />
      ))}
      {/* Face */}
      <circle cx="28" cy="25.1" r="3.7" fill={accent} />
      <circle cx="49.5" cy="25.1" r="3.7" fill={accent} />
      <path d="M35.2 28.8 Q39.1 34.5 43.1 28.8" fill="none" stroke={accent} strokeWidth="2.6" strokeLinecap="round" />
      {/* Paid */}
      <path
        d="M39.2 44.2 L44.5 51.2 L54 40.5"
        fill="none"
        stroke={accent}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
