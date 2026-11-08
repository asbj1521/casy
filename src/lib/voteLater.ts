/**
 * Waiting votes put away for now (#241): "Færdig" on a vote being answered on
 * the home page, or "Senere" on its folded card, closes it and takes the "Svar
 * på" pill away too, so the home page is free until the app is opened again:
 * started afresh (this lives in memory only), or brought back after a while
 * away (AWAY_MS). The votes stay in Aftaler, and answering every date as
 * before needs nothing put away.
 */

/** Back from the background after this long counts as the app opened again. */
const AWAY_MS = 30 * 60_000;

let away = false;
let hiddenAt: number | null = null;
const changes = new Set<() => void>();
const changed = () => changes.forEach((change) => change());

export function putVotesAway(): void {
  away = true;
  changed();
}

export function votesAway(): boolean {
  return away;
}

export function onVotesAwayChange(change: () => void): () => void {
  changes.add(change);
  return () => {
    changes.delete(change);
  };
}

/** The app, or the tab, back in front: after long enough away, the votes are back. */
export function backInFront(now: number, wasHiddenAt: number | null): boolean {
  return wasHiddenAt !== null && now - wasHiddenAt >= AWAY_MS;
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      hiddenAt = Date.now();
      return;
    }
    if (backInFront(Date.now(), hiddenAt) && away) {
      away = false;
      changed();
    }
    hiddenAt = null;
  });
}
