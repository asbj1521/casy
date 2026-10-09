import { lazy, Suspense } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ShieldCheck } from "lucide-react";

import { adminStatusQuery } from "@/api/admin";
import { whoAmIQuery } from "@/api/groups";
import DeleteAccountSection from "@/components/DeleteAccountSection";
import AppearanceGroup from "@/components/profile/AppearanceGroup";
import PasswordSection from "@/components/PasswordSection";
import NameCard from "@/components/profile/NameCard";
import ProfileHub from "@/components/profile/ProfileHub";
import { BuildLine, FeedbackShareGroup, HelpGroup } from "@/components/profile/ProfileLinks";
import TopNav from "@/components/TopNav";
import { displayName, useSignedInUser } from "@/context/auth";
import { CALENDAR_ACCOUNTS_PATH, isCalendarArrival } from "@/hooks/useCalendarsHome";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { useT } from "@/i18n/lang";
import { cn } from "@/lib/utils";

/**
 * Admin mode's panel, loaded only when someone actually opens it: nobody but
 * the admin ever downloads its code.
 */
const AdminPanel = lazy(() => import("@/components/AdminPanel"));

/**
 * Your profile: who you are and your account, nothing else (groups and
 * calendars have pages of their own). On a phone, a short hub whose rows open
 * their own screens (ProfileHub, ProfileScreen); on a computer, one page.
 */
export default function Profile() {
  return usePhoneLayout() ? <ProfileHub /> : <DesktopProfile />;
}

/**
 * The computer's profile, in one centred column: the name card, signing in
 * and security, feedback and help, and deleting the account. Admins can
 * switch the page to admin mode.
 */
function DesktopProfile() {
  const user = useSignedInUser();
  const t = useT();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: whoAmI } = useQuery(whoAmIQuery(user.id));

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

  // Back from connecting Google or Outlook, or new from sign-in: calendars
  // are connected on their own page now.
  if (isCalendarArrival(searchParams)) {
    return <Navigate to={`${CALENDAR_ACCOUNTS_PATH}?${searchParams}`} replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNav />

      <main className="px-4 pb-20 pt-4 sm:px-6 lg:px-8">
        {/* Admin mode's entry point, centred on its own line (admins only). */}
        {isAdmin && (
          <div className="mb-5 flex justify-center">
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
          <div className="mx-auto max-w-2xl">
            <NameCard />
            <PasswordSection name={whoAmI?.name ?? displayName(user)} />
            <AppearanceGroup />
            <FeedbackShareGroup />
            <HelpGroup />
            <DeleteAccountSection />
            <BuildLine />
          </div>
        )}
      </main>
    </div>
  );
}
