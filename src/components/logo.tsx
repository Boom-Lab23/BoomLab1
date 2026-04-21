"use client";

// BoomLab Logo — infinity symbol stylized
// Usage:
//   <BoomLabLogo />                   → default 40x40
//   <BoomLabLogo size={56} />         → custom size
//   <BoomLabLogo variant="white" />   → white on transparent (for dark backgrounds / coloured bg)
//   <BoomLabLogo variant="inline" />  → small inline logo (fits in text line)

type Variant = "default" | "white" | "inline";

export function BoomLabLogo({
  size = 40,
  variant = "default",
  className = "",
}: {
  size?: number;
  variant?: Variant;
  className?: string;
}) {
  const strokeColor = variant === "white" ? "#ffffff" : "#ffffff";
  const bgColor = variant === "white" ? "transparent" : "#2D76FC";
  const rx = variant === "inline" ? 0 : Math.round(size * 0.22);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={className}
      aria-label="BoomLab"
    >
      {variant !== "white" && (
        <rect width="512" height="512" rx={Math.round(rx * (512 / size))} fill={bgColor} />
      )}
      <g transform="translate(256, 256)">
        {variant !== "white" && (
          <circle r="160" fill="#ffffff" opacity="0.08" />
        )}
        <path
          d="M -115 0
             C -115 -55, -70 -85, -35 -55
             C -15 -35, 15 35, 35 55
             C 70 85, 115 55, 115 0
             C 115 -55, 70 -85, 35 -55
             C 15 -35, -15 35, -35 55
             C -70 85, -115 55, -115 0
             Z"
          fill="none"
          stroke={strokeColor}
          strokeWidth={variant === "inline" ? 36 : 32}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {variant !== "white" && (
          <circle cx="0" cy="0" r="7" fill="#0f1419" />
        )}
      </g>
    </svg>
  );
}
