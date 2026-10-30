import { useRef } from "react";

import { useT } from "@/i18n/lang";
import { squarePicture } from "@/lib/pictureFile";

/**
 * Picking a picture (#186, #187, #188): `open` shows the phone's own menu
 * (the photos, the camera, a file), and the photo picked is made into a
 * small square JPEG on the page (lib/pictureFile) before `onPicked` has it.
 * A photo that can't be opened says so through `onError`. `input` is the
 * hidden file field, rendered anywhere beside the button that opens it.
 */
export function usePicturePicker({
  onPicked,
  onError,
}: {
  onPicked: (image: string) => void;
  onError: (message: string) => void;
}) {
  const t = useT();
  const ref = useRef<HTMLInputElement>(null);
  const input = (
    <input
      ref={ref}
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
  );
  return { open: () => ref.current?.click(), input };
}
