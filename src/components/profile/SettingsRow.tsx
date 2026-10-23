import { Settings } from "lucide-react";

import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { useLang, useT } from "@/i18n/lang";

/**
 * The profile's way into Settings (#129): one row, with the language in use on
 * the right. The same on a phone and a computer, where the profile's other
 * rows differ.
 */
export default function SettingsRow() {
  const t = useT();
  const { lang } = useLang();
  return (
    <ListGroup>
      <ListRow
        to="/profile/settings"
        icon={Settings}
        label={t.profileHub.settings}
        value={lang === "da" ? "Dansk" : "English"}
      />
    </ListGroup>
  );
}
