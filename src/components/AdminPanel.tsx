import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw, Search, ShieldCheck, X } from "lucide-react";

import {
  adminDeleteGroup,
  adminDeleteUser,
  adminOverviewKey,
  adminOverviewQuery,
  adminRemoveMember,
  adminSyncConnection,
  adminSyncUser,
  type AdminOverview,
} from "@/api/admin";
import AdminCorrections from "@/components/AdminCorrections";
import AdminReports from "@/components/AdminReports";
import StatTile from "@/components/StatTile";
import Notice from "@/components/ui/Notice";
import { withoutGroup, withoutMember, withoutUser } from "@/lib/adminOverview";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { LOCALE, useLang, useT } from "@/i18n/lang";
import { cn } from "@/lib/utils";
import {
  type Tab,
  type Confirm,
  messageOf,
  matches,
  type UserImpact,
  dollars,
} from "./admin/helpers";
import GroupRow from "./admin/GroupRow";
import UserRow from "./admin/UserRow";
import ConnectionRow from "./admin/ConnectionRow";
import PushTest from "./admin/PushTest";

export default function AdminPanel({ youId }: { youId: string }) {
  const t = useT();
  const { lang } = useLang();
  const phone = usePhoneLayout();
  const queryClient = useQueryClient();
  const { data, isPending, isError, error, refetch, isFetching } = useQuery(
    adminOverviewQuery(youId),
  );
  const [tab, setTab] = useState<Tab>("groups");
  const [query, setQuery] = useState("");
  const [problemsOnly, setProblemsOnly] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [confirmUserId, setConfirmUserId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [syncResults, setSyncResults] = useState<Record<string, { ok: boolean; text: string }>>({});
  // Read once: "synced 5 min ago" doesn't need to tick while the panel is open.
  const [now] = useState(Date.now);

  /**
   * After an action succeeds: patch the overview on screen at once, so the
   * row is gone the moment the server says so, then fetch the real overview
   * in the background without making anyone wait for it. Anything an admin
   * changes can also change what the admin's own groups look like elsewhere.
   */
  const afterChange = (patch: (o: AdminOverview) => AdminOverview) => {
    queryClient.setQueryData<AdminOverview>(adminOverviewKey(youId), (o) => (o ? patch(o) : o));
    setConfirm(null);
    setConfirmUserId(null);
    void queryClient.invalidateQueries({ queryKey: adminOverviewKey(youId) });
    void queryClient.invalidateQueries({ queryKey: ["groups"] });
    void queryClient.invalidateQueries({ queryKey: ["group-busy"] });
  };

  const deleteMutation = useMutation({
    mutationFn: adminDeleteGroup,
    onSuccess: (_res, groupId) => afterChange((o) => withoutGroup(o, groupId)),
  });
  const removeMutation = useMutation({
    mutationFn: adminRemoveMember,
    onSuccess: (_res, { groupId, profileId }) =>
      afterChange((o) => withoutMember(o, groupId, profileId)),
  });
  const deleteUserMutation = useMutation({
    mutationFn: adminDeleteUser,
    onSuccess: (res, profileId) => {
      const who = data?.users.find((u) => u.id === profileId)?.name ?? t.admin.theAccount;
      setNotice(t.admin.userDeleted(who, res.deletedGroups));
      afterChange((o) => withoutUser(o, profileId));
    },
  });
  const syncMutation = useMutation({
    mutationFn: adminSyncConnection,
    onSuccess: (res, connectionId) => {
      setSyncResults((r) => ({
        ...r,
        [connectionId]: res.ok
          ? { ok: true, text: t.admin.syncedBlocks(res.busyBlocks ?? 0) }
          : { ok: false, text: res.message ?? t.admin.syncFailed },
      }));
      void queryClient.invalidateQueries({ queryKey: adminOverviewKey(youId) });
      void queryClient.invalidateQueries({ queryKey: ["calendar-status"] });
    },
    onError: (err, connectionId) => {
      setSyncResults((r) => ({
        ...r,
        [connectionId]: { ok: false, text: err.message },
      }));
    },
  });

  // A person's sync can take a while (each account in turn), so several can
  // run at once, each row spinning and reporting on its own.
  const [syncingUsers, setSyncingUsers] = useState<ReadonlySet<string>>(new Set());
  const [userSyncResults, setUserSyncResults] = useState<
    Record<string, { ok: boolean; text: string }>
  >({});
  async function syncUser(userId: string) {
    setSyncingUsers((s) => new Set(s).add(userId));
    try {
      const res = await adminSyncUser(userId);
      setUserSyncResults((r) => ({
        ...r,
        [userId]: {
          ok: res.failed === 0,
          text: t.admin.syncedUser(res.synced, res.failed, res.busyBlocks),
        },
      }));
      void queryClient.invalidateQueries({ queryKey: adminOverviewKey(youId) });
      if (userId === youId) void queryClient.invalidateQueries({ queryKey: ["calendar-status"] });
    } catch (err) {
      setUserSyncResults((r) => ({
        ...r,
        [userId]: { ok: false, text: messageOf(err, t.admin.syncFailed) },
      }));
    } finally {
      setSyncingUsers((s) => {
        const next = new Set(s);
        next.delete(userId);
        return next;
      });
    }
  }

  function ask(next: Confirm) {
    deleteMutation.reset();
    removeMutation.reset();
    setConfirm(next);
  }
  function askDeleteUser(profileId: string) {
    deleteUserMutation.reset();
    setNotice(null);
    setConfirmUserId(profileId);
  }

  /** What deleting this account would take with it, from the loaded overview. */
  const impactOf = (profileId: string): UserImpact => {
    const theirGroups = (data?.groups ?? []).filter((g) =>
      g.members.some((m) => m.profileId === profileId),
    );
    return {
      calendarAccounts: (data?.connections ?? []).filter((c) => c.ownerId === profileId).length,
      groups: theirGroups.length,
      soleGroups: theirGroups.filter((g) => g.members.length === 1).length,
    };
  };

  const groupError = (groupId: string) =>
    deleteMutation.isError && deleteMutation.variables === groupId
      ? deleteMutation.error.message
      : removeMutation.isError && removeMutation.variables.groupId === groupId
        ? removeMutation.error.message
        : null;

  const groups = useMemo(
    () =>
      (data?.groups ?? []).filter((g) =>
        matches(query, g.name, g.createdByName, ...g.members.map((m) => m.name)),
      ),
    [data, query],
  );
  const users = useMemo(
    () =>
      (data?.users ?? []).filter(
        (u) => matches(query, u.name) && (!problemsOnly || u.calendars === 0),
      ),
    [data, query, problemsOnly],
  );
  const connections = useMemo(
    () =>
      (data?.connections ?? []).filter(
        (c) =>
          matches(query, c.ownerName, t.admin.providers[c.provider]) &&
          (!problemsOnly || c.status !== "connected" || c.needsReconnect || !!c.syncError),
      ),
    [data, query, problemsOnly, t],
  );

  const tabs: { id: Tab; label: string; count: number | undefined }[] = [
    { id: "groups", label: t.admin.tabGroups, count: data?.groups.length },
    { id: "users", label: t.admin.tabUsers, count: data?.users.length },
    { id: "calendars", label: t.admin.tabCalendars, count: data?.connections.length },
  ];
  const problemsLabel = tab === "users" ? t.admin.onlyNoCalendar : t.admin.onlyProblems;
  const stats = data?.stats;

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {t.admin.title}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{t.admin.intro}</p>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="flex shrink-0 items-center gap-2 rounded-full border bg-background px-3.5 py-1.5 text-sm font-semibold text-foreground transition hover:bg-secondary disabled:opacity-60"
        >
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          {t.admin.refresh}
        </button>
      </div>

      {/* The same answer the uptime monitor gets from the health function (#88). */}
      {data && (
        <Notice tone={data.health.ok ? "success" : "error"} className="mt-4">
          {data.health.ok
            ? t.admin.healthOk
            : data.health.reason === "stale"
              ? t.admin.healthStale
              : t.admin.healthFailing}
        </Notice>
      )}

      {/* The app only: notifications switched on here, and a test sent (#139). */}
      <PushTest />

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatTile label={t.admin.statUsers} value={stats?.users ?? null} />
        <StatTile label={t.admin.statGroups} value={stats?.groups ?? null} />
        <StatTile label={t.admin.statAccounts} value={stats?.connectedAccounts ?? null} />
        <StatTile
          label={t.admin.statFailing}
          value={stats?.failingSyncs ?? null}
          alert={!!stats?.failingSyncs}
        />
        <StatTile
          label={t.admin.statBusy}
          value={stats?.busyBlocks ?? null}
          className={phone ? "col-span-2" : undefined}
        />
      </div>
      {data?.ai && (
        <div className="mt-2 text-sm text-muted-foreground">
          <p>{t.admin.aiToday(data.ai.today, data.ai.limit)}</p>
          {/* Each skill's calls and estimated cost (#111): counts only, never who. */}
          {/* `skills` is missing in answers from a function older than #111. */}
          {!!data.ai.skills?.length && (
            <ul className="mt-1 text-xs">
              {data.ai.skills.map((s) => (
                <li key={s.skill}>
                  {t.admin.aiSkill(
                    t.admin.aiSkills[s.skill] ?? s.skill,
                    s.today,
                    s.last30Days,
                    dollars(s.cost30Days, lang),
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {isError && (
        <Notice tone="error" className="mt-4">
          {error.message}
        </Notice>
      )}

      {notice && (
        <Notice tone="success" className="mt-4">
          <div className="flex items-start justify-between gap-2">
            {notice}
            <button
              type="button"
              onClick={() => setNotice(null)}
              title={t.admin.dismiss}
              aria-label={t.admin.dismiss}
              className="text-emerald-900/70 hover:text-emerald-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </Notice>
      )}

      <div className={cn("mt-6 rounded-2xl border bg-card shadow-sm", phone ? "p-3" : "p-5")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className={cn("flex rounded-full bg-secondary p-1", phone && "w-full")}>
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTab(item.id);
                  setConfirm(null);
                  setConfirmUserId(null);
                  setProblemsOnly(false);
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition",
                  // Three tabs side by side must fit a phone, even in Danish.
                  phone && "flex-auto justify-center whitespace-nowrap px-1.5 text-[13px]",
                  tab === item.id
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
                {item.count !== undefined && (
                  <span className="text-xs tabular-nums text-muted-foreground">{item.count}</span>
                )}
              </button>
            ))}
          </div>
          <div className={cn("flex flex-wrap items-center gap-3", phone && "w-full")}>
            {tab !== "groups" && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={problemsOnly}
                  onChange={(e) => setProblemsOnly(e.target.checked)}
                  className="h-4 w-4 accent-[hsl(var(--primary))]"
                />
                {problemsLabel}
              </label>
            )}
            <div className={cn("relative", phone && "w-full")}>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.admin.search}
                className={cn(
                  "rounded-full border bg-background py-1.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30",
                  phone ? "w-full" : "w-48",
                )}
              />
            </div>
          </div>
        </div>

        {isPending ? (
          <p className="mt-4 flex items-center gap-2 border-t pt-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.admin.loading}
          </p>
        ) : tab === "groups" ? (
          groups.length === 0 ? (
            <p className="mt-4 border-t pt-4 text-sm text-muted-foreground">
              {query ? t.admin.noGroupMatch : t.admin.noGroups}
            </p>
          ) : (
            <ul className="mt-4 divide-y border-t">
              {groups.map((g) => (
                <GroupRow
                  key={g.id}
                  group={g}
                  confirm={confirm?.groupId === g.id ? confirm : null}
                  deleting={deleteMutation.isPending && deleteMutation.variables === g.id}
                  removingId={
                    removeMutation.isPending && removeMutation.variables?.groupId === g.id
                      ? removeMutation.variables.profileId
                      : null
                  }
                  error={groupError(g.id)}
                  onAskDelete={() => ask({ kind: "group", groupId: g.id })}
                  onAskRemove={(profileId) => ask({ kind: "member", groupId: g.id, profileId })}
                  onCancel={() => setConfirm(null)}
                  onDelete={() => deleteMutation.mutate(g.id)}
                  onRemove={(profileId) => removeMutation.mutate({ groupId: g.id, profileId })}
                />
              ))}
            </ul>
          )
        ) : tab === "users" ? (
          <>
            {data?.usersTruncated && (
              <p className="mt-4 text-xs text-amber-700">
                {t.admin.firstOnly(data.users.length.toLocaleString(LOCALE[lang]))}
              </p>
            )}
            {users.length === 0 ? (
              <p className="mt-4 border-t pt-4 text-sm text-muted-foreground">
                {t.admin.noUserMatch}
              </p>
            ) : (
              <ul className="mt-4 divide-y border-t">
                {users.map((u, i) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    index={i}
                    isYou={u.id === youId}
                    impact={impactOf(u.id)}
                    confirming={confirmUserId === u.id}
                    deleting={deleteUserMutation.isPending && deleteUserMutation.variables === u.id}
                    error={
                      deleteUserMutation.isError && deleteUserMutation.variables === u.id
                        ? deleteUserMutation.error.message
                        : null
                    }
                    onAsk={() => askDeleteUser(u.id)}
                    onCancel={() => setConfirmUserId(null)}
                    onDelete={() => deleteUserMutation.mutate(u.id)}
                    syncing={syncingUsers.has(u.id)}
                    syncResult={userSyncResults[u.id]}
                    onSync={() => syncUser(u.id)}
                  />
                ))}
              </ul>
            )}
          </>
        ) : connections.length === 0 ? (
          <p className="mt-4 border-t pt-4 text-sm text-muted-foreground">
            {problemsOnly ? t.admin.noProblems : t.admin.noAccountMatch}
          </p>
        ) : (
          <ul className="mt-4 divide-y border-t">
            {connections.map((c) => (
              <ConnectionRow
                key={c.id}
                connection={c}
                now={now}
                syncing={syncMutation.isPending && syncMutation.variables === c.id}
                result={syncResults[c.id] ?? null}
                onSync={() => syncMutation.mutate(c.id)}
              />
            ))}
          </ul>
        )}
      </div>

      {/* What people sent when the AI got it wrong, for review (#122). */}
      <AdminReports youId={youId} />
      <AdminCorrections youId={youId} />
    </section>
  );
}
