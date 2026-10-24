import { AlertTriangle, CheckCircle2, RefreshCw, XCircle } from "lucide-react";

import { type AdminConnection } from "@/api/admin";
import { syncedAgo } from "@/lib/accountSummary";
import { useT } from "@/i18n/lang";
import { cn } from "@/lib/utils";

export default function ConnectionRow({
  connection,
  now,
  syncing,
  result,
  onSync,
}: {
  connection: AdminConnection;
  now: number;
  syncing: boolean;
  result: { ok: boolean; text: string } | null;
  onSync: () => void;
}) {
  const t = useT();
  const c = connection;
  const broken = c.status === "connected" && (c.needsReconnect || !!c.syncError);
  const synced = syncedAgo(c.lastSyncedAt, now, t.synced);

  return (
    <li className="py-3">
      <div className="flex items-center gap-3">
        {c.status !== "connected" ? (
          <XCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : broken ? (
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
        ) : (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {c.ownerName}{" "}
            <span className="font-normal text-muted-foreground">
              · {t.admin.providers[c.provider]}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            {c.status === "connected"
              ? `${t.counts.calendars(c.calendars)} · ${synced ?? t.admin.neverSynced}`
              : c.status === "pending"
                ? t.admin.connectingNeverFinished
                : t.admin.connectingFailed}
          </p>
          {c.needsReconnect ? (
            <p className="mt-0.5 text-xs font-medium text-amber-700">{t.admin.needsReconnect}</p>
          ) : (
            c.syncError && <p className="mt-0.5 text-xs text-amber-700">{c.syncError}</p>
          )}
          {result && (
            <p
              className={cn(
                "mt-0.5 text-xs font-medium",
                result.ok ? "text-emerald-700" : "text-red-700",
              )}
            >
              {result.text}
            </p>
          )}
        </div>
        {c.status === "connected" && (
          <button
            type="button"
            onClick={onSync}
            disabled={syncing}
            title={t.admin.syncTitle}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-background text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-60"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
          </button>
        )}
      </div>
    </li>
  );
}

/**
 * Admin mode: the whole of Casy at a glance, for the project owner only.
 *
 * Overview numbers first, then one tab each for groups (delete any, or remove
 * someone from one), users, and calendar health (re-sync an account). The
 * server decides who may see this and checks again on every action; see the
 * `admin` Edge Function.
 */
