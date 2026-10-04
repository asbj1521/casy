import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Trash2 } from "lucide-react";

import { disconnectCalendar, type CalendarConnectionStatus } from "@/api/calendars";
import { PROVIDER_BRANDS } from "@/components/calendarProviders";
import ConfirmPanel from "@/components/ui/ConfirmPanel";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import type { Messages } from "@/i18n/da";
import { useT } from "@/i18n/lang";
import { syncedAgo } from "@/lib/accountSummary";
import { cn } from "@/lib/utils";
import type { CalendarProvider } from "@/types";

/**
 * Every connected account in one list, whatever the provider, as the other
 * screens draw their lists (ListGroup): its mark, what it holds and when it
 * last synced, and reconnecting or removing it. "Sync now" is its last row,
 * with the outcome under the list.
 */
export default function AccountList({
  accounts,
  onReconnect,
  syncing,
  syncNote,
  onSync,
}: {
  /** Connected accounts only, in the order to show them. */
  accounts: CalendarConnectionStatus[];
  /** Pick the account again with its provider (Google, Outlook, iCloud). */
  onReconnect: (provider: CalendarProvider) => void;
  syncing: boolean;
  /** How the last "Sync now" went, if it ran. */
  syncNote: { tone: "success" | "error"; text: string } | null;
  onSync: () => void;
}) {
  const t = useT();
  return (
    <ListGroup
      title={t.calendarAccounts.accounts}
      footnote={
        syncNote && (
          <span className={syncNote.tone === "error" ? "text-red-700" : "text-emerald-700"}>
            {syncNote.text}
          </span>
        )
      }
    >
      {accounts.map((account) => (
        <AccountRow
          key={account.id}
          account={account}
          onReconnect={() => onReconnect(account.provider)}
        />
      ))}
      <ListRow
        leading={
          <RefreshCw className={cn("h-5 w-5 shrink-0 text-primary", syncing && "animate-spin")} />
        }
        tone="primary"
        label={syncing ? t.profile.syncing : t.profile.syncNow}
        onClick={syncing ? undefined : onSync}
      />
    </ListGroup>
  );
}

/** What "remove" explains, since each provider revokes access somewhere different. */
function removeNote(provider: CalendarProvider, label: string | null, t: Messages): string {
  if (provider === "ics") return t.providerCard.removeIcs(label);
  if (provider === "apple") return t.providerCard.removeApple(label);
  return t.providerCard.removeOauth(label, provider === "google" ? "Google" : "Microsoft");
}

/**
 * One account, drawn like a ListRow (its mark in front, the hairline after
 * it) but with room for a second line that wraps, a warning, its two buttons
 * and the removal's confirmation.
 */
function AccountRow({
  account,
  onReconnect,
}: {
  account: CalendarConnectionStatus;
  onReconnect: () => void;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  // On success the account is gone from the list, and this row with it; a
  // failure keeps the panel open so the reason shows and can be retried.
  const remove = useMutation({ mutationFn: () => disconnectCalendar(queryClient, account.id) });
  const brand = PROVIDER_BRANDS[account.provider];
  // The clock is read once, when the row appears: rendering must not depend
  // on the time it happens to run, and minutes-level freshness is plenty.
  const [now] = useState(Date.now);
  const synced = syncedAgo(account.last_synced_at, now, t.synced);
  const reconnect = account.needs_reconnect;

  return (
    <li className="group/row">
      <div className="flex items-start gap-3 pl-4">
        <span
          className={cn(
            "mt-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
            brand.badgeClass,
          )}
        >
          {brand.icon}
        </span>
        {/* The hairline sits on this part, so it starts after the mark. */}
        <div className="min-w-0 flex-1 border-t py-3 pr-4 group-first/row:border-t-0">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium text-foreground">
                {account.account_label ?? t.providerCard.unknownAccount}
              </p>
              <p className="text-[13px] text-muted-foreground">
                {t.calendarView.providerNames[account.provider]} ·{" "}
                {t.counts.calendars(account.calendar_sources.length)}
                {/* Too much for a phone's line; a wider screen has room. */}
                <span className="hidden sm:inline">
                  {" "}
                  · {t.counts.busyBlocks(account.busyCount)}
                </span>
                {synced && <> · {synced}</>}
                {/* A temporary failure: the busy times shown are the last good
                    ones and the next run retries, so this stays quiet. */}
                {account.sync_error && !reconnect && (
                  <span className="text-amber-700" title={account.sync_error}>
                    {" "}
                    {t.providerCard.lastSyncFailed}
                  </span>
                )}
              </p>
              {reconnect && (
                <p className="mt-0.5 text-xs font-medium text-amber-700">
                  {account.provider === "ics"
                    ? t.providerCard.linkStopped
                    : t.providerCard.accessExpired}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {account.provider !== "ics" && (
                <button
                  type="button"
                  onClick={onReconnect}
                  title={t.providerCard.reconnectTitle}
                  aria-label={t.providerCard.reconnectTitle}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border transition",
                    reconnect
                      ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                      : "bg-background text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  remove.reset();
                  setConfirming(true);
                }}
                title={t.providerCard.removeTitle}
                aria-label={t.providerCard.removeTitle}
                className="flex h-8 w-8 items-center justify-center rounded-full border bg-background text-muted-foreground transition hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {confirming && (
            <ConfirmPanel
              className="mt-3"
              message={removeNote(account.provider, account.account_label, t)}
              confirmLabel={t.providerCard.remove}
              busy={remove.isPending}
              error={remove.error?.message}
              onConfirm={() => remove.mutate()}
              onCancel={() => setConfirming(false)}
            />
          )}
        </div>
      </div>
    </li>
  );
}
