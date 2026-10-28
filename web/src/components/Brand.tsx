import { Link } from "react-router-dom";

export function BrandMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="brand-mark">
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <path d="M19 7v11a5 5 0 1 1-10 0" fill="none" stroke="var(--on-accent)" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="19" cy="7" r="2.2" fill="var(--on-accent)" />
    </svg>
  );
}

export function Brand({ to = "/", suffix }: { to?: string; suffix?: string }) {
  return (
    <Link to={to} className="brand" aria-label="Spot the Hook — home">
      <BrandMark />
      <span className="brand-name">Spot the Hook</span>
      {suffix && <span className="brand-suffix">{suffix}</span>}
    </Link>
  );
}
