/**
 * The random numbers behind Casy's own choices: the scheduler's starting
 * settings, which group or example shows first. Math.random, unless the
 * browser tests have put a seeded generator of their own here
 * (`window.__casyRandom`, e2e/fixtures.ts): then these choices stay the same
 * on every load, whatever else in the page draws random numbers first and
 * however the code is split into chunks (#157).
 */
export function appRandom(): number {
  const seeded = (window as unknown as { __casyRandom?: () => number }).__casyRandom;
  return seeded ? seeded() : Math.random();
}

const drawn = new Map<string, unknown>();

/**
 * A random choice made once per page load and kept: a page mounted twice
 * while it loads (the session check can swap it out for a moment) keeps its
 * first settings rather than drawing new ones. Moves around the site keep
 * their own state (usePlanning's pageMemory); this is only the first draw.
 */
export function oncePerLoad<T>(key: string, draw: () => T): T {
  if (!drawn.has(key)) drawn.set(key, draw());
  return drawn.get(key) as T;
}
