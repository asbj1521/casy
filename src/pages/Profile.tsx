import { lazy, Suspense, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, LogOut, Pencil, ShieldCheck } from "lucide-react";

import { adminStatusQuery } from "@/api/admin";
import { calendarStatusQuery } from "@/api/calendars";
import { groupsQuery, setDisplayName, whoAmIQuery, whoAmIQueryKey } from "@/api/groups";
import CalendarReturnNotice from "@/components/CalendarReturnNotice";
import CalendarsSection from "@/components/CalendarsSection";
import DeleteAccountSection from "@/components/DeleteAccountSection";
import GroupsSection from "@/components/GroupsSection";
import InlineTextEdit from "@/components/InlineTextEdit";
import PasswordSection from "@/components/PasswordSection";
import ProfileHub from "@/components/profile/ProfileHub";
import TopNav from "@/components/TopNav";
import Avatar from "@/components/ui/Avatar";
import { displayName, useAuth, useSignedInUser } from "@/context/auth";
import { useCalendarReturn } from "@/hooks/useCalendarReturn";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { useT } from "@/i18n/lang";
import { MAX_DISPLAY_NAME_LENGTH } from "@/lib/groups";
import { cn } from "@/lib/utils";

/**
 * Admin mode's panel, loaded only when someone actually opens it: nobody but
 * the admin ever downloads its code.
 */
const AdminPanel = lazy(() => import("@/components/AdminPanel"));

/**
 * Your profile. On a phone, a short hub whose rows open their own screens
 * (ProfileHub, ProfileScreen); on a computer, everything on one page.
 */
export default function Profile() {
  return usePhoneLayout() ? <ProfileHub /> : <DesktopProfile />;
}

/**
 * The computer's profile: who you are (click the avatar to change the name
 * your groups see) with a few counts, then your calendars, your groups, your
 * password, and deleting the account. Admins can switch the page to admin mode.
 */
function DesktopProfile() {
  const user = useSignedInUser();
  const { signOut } = useAuth();
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // A name chosen here wins over the login-derived one; until that first
  // load lands, the login's stands in so the header is never empty.
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

  // The counts beside the name (the sections below read the same, cached).
  const { data: groups } = useQuery(groupsQuery(user.id));
  const { data: connections } = useQuery(calendarStatusQuery(user.id));
  const connected = connections?.filter((c) => c.status === "connected");

  // Admin mode. The server says whether this person is an admin (and checks
  // again on every admin action); the page only uses the answer to decide
  // whether to show the button. Kept in the URL so a refresh stays put.
  const { data: isAdmin } = useQuery(adminStatusQuery(user.id));
  const adminMode = isAdmin === true && searchParams.get("mode") === "admin";
  const toggleAdminMode = () =>
    setSearchParams((params) => {
      if (adminMode) params.delete("mode");
      else params.set("mode", "admin");
      return params;
    });

  // Back from connecting Google or Outlook, or new from sign-in.
  const oauthReturn = useCalendarReturn(user.id);

  return (
    <div className="min-h-screen bg-background">
      <TopNav />

      <main className="px-4 pb-20 pt-4 sm:px-6 lg:px-8">
        {/* Admin mode's entry point, centred on its own line (admins only). */}
        {isAdmin && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={toggleAdminMode}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition sm:text-sm",
                adminMode
                  ? "border bg-background text-foreground hover:bg-secondary"
                  : "bg-foreground uppercase text-background hover:opacity-90",
              )}
            >
              <ShieldCheck className="h-4 w-4" />
              {adminMode ? t.profile.adminExit : t.profile.adminEnter}
            </button>
          </div>
        )}

        {oauthReturn && <CalendarReturnNotice outcome={oauthReturn} className="mt-4" />}

        {/* Who this is, and how much Casy is doing for them, at a glance. */}
        <div className="mt-5 rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => {
                setName.reset();
                setEditingName(true);
              }}
              title={t.profile.changeName}
              aria-label={t.profile.changeName}
              className="group relative shrink-0 rounded-full"
            >
              <Avatar name={name} index={0} size="lg" />
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                <Pencil className="h-5 w-5 text-white" />
              </span>
            </button>
            <div className="min-w-0 flex-1">
              {editingName ? (
                <InlineTextEdit
                  value={name}
                  maxLength={MAX_DISPLAY_NAME_LENGTH}
                  submitting={setName.isPending}
                  error={setName.error?.message ?? null}
                  inputClassName="text-xl font-bold"
                  onSubmit={(newName) => setName.mutate(newName)}
                  onCancel={() => setEditingName(false)}
                />
              ) : (
                <p className="flex min-w-0 flex-col sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-2">
                  <span className="truncate text-xl font-bold leading-tight text-foreground">
                    {name}
                  </span>
                  {/* Under a Google name, the email says which account this is;
                      when the email is already the name, it would only repeat it. */}
                  {user.email && user.email !== name && (
                    <span className="truncate text-sm text-muted-foreground">{user.email}</span>
                  )}
                </p>
              )}
            </div>
            <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:shrink-0 sm:flex-wrap sm:items-center">
              <Count value={groups?.length}>{t.profile.statGroups}</Count>
              <Count value={connected?.length}>{t.profile.statCalendars}</Count>
              <Count value={connected?.reduce((sum, c) => sum + c.busyCount, 0)}>
                {t.profile.statBusy}
              </Count>
            </div>
          </div>
        </div>

        {adminMode ? (
          <Suspense
            fallback={
              <p className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t.profile.adminOpening}
              </p>
            }
          >
            <AdminPanel youId={user.id} />
          </Suspense>
        ) : (
          <>
            <CalendarsSection />
            <GroupsSection />
            <PasswordSection name={name} />
            <DeleteAccountSection />
          </>
        )}

        {/* The nav has no room for Sign out on a phone, so it lives here. */}
        <button
          type="button"
          onClick={() => {
            signOut()
              .then(() => navigate("/"))
              .catch(() => undefined); // still signed in (offline): stay here
          }}
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-full border bg-background px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-secondary sm:hidden"
        >
          <LogOut className="h-4 w-4" />
          {t.nav.signOut}
        </button>
      </main>
    </div>
  );
}

/** One count beside the name; "…" until its answer has arrived. */
function Count({ value, children }: { value: number | undefined; children: ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground">
      <span className="text-sm font-bold text-foreground">{value ?? "…"}</span>
      {children}
    </div>
  );
}
