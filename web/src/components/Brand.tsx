import { Link } from "react-router-dom";

/*
 * The HumanFactor mark: a Vitruvian figure, drawn to Leonardo's construction.
 * The circle is centred on the navel and touches the base of the square; the
 * figure shows both arm and both leg positions. 64-unit grid, stroked in
 * currentColor so it inherits the ink of wherever it sits.
 */
const FIGURE = [
  "M32 21V39", // torso
  "M10 26H54", // arms level, touching the square
  "M32 25L13.4 15.2M32 25L50.6 15.2", // arms raised, touching the circle
  "M32 39L28.4 56M32 39L35.6 56", // legs together
  "M32 39L17 51M32 39L47 51", // legs apart, touching the circle
];

/** At mark sizes the figure keeps one leg pose so it stays legible. */
const MARK_FIGURE = FIGURE.filter((d) => !d.startsWith("M32 39L28.4"));

export function BrandMark({ size = 30, title }: { size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.6"
      strokeLinecap="round"
      className="brand-mark"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <rect x="10" y="12" width="44" height="44" />
      <circle cx="32" cy="31" r="25" />
      <circle cx="32" cy="16.6" r="4.2" />
      {MARK_FIGURE.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/** The large construction drawing used on the poster plate. */
export function VitruvianDrawing() {
  const ticks = Array.from({ length: 9 }, (_, i) => 10 + i * 5.5);
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeLinecap="round" aria-hidden="true">
      {/* construction lines */}
      <g strokeWidth="0.35" strokeDasharray="0.9 1.4" opacity="0.7">
        <path d="M32 3V61M3 31H61M10 12L54 56M54 12L10 56" />
      </g>
      {/* measuring ticks along the square, as in the notebook */}
      <g strokeWidth="0.45">
        {ticks.map((t) => (
          <path key={`b${t}`} d={`M${t} 56V57.6`} />
        ))}
        {ticks.map((t) => (
          <path key={`l${t}`} d={`M10 ${t + 2}H8.4`} />
        ))}
      </g>
      <g strokeWidth="1.15">
        <rect x="10" y="12" width="44" height="44" />
        <circle cx="32" cy="31" r="25" />
      </g>
      <g strokeWidth="1.5">
        <circle cx="32" cy="16.6" r="4.2" />
        {FIGURE.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      {/* navel: the compass point */}
      <circle cx="32" cy="31" r="0.9" strokeWidth="0.6" />
    </svg>
  );
}

export function Brand({ to = "/", suffix }: { to?: string; suffix?: string }) {
  return (
    <Link to={to} className="brand" aria-label="HumanFactor — home">
      <BrandMark />
      <span className="brand-name">
        Human<span>Factor</span>
      </span>
      {suffix && <span className="brand-suffix">{suffix}</span>}
    </Link>
  );
}
