/**
 * Carries Planlæg's send flight out (#102; the timing is sendFlight.ts): the
 * dates not sent swipe off to the right, the ones sent fly down into the
 * Events tab. Browser only: it copies the rows and moves the copies.
 */
import { haptic } from "@/lib/haptics";
import { FLIGHT_TIMING as T, flightPlan } from "@/lib/sendFlight";

/** A row to move: its element as drawn now, and whether it is one of the dates sent. */
export interface FlightRow {
  el: HTMLElement;
  offered: boolean;
}

/**
 * Carry the flight out: copy each row onto a layer above the page, move the
 * copies, and resolve once the last date has arrived (the layer goes then).
 * `onCopied` runs as soon as the copies are in place, to hide the real rows.
 * Resolves at once, doing nothing, without a tab to fly into.
 */
export async function playSendFlight(
  rows: FlightRow[],
  tab: HTMLElement | null,
  onCopied: () => void,
): Promise<void> {
  if (!tab || rows.length === 0) return;
  const plan = flightPlan(rows.map((r) => r.offered));
  const target = tab.getBoundingClientRect();
  const tx = target.left + target.width / 2;
  const ty = target.top + target.height / 2;

  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  layer.dataset.sendFlight = "";
  layer.style.cssText =
    "position:fixed;inset:0;z-index:70;pointer-events:none;overflow:hidden;contain:layout paint";
  const timers: number[] = [];
  const animations: Animation[] = [];
  // How many of the sent dates have yet to land, so the last one can say so.
  let landing = rows.filter((r) => r.offered).length;

  rows.forEach(({ el }, i) => {
    const rect = el.getBoundingClientRect();
    // A row scrolled out of sight has nowhere to fly from.
    if (rect.bottom <= 0 || rect.top >= window.innerHeight) {
      if (rows[i].offered) landing--;
      return;
    }
    const copy = el.cloneNode(true) as HTMLElement;
    copy.removeAttribute("data-send-row");
    copy.style.cssText = `position:fixed;margin:0;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;transform:none;transform-origin:50% 50%;will-change:transform,opacity`;
    layer.appendChild(copy);

    const { move, delay, duration } = plan.steps[i];
    const timing: KeyframeAnimationOptions = {
      delay: delay * 1000,
      duration: duration * 1000,
      fill: "both",
    };
    if (move === "away") {
      const out = window.innerWidth - rect.left + 40;
      animations.push(
        copy.animate(
          [
            { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
            { transform: `translate(${out}px,0) rotate(5deg)`, opacity: 0 },
          ],
          { ...timing, easing: "cubic-bezier(0.4, 0, 1, 1)" },
        ),
      );
      return;
    }
    const dx = tx - (rect.left + rect.width / 2);
    const dy = ty - (rect.top + rect.height / 2);
    animations.push(
      copy.animate(
        [
          { transform: "translate(0,0) scale(1)", opacity: 1, offset: 0 },
          // A small lift off the list before it dives.
          { transform: "translate(0,-10px) scale(1.03)", opacity: 1, offset: 0.14 },
          { transform: `translate(${dx}px,${dy}px) scale(0.08)`, opacity: 0.9, offset: 0.9 },
          { transform: `translate(${dx}px,${dy}px) scale(0.04)`, opacity: 0, offset: 1 },
        ],
        { ...timing, easing: "cubic-bezier(0.55, 0, 0.85, 0.35)" },
      ),
    );
    // The tab takes it in: a bump and a haptic, a stronger one for the last.
    timers.push(
      window.setTimeout(
        () => {
          landing--;
          tab.animate(
            [
              { transform: "scale(1)" },
              { transform: "scale(1.3)", offset: 0.35 },
              { transform: "scale(1)" },
            ],
            { duration: 320, easing: "ease-out" },
          );
          haptic(landing <= 0 ? "success" : "answer");
        },
        (delay + duration) * 1000,
      ),
    );
  });

  document.body.appendChild(layer);
  onCopied();
  await new Promise((done) => window.setTimeout(done, (plan.end + T.after) * 1000));
  timers.forEach((id) => window.clearTimeout(id));
  for (const a of animations) a.cancel();
  layer.remove();
}
