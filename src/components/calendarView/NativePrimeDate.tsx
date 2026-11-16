import { useNativeSheet } from "@/hooks/useNativeSheet";
import type { PrimeDate } from "@/lib/primeDates";

/**
 * Tid til hinanden's sheet when the app draws it (#200): the starred day goes
 * with it, and its Planlæg comes back here (`plan`), where Planlæg still is,
 * with the group and the day set.
 */
export default function NativePrimeDate({
  open,
  prime,
  onClose,
  onPlan,
}: {
  open: boolean;
  prime: PrimeDate | null;
  onClose: () => void;
  onPlan: (prime: PrimeDate) => void;
}) {
  useNativeSheet(
    "prime",
    open,
    ({ plan }) => {
      if (plan && prime) onPlan(prime);
      else onClose();
    },
    onClose,
    () => ({ prime }),
  );
  return null;
}
