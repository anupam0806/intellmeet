import React from "react";

interface IntellMeetGlyphProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function IntellMeetGlyph({ size = 26, className, style }: IntellMeetGlyphProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
      className={className}
      style={{ flexShrink: 0, ...style }}
    >
      <defs>
        <linearGradient id="glyphWarmGrad" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffb347" />
          <stop offset="0.5" stopColor="#ff6b4a" />
          <stop offset="1" stopColor="#ff2f3a" />
        </linearGradient>
      </defs>
      <rect width="28" height="28" rx="7" fill="url(#glyphWarmGrad)" />
      <path
        d="M8 14h2.5m2-5v10m4.5-7v4m3-2h2"
        stroke="#ffffff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
