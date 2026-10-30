import { useRef, type ReactNode } from "react";
import { Camera, Loader2 } from "lucide-react";

import { useT } from "@/i18n/lang";
import { squarePicture } from "@/lib/pictureFile";
import { cn } from "@/lib/utils";

/**
 * A picture that is also its own button (#187, #188): a camera badge on its
 * corner, a tap opening the phone's own menu (the photos, the camera, a
 * file), and the photo picked made into a small square JPEG on the page
 * (lib/pictureFile) before `onPicked` sends it. A photo that can't be opened
 * says so through `onError`.
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
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => input.current?.click()}
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
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            onPicked(await squarePicture(file));
          } catch {
            onError(t.pictures.unreadable);
          }
        }}
      />
    </>
  );
}
