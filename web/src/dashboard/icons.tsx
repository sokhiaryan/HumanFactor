// Dashboard-only glyphs not in the shared set (../components/icons.tsx), drawn to the same
// spec: 24 grid, 1.75 stroke, square caps, mitred joins, currentColor.

type P = { size?: number };

function Svg({ size = 14, children }: P & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const IconChevronDown = (p: P) => (
  <Svg {...p}>
    <path d="M6 9.5l6 6 6-6" />
  </Svg>
);
export const IconTrendUp = (p: P) => (
  <Svg {...p}>
    <path d="M12 19.5V5M6.5 10.5L12 5l5.5 5.5" />
  </Svg>
);
export const IconTrendDown = (p: P) => (
  <Svg {...p}>
    <path d="M12 4.5V19M6.5 13.5L12 19l5.5-5.5" />
  </Svg>
);
export const IconTrendFlat = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 12H19M13.5 6.5L19 12l-5.5 5.5" />
  </Svg>
);
