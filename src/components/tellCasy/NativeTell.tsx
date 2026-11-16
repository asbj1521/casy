import { useNativeSheet } from "@/hooks/useNativeSheet";

/**
 * Tilføj til kalender when the app draws it (#200): nothing on the page, only
 * the native sheet while `open`. When it kept something, `onSaved` has where
 * the first of it starts, so the month glides there to show it landed.
 */
export default function NativeTell({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (start: string) => void;
}) {
  useNativeSheet(
    "tell",
    open,
    ({ added }) => {
      onClose();
      if (added) onSaved(added);
    },
    onClose,
  );
  return null;
}
