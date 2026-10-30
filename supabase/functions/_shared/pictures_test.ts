import { assertEquals, assertMatch } from "jsr:@std/assert@1";

import { MAX_PICTURE_BYTES, picturePath, readPicture } from "./pictures.ts";

const b64 = (bytes: number[]) => btoa(String.fromCharCode(...bytes));
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 1, 2, 3];

Deno.test("a JPEG is read as its bytes", () => {
  assertEquals(readPicture(b64(JPEG)), new Uint8Array(JPEG));
});

Deno.test("anything that isn't a small JPEG is turned away", () => {
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a];
  for (const raw of [b64(png), "", "not base64!", 12, null]) {
    assertEquals(readPicture(raw), null);
  }
  const big = new Array(MAX_PICTURE_BYTES + 1).fill(0);
  big.splice(0, 3, 0xff, 0xd8, 0xff);
  let s = "";
  for (let i = 0; i < big.length; i += 8192) s += String.fromCharCode(...big.slice(i, i + 8192));
  assertEquals(readPicture(btoa(s)), null);
});

Deno.test("each picture gets a path of its own under its owner", () => {
  const a = picturePath("avatar", "p1");
  assertMatch(a, /^avatar\/p1\/[0-9a-f-]{36}\.jpg$/);
  assertEquals(a === picturePath("avatar", "p1"), false);
});
