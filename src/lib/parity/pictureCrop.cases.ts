/** pictureCrop.ts, for PictureCrop.swift. */
import { centredSquare, moveSquare, type Square, zoomSquare } from "@/lib/pictureCrop";

import { caseBook, type ParityCase } from "./cases";

export function pictureCropCases(): ParityCase[] {
  const { cases, add, int, random } = caseBook(20261114);
  for (let i = 0; i < 200; i++) {
    const width = int(1, 6000);
    const height = int(1, 6000);
    add("centredSquare", { width, height }, centredSquare(width, height));
    // Squares anywhere, too big and too small: the clamp is half of what is tested.
    const square: Square = {
      left: (random() - 0.2) * width,
      top: (random() - 0.2) * height,
      side: random() * Math.min(width, height) * 1.5,
    };
    const frame = int(100, 400);
    const dx = (random() - 0.5) * 800;
    const dy = (random() - 0.5) * 800;
    add(
      "moveSquare",
      { square, dx, dy, frame, width, height },
      moveSquare(square, dx, dy, frame, width, height),
    );
    const factor = 0.2 + random() * 4;
    const x = random() * frame;
    const y = random() * frame;
    add(
      "zoomSquare",
      { square, factor, x, y, frame, width, height },
      zoomSquare(square, factor, x, y, frame, width, height),
    );
  }
  return cases;
}
