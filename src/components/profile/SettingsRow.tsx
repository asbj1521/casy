import { Settings } from "lucide-react";

import { ListRow } from "@/components/ui/ListGroup";
import { useLang, useT } from "@/i18n/lang";

/**
 * The profile's way into Settings (#129): one row, with the language in use on
 * the right, in whatever list the profile puts it in (the phone's has Groups
 * under it).
 */
export default function SettingsRow() {
  const t = useT();
  const { lang } = useLang();
  return (
    <ListRow
      to="/profile/settings"
      icon={Settings}
      label={t.profileHub.settings}
      value={lang === "da" ? "Dansk" : "English"}
    />
  );
}
