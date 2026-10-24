import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronRight, Loader2, Trash2 } from "lucide-react";

import {
  adminDeleteGroup,
  adminReportHandled,
  adminReportsKey,
  adminReportsQuery,
  type AdminReport,
} from "@/api/admin";
import ConfirmPanel from "@/components/ui/ConfirmPanel";
import Notice from "@/components/ui/Notice";
import { LOCALE, useLang, useT } from "@/i18n/lang";
import { cn } from "@/lib/utils";

/**
 * What people reported (#142), in admin mode: what it was about, why, their
 * note and the text as it was when reported, never who sent it. "Klaret"
 * deletes a report; "Slet gruppen" deletes the group it came from (asked
 * first). Folded away until opened, like the corrections above it.
 */
export default function AdminReports({ youId }: { youId: string }) {
  const t = useT();
  const words = t.safety.admin;
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data, isPending, isError, error } = useQuery(adminReportsQuery(youId));
  const drop = (id: string) =>
    queryClient.setQueryData<AdminReport[]>(adminReportsKey(youId), (old) =>
      old?.filter((r) => r.id !== id),
    );
  const handled = useMutation({ mutationFn: adminReportHandled, onSuccess: (_d, id) => drop(id) });

  return (
    <div className="mt-4 rounded-2xl border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <ChevronRight
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-90",
          )}
        />
        <span className="text-sm font-semibold text-foreground">{words.title}</span>
        {data && <span className="text-xs tabular-nums text-muted-foreground">{data.length}</span>}
      </button>
      {open && (
        <div className="border-t px-4 pb-4 pt-3">
          <p className="text-xs text-muted-foreground">{words.intro}</p>
          {isPending && (
            <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t.admin.loading}
            </p>
          )}
          {isError && (
            <Notice tone="error" className="mt-3">
              {error.message}
            </Notice>
          )}
          {data && data.length === 0 && (
            <p className="mt-3 text-sm text-muted-foreground">{words.none}</p>
          )}
          {data && data.length > 0 && (
            <ul className="mt-3 divide-y border-t">
              {data.map((r) => (
                <ReportRow
                  key={r.id}
                  report={r}
                  handling={handled.isPending && handled.variables === r.id}
                  onHandled={() => handled.mutate(r.id)}
                  onGroupDeleted={() => drop(r.id)}
                />
              ))}
            </ul>
          )}
          {handled.isError && (
            <Notice tone="error" bare className="mt-2">
              {handled.error.message}
            </Notice>
          )}
        </div>
      )}
    </div>
  );
}

function ReportRow({
  report,
  handling,
  onHandled,
  onGroupDeleted,
}: {
  report: AdminReport;
  handling: boolean;
  onHandled: () => void;
  onGroupDeleted: () => void;
}) {
  const t = useT();
  const { lang } = useLang();
  const words = t.safety.admin;
  const [confirming, setConfirming] = useState(false);
  const removeGroup = useMutation({
    mutationFn: () => adminDeleteGroup(report.groupId!),
    onSuccess: onGroupDeleted,
  });
  const c = report.content;
  const reason = t.safety.reasons[report.reason as keyof typeof t.safety.reasons] ?? report.reason;

  return (
    <li className="py-3 text-sm">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">
            {words.kinds[report.kind] ?? report.kind} · {reason}
          </p>
          {c.groupName && <p className="break-words text-muted-foreground">{c.groupName}</p>}
          {c.groupDescription && (
            <p className="break-words text-muted-foreground">{c.groupDescription}</p>
          )}
          {c.memberName && <p className="break-words text-foreground">{c.memberName}</p>}
          {c.title && <p className="break-words text-foreground">{c.title}</p>}
          {c.place && <p className="break-words text-muted-foreground">{c.place}</p>}
          {c.note && <p className="break-words text-muted-foreground">{c.note}</p>}
          {report.note && (
            <p className="mt-1 break-words italic text-foreground">“{report.note}”</p>
          )}
          <p className="mt-1 text-[11px] text-muted-foreground">
            {new Date(report.createdAt).toLocaleDateString(LOCALE[lang], {
              day: "numeric",
              month: "short",
            })}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <button
            type="button"
            onClick={onHandled}
            disabled={handling}
            className="flex items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-xs font-medium text-foreground transition hover:bg-secondary disabled:opacity-60"
          >
            <Check className="h-3.5 w-3.5" />
            {words.handled}
          </button>
          {report.groupId && !confirming && (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="flex items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-xs font-medium text-red-700 transition hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {words.deleteGroup}
            </button>
          )}
        </div>
      </div>
      {confirming && (
        <ConfirmPanel
          className="mt-2"
          message={words.deleteGroupConfirm(c.groupName ?? "")}
          confirmLabel={words.deleteGroup}
          busy={removeGroup.isPending}
          error={removeGroup.error?.message}
          onConfirm={() => removeGroup.mutate()}
          onCancel={() => setConfirming(false)}
        />
      )}
    </li>
  );
}
