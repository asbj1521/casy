import { useMemo } from "react";
import { encode } from "uqr";

import { cn } from "@/lib/utils";

/**
 * `value` as a QR code (#150), drawn as one SVG path so it stays sharp at any
 * size. Black on white in both themes, with the standard four-module quiet
 * zone, since a phone's camera reads that and little else. Medium error
 * correction: a code on a screen is rarely damaged, and fewer modules scan
 * from further away.
 */
export default function QrCode({
  value,
  label,
  className,
}: {
  value: string;
  /** What the code is, for screen readers. */
  label: string;
  className?: string;
}) {
  const { size, path } = useMemo(() => {
    const qr = encode(value, { ecc: "M", border: 4 });
    let d = "";
    qr.data.forEach((row, y) =>
      row.forEach((dark, x) => {
        if (dark) d += `M${x} ${y}h1v1h-1z`;
      }),
    );
    return { size: qr.size, path: d };
  }, [value]);

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className={cn("block", className)}
    >
      <rect width={size} height={size} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}
