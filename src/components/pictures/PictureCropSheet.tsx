import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import FlowButton from "@/components/ui/FlowButton";
import Sheet from "@/components/ui/Sheet";
import { useT } from "@/i18n/lang";
import { centredSquare, moveSquare, zoomSquare, type Square } from "@/lib/pictureCrop";
import { cn } from "@/lib/utils";

/** The longest side the photo is drawn at on screen: a 48 MP photo would only use memory. */
const SHOWN_SIDE = 2048;
/** What one press of an arrow key moves the photo, and +/- zooms it. */
const KEY_STEP = 12;
const KEY_ZOOM = 1.25;

/**
 * Choosing which part of a picked photo becomes the picture (#190), as the
 * iPhone's own "Flyt og skalér": the photo fills a square frame, one finger
 * drags it, two pinch it (a computer: drag and the wheel, or the arrow keys
 * and +/-). It opens on the middle square, so Færdig at once is what a
 * picture was before. `round`: the picture is shown as a circle (a profile,
 * a group), so the frame shows the circle and dims the corners.
 */
export default function PictureCropSheet({
  open,
  image,
  round,
  onCancel,
  onDone,
}: {
  open: boolean;
  /** The photo, kept by the picker until the next one so the sheet can slide away showing it. */
  image: ImageBitmap | null;
  round: boolean;
  onCancel: () => void;
  onDone: (square: Square) => void;
}) {
  const t = useT();
  // The square chosen, for the photo it was chosen on: a new photo starts in the middle.
  const [crop, setCrop] = useState<{ image: ImageBitmap; square: Square } | null>(null);
  const square =
    image && (crop?.image === image ? crop.square : centredSquare(image.width, image.height));
  const update = (change: (square: Square) => Square) => {
    if (!image) return;
    setCrop((c) => ({
      image,
      square: change(c?.image === image ? c.square : centredSquare(image.width, image.height)),
    }));
  };

  // The frame's width on screen; set from the element itself, as it is mounted only while open.
  const [frameEl, setFrameEl] = useState<HTMLDivElement | null>(null);
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!frameEl) return;
    const observer = new ResizeObserver(() => setFrame(frameEl.clientWidth));
    observer.observe(frameEl);
    return () => observer.disconnect();
  }, [frameEl]);

  // The photo drawn once, smaller, on a canvas moved and scaled by CSS: a
  // canvas rather than an <img>, since the photo may be a HEIC.
  const shown = image ? Math.min(1, SHOWN_SIDE / Math.max(image.width, image.height)) : 1;
  const shownWidth = image ? Math.round(image.width * shown) : 0;
  const shownHeight = image ? Math.round(image.height * shown) : 0;
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!canvasEl || !image) return;
    canvasEl.getContext("2d")?.drawImage(image, 0, 0, shownWidth, shownHeight);
  }, [canvasEl, image, shownWidth, shownHeight]);

  // The wheel (a trackpad's pinch comes as the wheel with Ctrl held), about
  // the mouse. Listened to directly, as React's wheel listener can't stop the page scrolling.
  useEffect(() => {
    if (!frameEl || !image) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const box = frameEl.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002));
      setCrop((c) => ({
        image,
        square: zoomSquare(
          c?.image === image ? c.square : centredSquare(image.width, image.height),
          factor,
          e.clientX - box.left,
          e.clientY - box.top,
          box.width,
          image.width,
          image.height,
        ),
      }));
    };
    frameEl.addEventListener("wheel", onWheel, { passive: false });
    return () => frameEl.removeEventListener("wheel", onWheel);
  }, [frameEl, image]);

  // Every finger on the frame, where it was last: one drags, two pinch.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const was = pointers.current.get(e.pointerId);
    if (!was || !image || !frame) return;
    const before = [...pointers.current.values()];
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const after = [...pointers.current.values()];
    if (after.length === 1) {
      update((s) =>
        moveSquare(s, e.clientX - was.x, e.clientY - was.y, frame, image.width, image.height),
      );
      return;
    }
    // Two fingers: zoomed by how far apart they moved, about their middle, and moved with it.
    const box = e.currentTarget.getBoundingClientRect();
    const [a0, b0] = before;
    const [a1, b1] = after;
    const factor = Math.hypot(b1.x - a1.x, b1.y - a1.y) / Math.hypot(b0.x - a0.x, b0.y - a0.y);
    const mid0 = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 };
    const mid1 = { x: (a1.x + b1.x) / 2, y: (a1.y + b1.y) / 2 };
    update((s) =>
      moveSquare(
        zoomSquare(
          s,
          Number.isFinite(factor) && factor > 0 ? factor : 1,
          mid0.x - box.left,
          mid0.y - box.top,
          frame,
          image.width,
          image.height,
        ),
        mid1.x - mid0.x,
        mid1.y - mid0.y,
        frame,
        image.width,
        image.height,
      ),
    );
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!image || !frame) return;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-KEY_STEP, 0],
      ArrowRight: [KEY_STEP, 0],
      ArrowUp: [0, -KEY_STEP],
      ArrowDown: [0, KEY_STEP],
    };
    const zooms: Record<string, number> = { "+": KEY_ZOOM, "=": KEY_ZOOM, "-": 1 / KEY_ZOOM };
    if (moves[e.key]) {
      const [dx, dy] = moves[e.key];
      update((s) => moveSquare(s, dx, dy, frame, image.width, image.height));
    } else if (zooms[e.key]) {
      const factor = zooms[e.key];
      update((s) => zoomSquare(s, factor, frame / 2, frame / 2, frame, image.width, image.height));
    } else {
      return;
    }
    e.preventDefault();
  };

  // Screen pixels per photo pixel, so the square fills the frame exactly.
  const scale = square && frame ? frame / square.side : 0;
  return (
    <Sheet
      open={open}
      onClose={onCancel}
      title={t.pictures.cropTitle}
      closeLabel={t.common.cancel}
      footer={
        <FlowButton onClick={() => square && onDone(square)} disabled={!square}>
          {t.common.done}
        </FlowButton>
      }
    >
      <div
        ref={setFrameEl}
        tabIndex={0}
        aria-label={t.pictures.cropFrame}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        className="relative aspect-square w-full cursor-grab touch-none select-none overflow-hidden rounded-2xl bg-black outline-none focus-visible:ring-2 focus-visible:ring-primary active:cursor-grabbing"
      >
        {image && square && scale > 0 && (
          <canvas
            ref={setCanvasEl}
            width={shownWidth}
            height={shownHeight}
            aria-hidden
            className="absolute left-0 top-0 max-w-none origin-top-left"
            style={{
              width: shownWidth,
              height: shownHeight,
              transform: `translate(${-square.left * scale}px, ${-square.top * scale}px) scale(${scale * (image.width / shownWidth)})`,
            }}
          />
        )}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/70",
            round ? "rounded-full shadow-[0_0_0_100vmax_rgb(0_0_0/0.5)]" : "rounded-2xl",
          )}
        />
      </div>
    </Sheet>
  );
}
