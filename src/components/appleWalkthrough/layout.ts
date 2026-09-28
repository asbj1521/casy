/**
 * What the Apple walkthrough's drawings and its timeline share: the scenes,
 * the size each device is drawn at, Apple's colours, and a helper for placing
 * things. The timeline's cursor targets are coordinates in these drawings, so
 * both sides read the sizes from here.
 */
import type { CSSProperties } from "react";

export type Device = "mac" | "iphone";

/** The steps at Apple, in order. The same nine on both devices. */
export type SceneId =
  | "landing"
  | "biometric"
  | "signIn"
  | "code"
  | "security"
  | "list"
  | "generate"
  | "confirm"
  | "reveal";

export const SCENES: SceneId[] = [
  "landing",
  "biometric",
  "signIn",
  "code",
  "security",
  "list",
  "generate",
  "confirm",
  "reveal",
];

/** The size each device is drawn at before it is scaled to fit. */
export const SIZE: Record<Device, { w: number; h: number }> = {
  // A browser window, bar included.
  mac: { w: 720, h: 450 },
  // The phone's screen below the status bar.
  iphone: { w: 360, h: 640 },
};

/** The Mac's drawn browser bar; the page starts below it. */
export const MAC_CHROME = 34;

export const BLUE = "#0071e3";
export const INK = "#1d1d1f";
export const GREY = "#6e6e73";

/** The made-up person the drawings show, never a real account. */
export const PERSON = { name: "Frida Jensen", initials: "FJ", email: "frida@icloud.com" };

/** Absolute placement in a drawing's own coordinates. */
export function at(left: number, top: number, width?: number, height?: number): CSSProperties {
  return { position: "absolute", left, top, width, height };
}
