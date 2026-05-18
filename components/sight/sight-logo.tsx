import { useId } from "react";
import Link from "next/link";

export function SightLogo({ size = 32 }: { size?: number }) {
  const maskId = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 2000 2000"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <mask
        id={maskId}
        maskUnits="userSpaceOnUse"
        x="0"
        y="0"
        width="2000"
        height="2000"
      >
        <rect x="0" y="0" width="2000" height="2000" fill="white" />
        <polygon
          points="640,460 745,460 800,485 820,520 800,550 778,560"
          fill="black"
        />
      </mask>
      <g mask={`url(#${maskId})`}>
        <path
          d="M772.464 558.786L736.296 670.262C731.289 685.695 719.072 697.517 704.024 703.584C608.784 741.983 463.182 848.257 492.766 1034.31C533.068 1287.76 670.993 1274.33 670.993 1271.65C670.993 1268.96 856.385 1292.24 886.836 948.329C917.287 604.413 1145.67 460.219 1255.83 476.34C1365.99 492.461 1616.76 460.219 1691.1 948.329C1749.15 1329.51 1440.96 1488.52 1268.23 1523.65C1260.05 1525.31 1251.69 1524.61 1243.78 1521.96L1195.7 1505.82C1162 1494.51 1150.54 1452.63 1173.78 1425.73L1247 1340.98C1252.78 1334.28 1260.21 1329.35 1268.42 1326.07C1362.44 1288.55 1523.14 1168.84 1501.23 948.329C1472.57 659.941 1190.45 493.356 1074.91 1034.31C1047.75 1183.58 928.93 1482.11 670.993 1482.11C415.134 1482.11 319.074 1188.37 302.391 1037.94C302.116 1035.47 302.058 1033 302.182 1030.51C320.531 663.093 549.061 521.12 666.106 494.418C669.413 493.663 672.702 493.356 676.094 493.356H724.904C758.863 493.356 782.944 526.484 772.464 558.786Z"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="30"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

interface SightWordmarkProps {
  size?: number;
  href?: string;
  label?: string;
  className?: string;
}

export function SightWordmark({
  size = 22,
  href = "/",
  label = "Sight",
  className = "",
}: SightWordmarkProps) {
  const content = (
    <span
      className={`group inline-flex items-center gap-2 text-zinc-900 transition-opacity hover:opacity-80 ${className}`}
    >
      <SightLogo size={size} />
      <span className="text-[15px] font-medium tracking-[-0.01em]">
        {label}
      </span>
    </span>
  );

  if (!href) return content;
  return (
    <Link href={href} aria-label={`${label} home`}>
      {content}
    </Link>
  );
}
