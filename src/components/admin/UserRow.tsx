import { useId, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Loader2, RefreshCw, Sparkles, Trash2, Users } from "lucide-react";

import { adminSetAiAccess, adminSetAiTester, type AdminUser } from "@/api/admin";
import Avatar from "@/components/ui/Avatar";
import ConfirmPanel from "@/components/ui/ConfirmPanel";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { useLang, useT } from "@/i18n/lang";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { type UserImpact } from "./helpers";

export default function UserRow({
  user,
  index,
  isYou,
  impact,
  confirming,
  deleting,
  error,
  onAsk,
  onCancel,
  onDelete,
  syncing,
  syncResult,
  onSync,
}: {
  user: AdminUser;
  index: number;
  isYou: boolean;
  impact: UserImpact;
  confirming: boolean;
  deleting: boolean;
  error: string | null;
  onAsk: () => void;
  onCancel: () => void;
  onDelete: () => void;
  /** Re-syncing all their calendar accounts right now. */
  syncing: boolean;
  /** How the last re-sync from here went, if there was one. */
  syncResult: { ok: boolean; text: string } | undefined;
  onSync: () => void;
}) {
  const { lang } = useLang();
  const t = useT();
  const phone = usePhoneLayout();
  const [typed, setTyped] = useState("");
  const inputId = useId();
  // Typing the name is the guard against deleting the wrong row: the button
  // stays off until it matches, ignoring case and stray spaces.
  const nameMatches = typed.trim().toLowerCase() === user.name.trim().toLowerCase();

  const parts = [
    t.admin.impactAccounts(impact.calendarAccounts),
    impact.groups === 0
      ? t.admin.impactNoGroups
      : impact.soleGroups > 0
        ? t.admin.impactSole(impact.groups, impact.soleGroups)
        : t.admin.impactGroups(impact.groups),
  ];

  const joined = (
    <>
      {t.admin.joined(formatDate(user.createdAt, lang))}
      {user.lastSignInAt && t.admin.lastSignIn(formatDate(user.lastSignInAt, lang))}
    </>
  );
  const nameLine = (
    <p className="flex items-center gap-2 truncate text-sm font-medium text-foreground">
      {user.name}
      {isYou && (
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
          {t.admin.you}
        </span>
      )}
    </p>
  );
  const syncNote = syncResult && (
    <p className={cn("mt-0.5 text-xs", syncResult.ok ? "text-emerald-700" : "text-amber-700")}>
      {syncResult.text}
    </p>
  );
  const counts = (
    <div className="flex shrink-0 gap-4 text-right text-xs text-muted-foreground">
      <span>
        <span className="block text-sm font-semibold tabular-nums text-foreground">
          {user.groups}
        </span>
        {t.admin.groupsLabel}
      </span>
      <span>
        <span
          className={cn(
            "block text-sm font-semibold tabular-nums",
            user.calendars === 0 ? "text-amber-700" : "text-foreground",
          )}
        >
          {user.calendars}
        </span>
        {t.admin.calendarsLabel}
      </span>
    </div>
  );
  // The same two numbers as a small icon and the number, for a phone's one line.
  const compactCounts = (
    <div className="flex shrink-0 items-center gap-2.5 text-sm font-semibold tabular-nums text-foreground">
      <span
        className="flex items-center gap-1"
        title={`${user.groups} ${t.admin.groupsLabel}`}
        aria-label={`${user.groups} ${t.admin.groupsLabel}`}
      >
        <Users className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        {user.groups}
      </span>
      <span
        className={cn("flex items-center gap-1", user.calendars === 0 && "text-amber-700")}
        title={`${user.calendars} ${t.admin.calendarsLabel}`}
        aria-label={`${user.calendars} ${t.admin.calendarsLabel}`}
      >
        <CalendarDays
          className={cn(
            "h-3.5 w-3.5",
            user.calendars === 0 ? "text-amber-700" : "text-muted-foreground",
          )}
          aria-hidden
        />
        {user.calendars}
      </span>
    </div>
  );
  // Every account they've linked, synced now; nothing to do without one.
  const syncButton = (
    <button
      type="button"
      onClick={onSync}
      disabled={syncing || user.calendars === 0}
      title={t.admin.syncUserTitle(user.name)}
      aria-label={t.admin.syncUserTitle(user.name)}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border bg-background text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-40",
        phone ? "h-7 w-7" : "h-8 w-8",
      )}
    >
      <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
    </button>
  );
  // Never on your own row: the server refuses it too.
  const deleteButton = isYou ? (
    <span className={cn("shrink-0", phone ? "h-7 w-7" : "h-8 w-8")} />
  ) : (
    <button
      type="button"
      onClick={() => {
        setTyped("");
        onAsk();
      }}
      title={t.admin.deleteUserTitle(user.name)}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border bg-background text-muted-foreground transition hover:bg-red-50 hover:text-red-700",
        phone ? "h-7 w-7" : "h-8 w-8",
      )}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );

  return (
    <li className="py-3">
      {phone ? (
        // A phone has no room for it all on one line, which squeezed the name
        // and the dates into a sliver: the name, the dates across the full
        // width, then the AI switches and the numbers and buttons on one line.
        <>
          <div className="flex items-center gap-3">
            <Avatar name={user.name} index={index} size="md" />
            <div className="min-w-0 flex-1">{nameLine}</div>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">{joined}</p>
          {/* One line: the AI switches from the left, the numbers and buttons from the right. */}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-2">
            <AiAccess user={user} inline />
            <div className="ml-auto flex items-center gap-2">
              {compactCounts}
              {syncButton}
              {deleteButton}
            </div>
          </div>
          {syncNote}
        </>
      ) : (
        <div className="flex items-center gap-3">
          <Avatar name={user.name} index={index} size="md" />
          <div className="min-w-0 flex-1">
            {nameLine}
            <p className="text-xs text-muted-foreground">{joined}</p>
            <AiAccess user={user} />
            {syncNote}
          </div>
          {counts}
          {syncButton}
          {deleteButton}
        </div>
      )}

      {confirming && (
        <ConfirmPanel
          className="mt-3"
          message={t.admin.deleteUserConfirm(user.name, parts.join(t.admin.and))}
          confirmLabel={t.admin.deleteAccount}
          busy={deleting}
          error={error}
          confirmDisabled={!nameMatches}
          onConfirm={onDelete}
          onCancel={onCancel}
        >
          <label htmlFor={inputId} className="mt-3 block text-xs font-medium">
            {t.admin.typeToConfirm(<span className="font-semibold">{user.name}</span>)}
          </label>
          <input
            id={inputId}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoFocus
            autoComplete="off"
            className="mt-1 w-full max-w-xs rounded-lg border border-red-200 bg-card px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-red-300"
          />
        </ConfirmPanel>
      )}
    </li>
  );
}

/**
 * One person's AI switch (#111): admins always have it; anyone else gets it
 * once switched on here, and loses it again with a second tap. Saves at once
 * and refetches the overview.
 */
function AiAccess({ user, inline = false }: { user: AdminUser; inline?: boolean }) {
  const t = useT();
  const queryClient = useQueryClient();
  const toggle = useMutation({
    mutationFn: (allowed: boolean) => adminSetAiAccess(user.id, allowed),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["admin-overview"] }),
  });
  const labels = useMutation({
    mutationFn: (allowed: boolean) => adminSetAiTester(user.id, allowed),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["admin-overview"] }),
  });
  // `inline`: on a line of its own with other things, so no space above it.
  const pill = cn(
    "inline-flex items-center gap-1 rounded-full py-0.5 text-[11px] font-medium",
    inline ? "px-1.5" : "mt-1 px-2",
  );

  // Older functions don't say (before #111): nothing to show or switch yet.
  if (!user.ai) return null;
  if (user.ai === "admin") {
    return (
      <span className={cn(pill, "bg-secondary text-muted-foreground")}>
        {!inline && <Sparkles className="h-3 w-3" aria-hidden />}
        {t.admin.aiAdmin}
      </span>
    );
  }
  const on = user.ai === "allowed";
  return (
    <span className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => toggle.mutate(!on)}
        disabled={toggle.isPending}
        aria-pressed={on}
        title={on ? t.admin.aiTurnOff(user.name) : t.admin.aiTurnOn(user.name)}
        aria-label={on ? t.admin.aiTurnOff(user.name) : t.admin.aiTurnOn(user.name)}
        className={cn(
          pill,
          "border transition disabled:opacity-50",
          on
            ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
            : "bg-background text-muted-foreground hover:bg-secondary hover:text-foreground",
        )}
      >
        {toggle.isPending ? (
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        ) : (
          !inline && <Sparkles className="h-3 w-3" aria-hidden />
        )}
        {on ? t.admin.aiAllowed : t.admin.aiOff}
      </button>
      {/* An AI tester (every admin-only AI feature): a switch of its own, once AI is on. */}
      {on && user.tester !== undefined && (
        <button
          type="button"
          onClick={() => labels.mutate(!user.tester)}
          disabled={labels.isPending}
          aria-pressed={user.tester}
          title={user.tester ? t.admin.testerTurnOff(user.name) : t.admin.testerTurnOn(user.name)}
          aria-label={
            user.tester ? t.admin.testerTurnOff(user.name) : t.admin.testerTurnOn(user.name)
          }
          className={cn(
            pill,
            "border transition disabled:opacity-50",
            user.tester
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
              : "bg-background text-muted-foreground hover:bg-secondary hover:text-foreground",
          )}
        >
          {labels.isPending && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
          {user.tester ? t.admin.testerOn : t.admin.testerOff}
        </button>
      )}
      {toggle.isError && <span className="text-[11px] text-red-700">{toggle.error.message}</span>}
      {labels.isError && <span className="text-[11px] text-red-700">{labels.error.message}</span>}
    </span>
  );
}
