import { Image as ImageIcon, Trash2 } from "lucide-react";

import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { usePicturePicker } from "@/hooks/usePicturePicker";
import { useT } from "@/i18n/lang";

/**
 * A genvej's picture in its editor (#186): a row showing it small, a tap
 * picking another, and "Fjern billede" while it has one. Nothing is sent
 * here: the picture goes with the genvej when it is saved.
 */
export default function ShortcutPicture({
  url,
  onPicked,
  onRemove,
  error,
  onError,
}: {
  /** The picture as the genvej will have it: its own, or one just picked. */
  url: string | null;
  onPicked: (image: string) => void;
  onRemove: () => void;
  error: string | null;
  onError: (message: string) => void;
}) {
  const t = useT();
  const words = t.shortcuts;
  const picker = usePicturePicker({ onPicked, onError });
  return (
    <>
      <ListGroup className="mt-6">
        <ListRow
          icon={ImageIcon}
          label={words.picture}
          value={
            url ? (
              <img src={url} alt="" className="h-8 w-8 rounded-lg object-cover" />
            ) : (
              <span className="text-primary">{words.pictureAdd}</span>
            )
          }
          onClick={picker.open}
        />
        {url && (
          <ListRow icon={Trash2} label={t.pictures.remove} tone="danger" onClick={onRemove} />
        )}
      </ListGroup>
      {error && <p className="mt-2 px-1 text-[13px] text-red-600">{error}</p>}
      {picker.input}
    </>
  );
}
