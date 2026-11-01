import { useEffect, useRef, useState } from "react";

import PictureCropSheet from "@/components/pictures/PictureCropSheet";
import { useT } from "@/i18n/lang";
import type { Square } from "@/lib/pictureCrop";
import { openPicture, squarePicture } from "@/lib/pictureFile";

/**
 * Picking a picture (#186, #187, #188): `open` shows the phone's own menu
 * (the photos, the camera, a file), the person chooses the square to keep
 * (#190, PictureCropSheet), and that square is made into a small JPEG on the
 * page (lib/pictureFile) before `onPicked` has it; Annuller picks nothing.
 * A photo that can't be opened says so through `onError`. `round`: the
 * picture is shown as a circle, so the crop shows one. `input` is the hidden
 * file field and the crop sheet, rendered anywhere beside the button that opens it.
 */
export function usePicturePicker({
  onPicked,
  onError,
  round = false,
}: {
  onPicked: (image: string) => void;
  onError: (message: string) => void;
  round?: boolean;
}) {
  const t = useT();
  const ref = useRef<HTMLInputElement>(null);
  // The photo being cropped, kept after the sheet closes so it slides away
  // showing it; let go of when the next one is picked, or on leaving.
  const [photo, setPhoto] = useState<ImageBitmap | null>(null);
  const [cropping, setCropping] = useState(false);
  useEffect(() => () => photo?.close(), [photo]);

  const done = async (square: Square) => {
    if (!photo) return;
    setCropping(false);
    try {
      onPicked(await squarePicture(photo, square));
    } catch {
      onError(t.pictures.unreadable);
    }
  };

  const input = (
    <>
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
            setPhoto(await openPicture(file));
            setCropping(true);
          } catch {
            onError(t.pictures.unreadable);
          }
        }}
      />
      <PictureCropSheet
        open={cropping}
        image={photo}
        round={round}
        onCancel={() => setCropping(false)}
        onDone={done}
      />
    </>
  );
  return { open: () => ref.current?.click(), input };
}
