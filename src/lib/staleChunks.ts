import { readStored, writeStored } from "@/lib/storage";

const RELOADED_AT = "casy-chunk-reload";
/** A second failure this soon after reloading for one is a real error, not a deploy. */
const NOT_AGAIN_MS = 10_000;

/**
 * After a deploy, a page opened before it asks for code files that no longer
 * exist (each build names them anew), and a lazily loaded page or part fails
 * to load (#157). Vite says so with `vite:preloadError`: the page is then
 * reloaded once, which fetches the new version. Never twice in a row, so a
 * file that really is missing can't make the page reload forever. The iPhone
 * app carries its own files and never sees this.
 */
export function reloadOnStaleChunks(): void {
  window.addEventListener("vite:preloadError", (event) => {
    const last = Number(readStored(RELOADED_AT, "session") ?? 0);
    if (Date.now() - last < NOT_AGAIN_MS) return;
    event.preventDefault();
    writeStored(RELOADED_AT, String(Date.now()), "session");
    window.location.reload();
  });
}
