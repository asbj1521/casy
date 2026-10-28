import BottomSheet from "@/components/ui/BottomSheet";
import { ProfileHubList } from "@/components/profile/ProfileHub";
import { useT } from "@/i18n/lang";

/**
 * The phone's profile (#169), a sheet over the home page opened by its Profil
 * button (?profile), the calendar still behind it. Its rows open their own
 * screens, whose way back returns to the sheet.
 */
export default function ProfileSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  return (
    <BottomSheet open={open} onClose={onClose} title={t.nav.profile} doneLabel={t.swipe.done}>
      <ProfileHubList />
    </BottomSheet>
  );
}
