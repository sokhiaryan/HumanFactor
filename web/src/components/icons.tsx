// HumanFactor icon set: drawn on a 24-unit grid with a 1.75 stroke, square caps and
// mitred joins, so the icons share the drafting line of the Vitruvian mark.
// Decorative unless a label is passed.

type P = { size?: number; label?: string };

function Svg({ size = 18, label, children }: P & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="square"
      strokeLinejoin="miter"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {children}
    </svg>
  );
}

const Dot = ({ cx, cy }: { cx: number; cy: number }) => <circle cx={cx} cy={cy} r="1.1" fill="currentColor" stroke="none" />;

export const IconCheck = (p: P) => (
  <Svg {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);
export const IconArrowRight = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 12H18.5M13 6.5l5.5 5.5-5.5 5.5" />
  </Svg>
);
export const IconArrowLeft = (p: P) => (
  <Svg {...p}>
    <path d="M19.5 12H5.5M11 6.5L5.5 12l5.5 5.5" />
  </Svg>
);
export const IconClock = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);
export const IconShield = (p: P) => (
  <Svg {...p}>
    <path d="M12 3l7.5 3v5.5c0 4.4-3.2 8-7.5 9.5-4.3-1.5-7.5-5.1-7.5-9.5V6z" />
  </Svg>
);
export const IconEyeOff = (p: P) => (
  <Svg {...p}>
    <path d="M4 4l16 16" />
    <path d="M9.5 6c.8-.3 1.6-.5 2.5-.5 4.2 0 7.4 3 9 6.5-.6 1.3-1.4 2.5-2.4 3.5M15.5 17.4c-1.1.6-2.3 1.1-3.5 1.1-4.2 0-7.4-3-9-6.5.8-1.8 2-3.4 3.6-4.6" />
    <path d="M10 10a2.8 2.8 0 004 4" />
  </Svg>
);
export const IconUndo = (p: P) => (
  <Svg {...p}>
    <path d="M8.5 13.5L4 9l4.5-4.5" />
    <path d="M4.5 9H14a5.5 5.5 0 010 11h-3.5" />
  </Svg>
);
export const IconKey = (p: P) => (
  <Svg {...p}>
    <circle cx="8" cy="15.5" r="4" />
    <path d="M11 12.5L19.5 4M16.5 7l2.5 2.5M14 9.5l2 2" />
  </Svg>
);
export const IconCopy = (p: P) => (
  <Svg {...p}>
    <rect x="8.5" y="8.5" width="11.5" height="11.5" />
    <path d="M15.5 8.5V4H4v11.5h4.5" />
  </Svg>
);
export const IconDownload = (p: P) => (
  <Svg {...p}>
    <path d="M12 4v10.5M7.5 10l4.5 4.5 4.5-4.5M4.5 20h15" />
  </Svg>
);
export const IconAlert = (p: P) => (
  <Svg {...p}>
    <path d="M12 3.5L21 19.5H3z" />
    <path d="M12 9.5v4.5" />
    <Dot cx={12} cy={16.9} />
  </Svg>
);
export const IconInfo = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5.5" />
    <Dot cx={12} cy={7.9} />
  </Svg>
);
export const IconLock = (p: P) => (
  <Svg {...p}>
    <rect x="5" y="10.5" width="14" height="10" />
    <path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5" />
  </Svg>
);
export const IconMail = (p: P) => (
  <Svg {...p}>
    <rect x="3.5" y="5.5" width="17" height="13" />
    <path d="M4 6.5l8 6.5 8-6.5" />
  </Svg>
);
export const IconPhone = (p: P) => (
  <Svg {...p}>
    <rect x="7" y="2.5" width="10" height="19" />
    <path d="M11 18.5h2" />
  </Svg>
);
export const IconRefresh = (p: P) => (
  <Svg {...p}>
    <path d="M19.5 12a7.5 7.5 0 11-2.2-5.3" />
    <path d="M19.5 4v4.5H15" />
  </Svg>
);
export const IconPrint = (p: P) => (
  <Svg {...p}>
    <path d="M7 9V3.5h10V9" />
    <rect x="3.5" y="9" width="17" height="7.5" />
    <path d="M7 13.5h10v7H7z" />
  </Svg>
);
export const IconLogout = (p: P) => (
  <Svg {...p}>
    <path d="M14 4h5.5v16H14" />
    <path d="M9.5 8L5.5 12l4 4M5.5 12H15.5" />
  </Svg>
);
export const IconChart = (p: P) => (
  <Svg {...p}>
    <path d="M4 20h16M7.5 16.5V11M12 16.5V6M16.5 16.5V9" />
  </Svg>
);
export const IconUsers = (p: P) => (
  <Svg {...p}>
    <circle cx="9" cy="8.5" r="3.5" />
    <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
    <path d="M15.5 5.3a3.5 3.5 0 010 6.4M17.5 14.6c2 .8 3.5 2.7 3.5 5.4" />
  </Svg>
);
export const IconTrash = (p: P) => (
  <Svg {...p}>
    <path d="M4 6.5h16M9 6.5V3.5h6v3M6 6.5l1 14h10l1-14M10 10.5v6M14 10.5v6" />
  </Svg>
);
export const IconChevronDown = (p: P) => (
  <Svg {...p}>
    <path d="M6 9.5l6 6 6-6" />
  </Svg>
);
