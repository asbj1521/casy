import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

import { onAppLink } from "@/lib/appLinksNative";

/**
 * Links that open the iPhone app (#140): an invite link tapped on a phone
 * with Casy on it opens the join page here, not in Safari. In the app only
 * (App.tsx loads it there, so the website never downloads it), and, as in
 * PushLinks, the listener is put on once: a link landing between two screens
 * must not be missed, so it reads the router's latest `navigate` through a ref.
 */
export default function AppLinks() {
  const navigate = useNavigate();
  const open = useRef(navigate);
  useEffect(() => {
    open.current = navigate;
  });

  useEffect(() => {
    let stop = () => {};
    let gone = false;
    // An app build without the plugin simply has no links to open.
    onAppLink((path) => open.current(path)).then(
      (remove) => {
        if (gone) remove();
        else stop = remove;
      },
      () => {},
    );
    return () => {
      gone = true;
      stop();
    };
  }, []);

  return null;
}
