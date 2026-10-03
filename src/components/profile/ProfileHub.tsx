import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronRight,
  CircleHelp,
  KeyRound,
  Lock,
  LogOut,
  Pencil,
  ShieldCheck,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";

import { adminStatusQuery } from "@/api/admin";
import { calendarStatusQuery } from "@/api/calendars";
import {
  groupsQuery,
  invitationsQuery,
  setDisplayName,
  whoAmIQuery,
  whoAmIQueryKey,
} from "@/api/groups";
import InlineTextEdit from "@/components/InlineTextEdit";
import TopNav from "@/components/TopNav";
import Avatar from "@/components/ui/Avatar";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { displayName, useAuth, useSignedInUser } from "@/context/auth";
import { useT } from "@/i18n/lang";
import { MAX_DISPLAY_NAME_LENGTH } from "@/lib/groups";

/**
 * Links into the profile that the computer's single page answers in place,
 * and which screen answers them on a phone: back from connecting Google or
 * Outlook, new from sign-in, the weak-password note, and admin mode.
 */
function screenFor(params: URLSearchParams): string | null {
  if (params.has("connected") || params.has("error") || params.has("onboarding")) {
    return "calendars";
  }
  if (params.has("password")) return "password";
  if (params.get("mode") === "admin") return "admin";
  return null;
}

/**
 * The phone's profile: who you are and two tiles at a glance, then rows that
 * each open their own screen (ProfileScreen), so it fits on one screen
 * instead of the computer's long page.
 */
export default function ProfileHub() {
  const user = useSignedInUser();
  const { signOut } = useAuth();
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  // A name chosen here wins over the login-derived one, as on the computer.
  const { data: whoAmI } = useQuery(whoAmIQuery(user.id));
  const name = whoAmI?.name ?? displayName(user);
  const [editingName, setEditingName] = useState(false);
  const setName = useMutation({
    mutationFn: setDisplayName,
    onSuccess: (data) => {
      queryClient.setQueryData(whoAmIQueryKey(user.id), data);
      setEditingName(false);
    },
  });

  const { data: groups } = useQuery(groupsQuery(user.id));
  const { data: invitations } = useQuery(invitationsQuery(user.id));
  const { data: connections } = useQuery(calendarStatusQuery(user.id));
  const connected = connections?.filter((c) => c.status === "connected");
  const { data: isAdmin } = useQuery(adminStatusQuery(user.id));

  const screen = screenFor(searchParams);
  if (screen) return <Navigate to={`/profile/${screen}?${searchParams}`} replace />;

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="px-4 pb-8 pt-2">
        <div className="flex items-center gap-4 rounded-2xl border bg-card p-4">
          <Avatar name={name} index={0} size="lg" />
          <div className="min-w-0 flex-1">
            {editingName ? (
              <InlineTextEdit
                value={name}
                maxLength={MAX_DISPLAY_NAME_LENGTH}
                submitting={setName.isPending}
                error={setName.error?.message ?? null}
                inputClassName="text-lg font-bold"
                onSubmit={(newName) => setName.mutate(newName)}
                onCancel={() => setEditingName(false)}
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setName.reset();
                  setEditingName(true);
                }}
                aria-label={t.profile.changeName}
                className="flex w-full items-center gap-3 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-bold leading-tight text-foreground">
                    {name}
                  </span>
                  {user.email && user.email !== name && (
                    <span className="block truncate text-sm text-muted-foreground">
                      {user.email}
                    </span>
                  )}
                </span>
                <Pencil className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <Tile
            to="/groups"
            icon={Users}
            value={groups?.length}
            label={t.profile.statGroups}
            detail={invitations?.length ? t.profileHub.invitations(invitations.length) : null}
          />
          <Tile
            to="/profile/calendars"
            icon={CalendarDays}
            value={connected?.length}
            label={t.profile.statCalendars}
            detail={
              connected && t.counts.busyBlocks(connected.reduce((sum, c) => sum + c.busyCount, 0))
            }
          />
        </div>

        <ListGroup>
          <ListRow to="/profile/password" icon={KeyRound} label={t.profile.password} />
          {isAdmin && <ListRow to="/profile/admin" icon={ShieldCheck} label={t.profileHub.admin} />}
        </ListGroup>

        <ListGroup>
          <ListRow to="/how-it-works" icon={CircleHelp} label={t.footer.howItWorks} />
          <ListRow to="/privacy" icon={Lock} label={t.footer.privacy} />
        </ListGroup>

        <ListGroup>
          <ListRow
            icon={LogOut}
            label={t.nav.signOut}
            onClick={() => {
              signOut()
                .then(() => navigate("/"))
                .catch(() => undefined); // still signed in (offline): stay here
            }}
          />
          <ListRow
            to="/profile/account"
            icon={Trash2}
            label={t.deleteAccount.title}
            tone="danger"
          />
        </ListGroup>
      </main>
    </div>
  );
}

/** A square at a glance: how many, of what, and a line more; opens its screen. */
function Tile({
  to,
  icon: Icon,
  value,
  label,
  detail,
}: {
  to: string;
  icon: LucideIcon;
  value: number | undefined;
  label: string;
  detail?: string | null;
}) {
  return (
    <Link
      to={to}
      className="flex flex-col rounded-2xl border bg-card p-4 transition-colors active:bg-secondary"
    >
      <span className="flex items-center justify-between">
        <Icon className="h-5 w-5 text-primary" />
        <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
      </span>
      <span className="mt-3 text-2xl font-bold text-foreground">{value ?? "…"}</span>
      <span className="text-sm font-medium text-foreground">{label}</span>
      {/* Always a line high, so the two tiles stay the same size. */}
      <span className="mt-0.5 min-h-4 truncate text-xs text-muted-foreground">{detail}</span>
    </Link>
  );
}
