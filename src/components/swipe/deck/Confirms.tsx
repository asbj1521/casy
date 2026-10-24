import ConfirmPanel from "@/components/ui/ConfirmPanel";
import { useT } from "@/i18n/lang";

/** "Answer yes anyway?" before a yes to a date with a critical clash (#114). */
export function ClashConfirm({
  onConfirm,
  onCancel,
  className,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  className?: string;
}) {
  const t = useT();
  return (
    <ConfirmPanel
      className={className}
      message={t.importantClash.confirm}
      confirmLabel={t.importantClash.confirmYes}
      cancelLabel={t.importantClash.confirmNo}
      busy={false}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

export function MoveConfirm({
  onConfirm,
  onCancel,
  className,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  className?: string;
}) {
  const t = useT();
  return (
    <ConfirmPanel
      className={className}
      message={t.swipe.moveConfirm}
      confirmLabel={t.swipe.moveYes}
      cancelLabel={t.swipe.moveKeep}
      busy={false}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
