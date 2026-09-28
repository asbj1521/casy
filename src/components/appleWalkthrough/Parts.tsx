import { SiApple } from "react-icons/si";
import { Apple, Contact, Diamond, LifeBuoy, RectangleEllipsis, ShieldEllipsis } from "lucide-react";

import { at, BLUE } from "@/components/appleWalkthrough/layout";

/**
 * Drawing pieces both devices use: Apple's ring of coloured dots, the dotted
 * logo atop its dialogs, and the icons on the Login og sikkerhed tiles.
 */

/** Apple's ring of coloured dots, round the logo on its sign-in pages. `size` is its width. */
export function DotRing({ size = 140 }: { size?: number }) {
  const rings = [
    { r: 34, n: 18, s: 2.2 },
    { r: 46, n: 24, s: 2.8 },
    { r: 58, n: 30, s: 3.4 },
  ];
  return (
    <svg width={size} height={size} viewBox="-70 -70 140 140" aria-hidden="true">
      {rings.flatMap(({ r, n, s }) =>
        Array.from({ length: n }, (_, i) => {
          const turn = i / n;
          const angle = turn * 2 * Math.PI - Math.PI / 2;
          return (
            <circle
              key={`${r}-${i}`}
              cx={r * Math.cos(angle)}
              cy={r * Math.sin(angle)}
              r={s}
              fill={`hsl(${195 + turn * 180} 78% 62%)`}
            />
          );
        }),
      )}
    </svg>
  );
}

/** The ring of small blue dots round the logo, atop Apple's dialogs, centred on (cx, cy). */
export function DottedAppleIcon({ cx, cy, r = 13 }: { cx: number; cy: number; r?: number }) {
  // Proportions from the Mac drawing, where r is 13: 22 dots of 2.4, a 10px logo.
  const dots = Math.round(r * 1.7);
  const dot = (r * 2.4) / 13;
  const logo = (r * 10) / 13;
  return (
    <>
      {Array.from({ length: dots }, (_, i) => {
        const angle = (i / dots) * 2 * Math.PI;
        return (
          <span
            key={i}
            style={{ ...at(cx + r * Math.cos(angle) - dot / 2, cy + r * Math.sin(angle) - dot / 2, dot, dot), background: BLUE }}
            className="rounded-full"
          />
        );
      })}
      <span style={at(cx - logo / 2, cy - logo * 0.6, logo, logo * 1.1)} className="flex items-center justify-center">
        <SiApple style={{ color: BLUE, width: logo, height: logo }} />
      </span>
    </>
  );
}

const TILE_ICONS = [Apple, RectangleEllipsis, ShieldEllipsis, LifeBuoy, Contact, null, Diamond];

/** The blue icon in the corner of tile `index` on Login og sikkerhed. */
export function TileIcon({ index, size }: { index: number; size: number }) {
  const Icon = TILE_ICONS[index];
  if (Icon) return <Icon className="shrink-0" style={{ color: BLUE, width: size, height: size }} />;
  // Log ind med Apple: the logo in a rounded square.
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-[25%] border-[1.5px]"
      style={{ borderColor: BLUE, width: size, height: size }}
    >
      <SiApple style={{ color: BLUE, width: size * 0.5, height: size * 0.5 }} />
    </span>
  );
}
