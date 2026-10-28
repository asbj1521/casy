import { type RefObject } from "react";

import BottomSheet from "@/components/ui/BottomSheet";
import { ProfileHubList } from "@/components/profile/ProfileHub";
import { useT } from "@/i18n/lang";

/**
 * The phone's profile (#169), a sheet over the home page opened by its Profil
 * button (?profile), the calendar still behind it. Its rows open their own
 * screens, whose way back returns to the sheet.
 */
export default function ProfileSheet({
  open,
  onClose,
  origin,
  arrived,
}: {
  open: boolean;
  onClose: () => void;
  /** The button it grows out of (#169). */
  origin?: RefObject<HTMLElement | null>;
  /** Open already as the home page appears: shown in place (BottomSheet). */
  arrived?: boolean;
}) {
  const t = useT();
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t.nav.profile}
      doneLabel={t.swipe.done}
      origin={origin}
      arrived={arrived}
    >
      <ProfileHubList />
    </BottomSheet>
  );
}
