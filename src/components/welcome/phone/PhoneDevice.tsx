import { memo, type ReactNode } from "react";

import { DEVICE, EDGE, SCREEN } from "./geometry";

/** The metal band's width, inside the phone's edge. */
const BAND = 4;

/**
 * Its thickness, as thin plates one behind the other: close enough together
 * that from an angle they read as one rounded metal side. A real 3D model
 * would be far more than this needs; the plates hold no text and cost little.
 */
const DEPTH = 42;
const PLATES = 14;

/** Silver, brightest where the light catches it, darker toward the corners. */
const METAL =
  "linear-gradient(90deg, #8c8f94 0%, #eceded 7%, #c4c6c9 22%, #dfe0e2 50%, #c4c6c9 78%, #eceded 93%, #8c8f94 100%)";
/** The two thin lines across the band near each end (the antenna breaks). */
const BREAKS =
  "linear-gradient(180deg, transparent 8%, rgb(0 0 0 / 0.22) 8%, rgb(0 0 0 / 0.22) 8.5%, transparent 8.5%, transparent 91.5%, rgb(0 0 0 / 0.22) 91.5%, rgb(0 0 0 / 0.22) 92%, transparent 92%)";

/** The side buttons, top and height in the phone's own pixels. */
const LEFT_BUTTONS = [
  { top: 184, height: 48 },
  { top: 262, height: 86 },
  { top: 366, height: 86 },
];
const RIGHT_BUTTONS = [{ top: 296, height: 136 }];

function SideButton({
  side,
  top,
  height,
}: {
  side: "left" | "right";
  top: number;
  height: number;
}) {
  return (
    <i
      className="absolute w-[6px] rounded-[2px]"
      style={{
        [side]: -3,
        top,
        height,
        background: "linear-gradient(180deg, #a9abaf, #e3e4e6 12%, #c9cacd 88%, #8e9095)",
      }}
    />
  );
}

/** The metal body: every plate the phone's outline, the buttons only on the middle ones. */
const Body = memo(function Body() {
  return (
    <>
      {Array.from({ length: PLATES }, (_, i) => {
        const shade = (i / (PLATES - 1)) * 0.3;
        const middle = i >= 4 && i <= 9;
        return (
          <div
            key={i}
            className="absolute inset-0"
            style={{
              borderRadius: DEVICE.radius,
              background: `linear-gradient(rgb(0 0 0 / ${shade}), rgb(0 0 0 / ${shade})), ${BREAKS}, ${METAL}`,
              transform: `translateZ(${-(i / (PLATES - 1)) * DEPTH}px)`,
            }}
          >
            {middle && LEFT_BUTTONS.map((b) => <SideButton key={b.top} side="left" {...b} />)}
            {middle && RIGHT_BUTTONS.map((b) => <SideButton key={b.top} side="right" {...b} />)}
          </div>
        );
      })}
      {/* The bottom edge, seen when the phone leans back: speaker, port, speaker. */}
      <div
        className="absolute flex items-center justify-center gap-[34px]"
        style={{
          left: DEVICE.radius,
          right: DEVICE.radius,
          bottom: 0,
          height: DEPTH,
          transformOrigin: "50% 100%",
          transform: "translateY(0.5px) rotateX(90deg)",
        }}
      >
        <Holes />
        <span className="h-[10px] w-[52px] rounded-full bg-[#2a2b2e]" />
        <Holes />
      </div>
    </>
  );
});

function Holes() {
  return (
    <span className="flex gap-[6px]">
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className="h-[7px] w-[7px] rounded-full bg-[#2a2b2e]" />
      ))}
    </span>
  );
}

/** The Dynamic Island, with the camera's dark blue lens at its right. */
function Island() {
  return (
    <div
      aria-hidden
      className="absolute left-1/2 z-10 flex -translate-x-1/2 items-center justify-end rounded-full bg-black pr-[10px]"
      style={{ top: 11, width: 122, height: 35 }}
    >
      <span
        className="h-[13px] w-[13px] rounded-full"
        style={{ background: "radial-gradient(circle at 40% 40%, #27335f, #0b0e1f 62%, #05060c)" }}
      />
    </div>
  );
}

/**
 * The phone on the welcome screen (#228), drawn rather than a picture: silver
 * with a real side and buttons when turned, in any language and theme. Its
 * parent turns it in 3D (`transform-style` is why nothing between the plates
 * and that parent may clip, fade or blur). `children` are the screen, cut to
 * its corners; `over` lies on top of the whole phone, in the same pixels, for
 * what is not (yet) part of it.
 */
export default function PhoneDevice({ children, over }: { children: ReactNode; over?: ReactNode }) {
  return (
    <div
      className="absolute inset-0"
      style={{ transformStyle: "preserve-3d", width: DEVICE.width, height: DEVICE.height }}
    >
      <Body />
      {/* The face: the band's bright rim, the black bezel, the screen. */}
      <div
        className="absolute inset-0"
        style={{
          borderRadius: DEVICE.radius,
          background: METAL,
          boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.55)",
          transform: "translateZ(0.5px)",
        }}
      >
        <div
          className="absolute bg-black"
          style={{ inset: BAND, borderRadius: DEVICE.radius - BAND }}
        />
        <div
          className="absolute overflow-hidden bg-background"
          style={{
            inset: EDGE,
            borderRadius: SCREEN.radius,
          }}
        >
          <div className="absolute inset-0">{children}</div>
          <Island />
        </div>
      </div>
      {over && (
        <div
          className="absolute"
          style={{
            inset: EDGE,
            transform: "translateZ(1px)",
          }}
        >
          {over}
        </div>
      )}
    </div>
  );
}
