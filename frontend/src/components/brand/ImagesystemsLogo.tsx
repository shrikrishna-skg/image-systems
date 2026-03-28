/**
 * ImageSystems mark — eight rounded “petals” in radial symmetry (Apple Photos–style),
 * clockwise from top: light blue → green → orange → coral → purple → blue → teal → amber.
 * White center aperture; works on light UI tiles.
 */
type Props = {
  className?: string;
  decorative?: boolean;
};

const CX = 28;
const CY = 28;
/** Rounded capsule: full pill ends (rx = half width). Wider = less gap between petals at the rim. */
const PETAL_W = 8.25;
const PETAL_RX = PETAL_W / 2;
const Y_TOP = 5.75;
const Y_BOTTOM = CY - 5.35;
const PETAL_H = Y_BOTTOM - Y_TOP;

/** Clockwise from top (SVG rotate is clockwise). */
const PETAL_FILLS = [
  "#7DD3FC",
  "#4ADE80",
  "#FB923C",
  "#F87171",
  "#C084FC",
  "#3B82F6",
  "#2DD4BF",
  "#FBBF24",
] as const;

export function ImagesystemsLogo({ className, decorative = true }: Props) {
  const x = CX - PETAL_RX;

  return (
    <svg
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role={decorative ? "presentation" : "img"}
      aria-hidden={decorative}
    >
      {!decorative ? <title>ImageSystems</title> : null}
      <g>
        {PETAL_FILLS.map((fill, i) => (
          <g key={i} transform={`rotate(${i * 45} ${CX} ${CY})`}>
            <rect x={x} y={Y_TOP} width={PETAL_W} height={PETAL_H} rx={PETAL_RX} fill={fill} />
          </g>
        ))}
      </g>
      <circle cx={CX} cy={CY} r="5.35" fill="white" />
    </svg>
  );
}
