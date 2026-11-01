/**
 * Choosing a picture's square (#190): the part of the photo that is kept,
 * as a square in the photo's own pixels. The crop sheet moves and resizes
 * it as the person drags and pinches, and the JPEG is made from exactly it
 * (lib/pictureFile), so what the frame shows is what is saved.
 *
 * The square always lies inside the photo, so the frame is always covered,
 * and it is never smaller than a quarter of the photo's short side: zoomed
 * in further, a 512 px picture would only be the photo's pixels blown up.
 */
export interface Square {
  left: number;
  top: number;
  side: number;
}

/** How far in the person can zoom, from the whole short side. */
export const MAX_ZOOM = 4;

/** The middle square of a photo, as large as it can be: what a picture was before #190. */
export function centredSquare(width: number, height: number): Square {
  const side = Math.min(width, height);
  return { left: (width - side) / 2, top: (height - side) / 2, side };
}

/** The square kept inside the photo, and between the whole short side and MAX_ZOOM. */
function clamp(square: Square, width: number, height: number): Square {
  const most = Math.min(width, height);
  const side = Math.min(most, Math.max(most / MAX_ZOOM, square.side));
  return {
    left: Math.min(width - side, Math.max(0, square.left)),
    top: Math.min(height - side, Math.max(0, square.top)),
    side,
  };
}

/**
 * The photo dragged by `dx`, `dy` screen pixels in a frame `frame` pixels
 * wide: the square moves the other way, as the photo follows the finger.
 */
export function moveSquare(
  square: Square,
  dx: number,
  dy: number,
  frame: number,
  width: number,
  height: number,
): Square {
  const perPixel = square.side / frame;
  return clamp(
    { left: square.left - dx * perPixel, top: square.top - dy * perPixel, side: square.side },
    width,
    height,
  );
}

/**
 * Zoomed in by `factor` (above 1 closer, below 1 further) about the point
 * `x`, `y` in the frame (the fingers' middle, the mouse): the part of the
 * photo under that point stays under it, as far as the edges allow.
 */
export function zoomSquare(
  square: Square,
  factor: number,
  x: number,
  y: number,
  frame: number,
  width: number,
  height: number,
): Square {
  const most = Math.min(width, height);
  const side = Math.min(most, Math.max(most / MAX_ZOOM, square.side / factor));
  // The photo's point under (x, y), kept under it at the new size.
  const px = square.left + (x / frame) * square.side;
  const py = square.top + (y / frame) * square.side;
  return clamp(
    { left: px - (x / frame) * side, top: py - (y / frame) * side, side },
    width,
    height,
  );
}
