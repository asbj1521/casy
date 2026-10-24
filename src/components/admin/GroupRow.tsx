import { Loader2, Trash2, X } from "lucide-react";

import { type AdminGroup } from "@/api/admin";
import Avatar from "@/components/ui/Avatar";
import ConfirmPanel from "@/components/ui/ConfirmPanel";
import { useLang, useT } from "@/i18n/lang";
import { formatDate } from "@/lib/format";
import { type Confirm } from "./helpers";

export default function GroupRow({
  group,
  confirm,
  deleting,
  removingId,
  error,
  onAskDelete,
  onAskRemove,
  onCancel,
  onDelete,
  onRemove,
}: {
  group: AdminGroup;
  confirm: Confirm | null;
  deleting: boolean;
  removingId: string | null;
  error: string | null;
  onAskDelete: () => void;
  onAskRemove: (profileId: string) => void;
  onCancel: () => void;
  onDelete: () => void;
  onRemove: (profileId: string) => void;
}) {
  const { lang } = useLang();
  const t = useT();
  const removing =
    confirm?.kind === "member"
      ? group.members.find((m) => m.profileId === confirm.profileId)
      : null;
  const lastOne = group.members.length <= 1;

  return (
    <li className="py-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{group.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t.admin.groupMeta(
              t.counts.members(group.members.length),
              formatDate(group.createdAt, lang),
              group.createdByName,
            )}
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {group.members.map((m, i) => (
              <li
                key={m.profileId}
                className="flex items-center gap-1.5 rounded-full border bg-background py-0.5 pl-0.5 pr-1.5 text-xs text-foreground"
              >
                <Avatar name={m.name} index={i} size="xs" />
                {m.name}
                <button
                  type="button"
                  onClick={() => onAskRemove(m.profileId)}
                  title={t.admin.removeMemberTitle(m.name, group.name)}
                  className="flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition hover:bg-red-100 hover:text-red-700"
                >
                  {removingId === m.profileId ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <X className="h-3 w-3" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          onClick={onAskDelete}
          title={t.admin.deleteGroupTitle}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-background text-muted-foreground transition hover:bg-red-50 hover:text-red-700"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {confirm?.kind === "group" && (
        <ConfirmPanel
          className="mt-3"
          message={t.admin.deleteGroupConfirm(group.name, group.members.length)}
          confirmLabel={t.admin.deleteGroup}
          busy={deleting}
          error={error}
          onConfirm={onDelete}
          onCancel={onCancel}
        />
      )}
      {removing && (
        <ConfirmPanel
          className="mt-3"
          message={
            lastOne
              ? t.admin.removeLast(removing.name, group.name)
              : t.admin.removeMember(removing.name, group.name)
          }
          confirmLabel={lastOne ? t.admin.removeAndDelete : t.admin.remove}
          busy={removingId === removing.profileId}
          error={error}
          onConfirm={() => onRemove(removing.profileId)}
          onCancel={onCancel}
        />
      )}
    </li>
  );
}
