/** The phone turning into the sign-in card and back (#228). */

/** A box on the screen. */
export type MorphRect = {
  left: number;
  top: number;
  width: number;
  height: number;
  borderRadius: number;
};

/** Where the sign-in card is now (SignIn's `data-auth-card`), if it is there. */
export function rectOfCard(): MorphRect | null {
  const card = document.querySelector("[data-auth-card]");
  if (!card) return null;
  const { left, top, width, height } = card.getBoundingClientRect();
  return { left, top, width, height, borderRadius: 16 };
}
