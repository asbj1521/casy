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
}: {
  open: boolean;
  onClose: () => void;
  /** The button it grows out of (#169). */
  origin?: RefObject<HTMLElement | null>;
}) {
  const t = useT();
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t.nav.profile}
      doneLabel={t.swipe.done}
      origin={origin}
    >
      <ProfileHubList />
    </BottomSheet>
  );
}
