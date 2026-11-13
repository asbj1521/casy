/** The welcome animation's phone, in its own pixels (#228). */

/** Its screen: laid out at a real phone's size and only ever scaled down, so it stays sharp. */
export const SCREEN = { width: 390, height: 844, radius: 56 };
/** From the phone's outer edge to the screen: the metal band, then the black bezel. */
export const EDGE = 14;
export const DEVICE = {
  width: SCREEN.width + EDGE * 2,
  height: SCREEN.height + EDGE * 2,
  radius: SCREEN.radius + EDGE,
};
/** Above the first week, on the phone's month and the paper alike, so the weeks line up. */
export const HEADER_PX = 176;
/** Where the home page's two capsules sit, under the Dynamic Island. */
export const HEADER_PILL_TOP = 58;
/** The group screen's member rows, for the faces that fly into them. */
export const GROUP_ROWS = { left: 16, top: 300, height: 62, face: 44 };
