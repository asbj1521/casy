import type { Square } from "@/lib/pictureCrop";

/**
 * A picture for Casy (#187) from a photo the person picked: opened with the
 * phone's own rotation applied, so a portrait photo stands up; then the
 * square they chose (#190, lib/pictureCrop) shrunk to PICTURE_SIZE and saved
 * again as JPEG on a canvas. Saving it again drops everything a camera
 * writes into a photo (where and when it was taken), and keeps every picture
 * small (about 50 KB).
 */
const PICTURE_SIZE = 512;
const QUALITY = 0.85;

/** The photo, ready to crop and draw. The caller closes it when done. */
export async function openPicture(file: File): Promise<ImageBitmap> {
  return await createImageBitmap(file, { imageOrientation: "from-image" });
}

/** The photo's `square` as base64 JPEG, ready for the pictures function. */
export async function squarePicture(image: ImageBitmap, square: Square): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = PICTURE_SIZE;
  canvas.height = PICTURE_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("no canvas");
  context.drawImage(
    image,
    square.left,
    square.top,
    square.side,
    square.side,
    0,
    0,
    PICTURE_SIZE,
    PICTURE_SIZE,
  );
  const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/jpeg", QUALITY));
  if (!blob) throw new Error("no picture");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/** A picture made here, as a link to show before the server has it (a genvej saved at once, #186). */
export function pictureUrl(image: string): string {
  return `data:image/jpeg;base64,${image}`;
}
