import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

import {
  hideGlassBar,
  nativeGlassAvailable,
  parseRgb,
  pressGlassBar,
  setGlassBarVisible,
  showGlassBar,
  type GlassBarButton,
} from "@/lib/nativeGlass";

const ORANGE: [number, number, number] = [234, 88, 12];

/** Whether a dialog (a sheet, a picker, a pop-up) is open: they are drawn into <body>. */
function useDialogOpen(active: boolean): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!active) return;
    const check = () => setOpen(document.querySelector('[role="dialog"]') !== null);
    check();
    // Only <body>'s own children: sheets are portals there, and nothing deeper is worth watching.
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true });
    return () => observer.disconnect();
  }, [active]);
  return open;
}

/** The bar's buttons as the page has them now: where they stand, what they say. */
function readButtons(bar: HTMLElement): GlassBarButton[] {
  return Array.from(bar.querySelectorAll<HTMLElement>("[data-glass]")).map((el) => {
    const r = el.getBoundingClientRect();
    const badge = el.querySelector<HTMLElement>("[data-glass-badge]");
    const tint = parseRgb(getComputedStyle(el).color, ORANGE);
    return {
      id: el.dataset.glass ?? "",
      x: r.left,
      y: r.top,
      width: r.width,
      height: r.height,
      symbols: (el.dataset.symbols ?? "").split(","),
      iconSize: Number(el.dataset.iconSize) || 22,
      title: el.dataset.title,
      badge: badge ? Number(badge.textContent) || undefined : undefined,
      tint,
      badgeTint: badge ? parseRgb(getComputedStyle(badge).backgroundColor, ORANGE) : tint,
    };
  });
}

/**
 * Apple's real Liquid Glass behind the home page's bar (#191), in the app on
 * iOS 26 and later (GlassPlugin.swift): a glass capsule drawn natively for
 * each `[data-glass]` button of `bar`, at the place the page's button stands,
 * with its icon, words and badge on it. The buttons stay web elements and
 * take every tap; the glass is only a picture over them. It follows them
 * (their size, the window), gives under a finger on them, and dissolves
 * while the bar isn't `visible`, while any dialog is open (a native view
 * would draw over its sheet) and when the plugin says no.
 *
 * Returns whether the glass is showing, so the page can drop its own CSS
 * glass and hide the content the glass now draws.
 */
export function useNativeGlassBar(
  bar: RefObject<HTMLElement | null>,
  visible: boolean,
  fadeMs: number,
  /** Changes whenever what a button says does (its badge), to send it again. */
  said: string,
): boolean {
  const [native, setNative] = useState(false);
  useEffect(() => {
    let live = true;
    void nativeGlassAvailable().then((yes) => live && setNative(yes));
    return () => {
      live = false;
    };
  }, []);
  const dialog = useDialogOpen(native);
  const show = visible && !dialog;

  // The glass at the buttons' places, while there are any.
  const [placed, setPlaced] = useState(false);
  const resend = useRef<() => void>(() => {});
  useLayoutEffect(() => {
    const el = bar.current;
    if (!native || !el) return;
    let live = true;
    const send = () =>
      void showGlassBar(readButtons(el))
        .then(() => live && setPlaced(true))
        .catch(() => live && setNative(false));
    resend.current = send;
    send();
    const observer = new ResizeObserver(send);
    observer.observe(el);
    el.querySelectorAll("[data-glass]").forEach((button) => observer.observe(button));
    window.addEventListener("resize", send);
    window.visualViewport?.addEventListener("resize", send);
    // A finger on a button gives its glass a press, as Apple's do.
    const press = (down: boolean) => (e: Event) => {
      const id = (e.target as Element | null)?.closest<HTMLElement>("[data-glass]")?.dataset.glass;
      if (id) void pressGlassBar(id, down).catch(() => {});
    };
    const down = press(true);
    const up = press(false);
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("pointerleave", up, true);
    return () => {
      live = false;
      observer.disconnect();
      window.removeEventListener("resize", send);
      window.visualViewport?.removeEventListener("resize", send);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("pointerleave", up, true);
      resend.current = () => {};
      setPlaced(false);
      void hideGlassBar().catch(() => {});
    };
  }, [native, bar]);
  // What a button says changed (its badge): sent again, the glass kept as it is.
  useEffect(() => resend.current(), [said]);

  useEffect(() => {
    if (native && placed) void setGlassBarVisible(show, fadeMs).catch(() => {});
  }, [native, placed, show, fadeMs]);

  return native && placed && show;
}
