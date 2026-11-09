import { Settings } from "lucide-react";

import { ListRow } from "@/components/ui/ListGroup";
import { useNativeScreen } from "@/hooks/useNativeScreen";
import { useLang, useT } from "@/i18n/lang";
import { openNativeScreen } from "@/lib/nativeBridge";

/**
 * The profile's way into Settings (#129): one row, with the language in use on
 * the right, in whatever list the profile puts it in (the phone's has Groups
 * under it). In an app that draws Settings natively (#198), the row opens
 * that screen instead of the page's own.
 */
export default function SettingsRow() {
  const t = useT();
  const { lang } = useLang();
  const native = useNativeScreen("settings");
  const shared = {
    icon: Settings,
    label: t.profileHub.settings,
    value: lang === "da" ? "Dansk" : "English",
  };
  return native ? (
    <ListRow
      {...shared}
      chevron
      onClick={() => {
        openNativeScreen("settings").catch((err) =>
          console.warn("opening the native Settings failed", err),
        );
      }}
    />
  ) : (
    <ListRow {...shared} to="/profile/settings" />
  );
}
