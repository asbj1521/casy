import { useEffect, useRef, useState } from "react";

import { useNativeScreen } from "@/hooks/useNativeScreen";
import type { GridItem } from "@/lib/monthGrid";
import {
  onNativeHomeAction,
  sendHome,
  type NativeHomeAction,
  type NativeHomeState,
} from "@/lib/nativeBridge";

/**
 * The home page drawn in Swift while it is built (#201), in a Debug build of
 * the app with Admin's "Native forside" on: the app draws your calendar
 * itself, and this page tells it what the page still works out (the votes'
 * dates, the trips, the starred days, the vote pill) and when something only
 * the page draws is over the month, so the native one steps aside for it.
 * Each press on the native page arrives here and is done as from the page's
 * own buttons (`onAction`), which open their sheets, native ones included.
 * Nothing here runs on the website or in a Release build.
 */
export function useNativeHome(
  state: Omit<NativeHomeState, "shown" | "dataAt">,
  /** The month's items: when they change, the app reads your calendar again too. */
  items: GridItem[],
  onAction: (action: NativeHomeAction) => void,
) {
  const native = useNativeScreen("home");
  // A new list of items is a new fetch, or the phone's calendar changing.
  // (Followed as it changes, React's pattern for a changed value.)
  const [seen, setSeen] = useState({ items, dataAt: 1 });
  if (seen.items !== items) setSeen({ items, dataAt: seen.dataAt + 1 });
  const dataAt = seen.dataAt;

  const { covered, extras, colors, starred, pill, tell, holidaysHidden } = state;
  useEffect(() => {
    if (!native) return;
    void sendHome({
      shown: true,
      covered,
      extras,
      colors,
      starred,
      pill,
      tell,
      holidaysHidden,
      dataAt,
    });
  }, [native, covered, extras, colors, starred, pill, tell, holidaysHidden, dataAt]);
  // Gone from the home page (signed out, another page): the app's goes too.
  useEffect(() => {
    if (!native) return;
    return () =>
      void sendHome({
        shown: false,
        covered: false,
        extras: [],
        colors: {},
        starred: [],
        pill: null,
        tell: false,
        holidaysHidden: false,
        dataAt: 0,
      });
  }, [native]);

  // The page's handlers change each render; the listener stays.
  const act = useRef(onAction);
  useEffect(() => {
    act.current = onAction;
  });
  useEffect(() => {
    if (!native) return;
    let gone = false;
    let remove: (() => void) | undefined;
    void onNativeHomeAction((a) => act.current(a)).then((handle) => {
      if (gone) void handle.remove();
      else remove = () => void handle.remove();
    });
    return () => {
      gone = true;
      remove?.();
    };
  }, [native]);
}
