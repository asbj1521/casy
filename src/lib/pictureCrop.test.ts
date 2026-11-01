import { describe, expect, it } from "vitest";

import { centredSquare, MAX_ZOOM, moveSquare, zoomSquare } from "./pictureCrop";

// A landscape photo, 400 x 200, shown in a frame 100 pixels wide.
const W = 400;
const H = 200;
const FRAME = 100;

describe("centredSquare", () => {
  it("is the middle square, as large as it can be", () => {
    expect(centredSquare(W, H)).toEqual({ left: 100, top: 0, side: 200 });
    expect(centredSquare(200, 400)).toEqual({ left: 0, top: 100, side: 200 });
    expect(centredSquare(300, 300)).toEqual({ left: 0, top: 0, side: 300 });
  });
});

describe("moveSquare", () => {
  it("moves the square the other way from the finger, in the photo's pixels", () => {
    // 10 screen pixels right is 20 photo pixels at 200 photo pixels per 100.
    expect(moveSquare(centredSquare(W, H), 10, 0, FRAME, W, H)).toEqual({
      left: 80,
      top: 0,
      side: 200,
    });
  });

  it("stops at the photo's edges, so the frame is always covered", () => {
    const start = centredSquare(W, H);
    expect(moveSquare(start, 1000, 0, FRAME, W, H).left).toBe(0);
    expect(moveSquare(start, -1000, 0, FRAME, W, H).left).toBe(200);
    // Nothing above or below a square that fills the short side.
    expect(moveSquare(start, 0, 50, FRAME, W, H).top).toBe(0);
  });
});

describe("zoomSquare", () => {
  it("keeps the photo's point under the fingers where it is", () => {
    const start = centredSquare(W, H);
    // Zoomed in twice about the frame's top left corner: that corner stays put.
    expect(zoomSquare(start, 2, 0, 0, FRAME, W, H)).toEqual({ left: 100, top: 0, side: 100 });
    // About the middle: the middle stays put.
    expect(zoomSquare(start, 2, 50, 50, FRAME, W, H)).toEqual({ left: 150, top: 50, side: 100 });
  });

  it("goes no closer than MAX_ZOOM and no further than the whole short side", () => {
    const start = centredSquare(W, H);
    expect(zoomSquare(start, 100, 50, 50, FRAME, W, H).side).toBe(H / MAX_ZOOM);
    expect(zoomSquare(start, 0.1, 50, 50, FRAME, W, H)).toEqual(start);
  });

  it("zooming out near an edge pushes the square back inside the photo", () => {
    const corner = { left: 300, top: 100, side: 100 };
    expect(zoomSquare(corner, 0.5, 100, 100, FRAME, W, H)).toEqual({
      left: 200,
      top: 0,
      side: 200,
    });
  });
});
