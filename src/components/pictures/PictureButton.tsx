import type { ReactNode } from "react";
import { Camera, Loader2 } from "lucide-react";

import { usePicturePicker } from "@/hooks/usePicturePicker";
import { cn } from "@/lib/utils";

/**
 * A picture that is also its own button (#187, #188): a camera badge on its
 * corner, a tap opening the phone's own menu (usePicturePicker), the small
 * square JPEG made from the photo handed to `onPicked`.
 */
export default function PictureButton({
  label,
  busy,
  onPicked,
  onError,
  className,
  children,
}: {
  /** What a tap does, for screen readers: "Skift profilbillede". */
  label: string;
  busy: boolean;
  onPicked: (image: string) => void;
  onError: (message: string) => void;
  className?: string;
  /** The picture as it is now (an Avatar). */
  children: ReactNode;
}) {
  const picker = usePicturePicker({ onPicked, onError });
  return (
    <>
      <button
        type="button"
        onClick={picker.open}
        disabled={busy}
        aria-label={label}
        className={cn("relative shrink-0 rounded-full", className)}
      >
        {children}
        <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-secondary text-foreground">
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Camera className="h-3.5 w-3.5" />
          )}
        </span>
      </button>
      {picker.input}
    </>
  );
}
