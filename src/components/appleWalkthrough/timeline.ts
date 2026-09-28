/**
 * The walkthrough's timeline: for each device, the beats it plays in order.
 * A beat says where the pointer is, whether it clicks (or presses and holds),
 * which state the screen is drawn in, and how long it lasts. Coordinates are
 * in the drawings' own space (MacScreen.tsx, IphoneScreen.tsx), so moving
 * something in a drawing means moving its target here too.
 *
 * Kept as plain data, apart from the player, so timeline.test.ts can check
 * the rules the player relies on: every scene in order, one key beat each.
 */
import type { Device, SceneId } from "@/components/appleWalkthrough/layout";

export interface Beat {
  scene: SceneId;
  /** Which state the scene is drawn in: typed text, scrolled, selected. */
  phase: number;
  /** Where the pointer is, in the drawing's coordinates. */
  at: [number, number];
  click?: boolean;
  /** A long press (iPhone), which gets a slower ripple than a tap. */
  press?: boolean;
  /** How long this beat lasts before the next one. */
  ms: number;
  /** The beat shown when someone steps to this scene by hand. */
  key?: boolean;
}

export const BEATS: Record<Device, Beat[]> = {
  mac: [
    { scene: "landing", phase: 0, at: [560, 260], ms: 900 },
    { scene: "landing", phase: 0, at: [360, 377], ms: 1100, key: true },
    { scene: "landing", phase: 0, at: [360, 377], ms: 700, click: true },

    { scene: "biometric", phase: 0, at: [360, 377], ms: 900 },
    { scene: "biometric", phase: 0, at: [454, 123], ms: 1200, key: true },
    { scene: "biometric", phase: 0, at: [454, 123], ms: 700, click: true },

    { scene: "signIn", phase: 0, at: [360, 198], ms: 1000 },
    { scene: "signIn", phase: 1, at: [360, 198], ms: 900 },
    { scene: "signIn", phase: 2, at: [360, 232], ms: 1000 },
    { scene: "signIn", phase: 2, at: [452, 232], ms: 800, key: true },
    { scene: "signIn", phase: 2, at: [452, 232], ms: 700, click: true },

    { scene: "code", phase: 0, at: [360, 200], ms: 900 },
    { scene: "code", phase: 1, at: [360, 200], ms: 1300, key: true },

    { scene: "security", phase: 0, at: [470, 250], ms: 1100 },
    { scene: "security", phase: 1, at: [470, 250], ms: 900 },
    { scene: "security", phase: 2, at: [346, 321], ms: 1000, key: true },
    { scene: "security", phase: 2, at: [346, 321], ms: 700, click: true },

    // The tip rests on the corner of the +, so the arrow doesn't hide it.
    { scene: "list", phase: 0, at: [346, 321], ms: 800 },
    { scene: "list", phase: 0, at: [512, 244], ms: 1100, key: true },
    { scene: "list", phase: 0, at: [512, 244], ms: 700, click: true },

    { scene: "generate", phase: 0, at: [360, 215], ms: 1000 },
    { scene: "generate", phase: 1, at: [360, 215], ms: 900 },
    { scene: "generate", phase: 1, at: [360, 253], ms: 800, key: true },
    { scene: "generate", phase: 1, at: [360, 253], ms: 700, click: true },

    { scene: "confirm", phase: 0, at: [360, 219], ms: 1000 },
    { scene: "confirm", phase: 1, at: [360, 219], ms: 900 },
    { scene: "confirm", phase: 1, at: [360, 255], ms: 800, key: true },
    { scene: "confirm", phase: 1, at: [360, 255], ms: 700, click: true },

    { scene: "reveal", phase: 0, at: [360, 180], ms: 1100 },
    { scene: "reveal", phase: 1, at: [360, 180], ms: 800, click: true },
    { scene: "reveal", phase: 2, at: [360, 180], ms: 1300, key: true },
    { scene: "reveal", phase: 2, at: [360, 259], ms: 900 },
    { scene: "reveal", phase: 2, at: [360, 259], ms: 1000, click: true },
  ],
  iphone: [
    { scene: "landing", phase: 0, at: [270, 520], ms: 900 },
    { scene: "landing", phase: 0, at: [180, 414], ms: 1100, key: true },
    { scene: "landing", phase: 0, at: [180, 414], ms: 700, click: true },

    { scene: "biometric", phase: 0, at: [180, 414], ms: 900 },
    { scene: "biometric", phase: 0, at: [319, 405], ms: 1200, key: true },
    { scene: "biometric", phase: 0, at: [319, 405], ms: 700, click: true },

    { scene: "signIn", phase: 0, at: [180, 260], ms: 1000 },
    { scene: "signIn", phase: 1, at: [180, 260], ms: 900 },
    { scene: "signIn", phase: 1, at: [93, 366], ms: 800 },
    { scene: "signIn", phase: 1, at: [93, 366], ms: 600, click: true },
    { scene: "signIn", phase: 2, at: [180, 310], ms: 1000 },
    { scene: "signIn", phase: 2, at: [93, 366], ms: 800, key: true },
    { scene: "signIn", phase: 2, at: [93, 366], ms: 600, click: true },

    { scene: "code", phase: 0, at: [180, 218], ms: 900 },
    { scene: "code", phase: 1, at: [180, 218], ms: 1300, key: true },

    // A long scroll: the tile needed is the last of seven.
    { scene: "security", phase: 0, at: [240, 300], ms: 1100 },
    { scene: "security", phase: 1, at: [240, 300], ms: 1600 },
    { scene: "security", phase: 2, at: [180, 422], ms: 1000, key: true },
    { scene: "security", phase: 2, at: [180, 422], ms: 700, click: true },

    { scene: "list", phase: 0, at: [180, 422], ms: 800 },
    { scene: "list", phase: 0, at: [329, 251], ms: 1100, key: true },
    { scene: "list", phase: 0, at: [329, 251], ms: 700, click: true },

    { scene: "generate", phase: 0, at: [180, 338], ms: 1000 },
    { scene: "generate", phase: 1, at: [180, 338], ms: 900 },
    { scene: "generate", phase: 1, at: [180, 393], ms: 800, key: true },
    { scene: "generate", phase: 1, at: [180, 393], ms: 700, click: true },

    { scene: "confirm", phase: 0, at: [180, 332], ms: 1000 },
    { scene: "confirm", phase: 1, at: [180, 332], ms: 900 },
    { scene: "confirm", phase: 1, at: [180, 385], ms: 800, key: true },
    { scene: "confirm", phase: 1, at: [180, 385], ms: 700, click: true },

    // Press and hold selects one group; drag both handles out; Kopier; OK.
    { scene: "reveal", phase: 0, at: [157, 291], ms: 1100 },
    { scene: "reveal", phase: 1, at: [157, 291], ms: 1400, press: true },
    { scene: "reveal", phase: 2, at: [94, 291], ms: 900 },
    { scene: "reveal", phase: 3, at: [266, 291], ms: 1000, key: true },
    { scene: "reveal", phase: 3, at: [52, 327], ms: 900 },
    { scene: "reveal", phase: 4, at: [52, 327], ms: 700, click: true },
    { scene: "reveal", phase: 4, at: [180, 407], ms: 900 },
    { scene: "reveal", phase: 4, at: [180, 407], ms: 1000, click: true },
  ],
};

/** The beat shown when someone steps to `scene` by hand (the dots and arrows). */
export function keyBeat(beats: Beat[], scene: SceneId): number {
  return beats.findIndex((b) => b.scene === scene && b.key);
}
