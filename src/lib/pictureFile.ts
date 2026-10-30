/**
 * A picture for Casy (#187) from a photo the person picked: cut to its
 * middle square, shrunk to PICTURE_SIZE and saved again as JPEG on a canvas.
 * Saving it again drops everything a camera writes into a photo (where and
 * when it was taken), and keeps every picture small (about 50 KB). The
 * phone's own rotation is applied first, so a portrait photo stands up.
 */
const PICTURE_SIZE = 512;
const QUALITY = 0.85;

/** The picture as base64 JPEG, ready for the pictures function. */
export async function squarePicture(file: File): Promise<string> {
  const image = await createImageBitmap(file, { imageOrientation: "from-image" });
  const side = Math.min(image.width, image.height);
  const canvas = document.createElement("canvas");
  canvas.width = PICTURE_SIZE;
  canvas.height = PICTURE_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("no canvas");
  context.drawImage(
    image,
    (image.width - side) / 2,
    (image.height - side) / 2,
    side,
    side,
    0,
    0,
    PICTURE_SIZE,
    PICTURE_SIZE,
  );
  image.close();
  const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/jpeg", QUALITY));
  if (!blob) throw new Error("no picture");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}
