// Small inline icon set (stroke icons, 20px grid). Decorative unless a label is passed.

type P = { size?: number; label?: string };

function Svg({ size = 18, label, children }: P & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {children}
    </svg>
  );
}

export const IconCheck = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 10.5l3.5 3.5 7.5-8" />
  </Svg>
);
export const IconArrowRight = (p: P) => (
  <Svg {...p}>
    <path d="M4 10h12M11 5l5 5-5 5" />
  </Svg>
);
export const IconArrowLeft = (p: P) => (
  <Svg {...p}>
    <path d="M16 10H4M9 5l-5 5 5 5" />
  </Svg>
);
export const IconClock = (p: P) => (
  <Svg {...p}>
    <circle cx="10" cy="10" r="7" />
    <path d="M10 6v4l2.5 2" />
  </Svg>
);
export const IconShield = (p: P) => (
  <Svg {...p}>
    <path d="M10 2.5l6 2.5v4.5c0 3.8-2.6 6.6-6 8-3.4-1.4-6-4.2-6-8V5l6-2.5z" />
  </Svg>
);
export const IconEyeOff = (p: P) => (
  <Svg {...p}>
    <path d="M3 3l14 14M8.6 8.6a2 2 0 002.8 2.8M6.2 6.3C4.5 7.3 3.3 8.7 2.5 10c1.5 2.6 4.3 5 7.5 5 1.3 0 2.5-.4 3.6-1M10 5c3.2 0 6 2.4 7.5 5-.4.8-1 1.6-1.6 2.3" />
  </Svg>
);
export const IconUndo = (p: P) => (
  <Svg {...p}>
    <path d="M7 7H13a4 4 0 010 8H8" />
    <path d="M9.5 4.5L7 7l2.5 2.5" />
  </Svg>
);
export const IconKey = (p: P) => (
  <Svg {...p}>
    <circle cx="7" cy="12.5" r="3.5" />
    <path d="M9.5 10L16 3.5M13.5 6l2 2" />
  </Svg>
);
export const IconCopy = (p: P) => (
  <Svg {...p}>
    <rect x="7" y="7" width="10" height="10" rx="2" />
    <path d="M13 7V5a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2" />
  </Svg>
);
export const IconDownload = (p: P) => (
  <Svg {...p}>
    <path d="M10 3v10M5.5 8.5L10 13l4.5-4.5M4 16.5h12" />
  </Svg>
);
export const IconAlert = (p: P) => (
  <Svg {...p}>
    <path d="M10 3l7.5 13h-15L10 3z" />
    <path d="M10 8.5v3M10 14h.01" />
  </Svg>
);
export const IconInfo = (p: P) => (
  <Svg {...p}>
    <circle cx="10" cy="10" r="7" />
    <path d="M10 9v4.5M10 6.5h.01" />
  </Svg>
);
export const IconLock = (p: P) => (
  <Svg {...p}>
    <rect x="4" y="9" width="12" height="8" rx="2" />
    <path d="M7 9V6.5a3 3 0 016 0V9" />
  </Svg>
);
export const IconMail = (p: P) => (
  <Svg {...p}>
    <rect x="2.5" y="4.5" width="15" height="11" rx="2" />
    <path d="M3 5.5l7 5 7-5" />
  </Svg>
);
export const IconPhone = (p: P) => (
  <Svg {...p}>
    <rect x="5.5" y="2.5" width="9" height="15" rx="2" />
    <path d="M9 15h2" />
  </Svg>
);
