import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { adminStatusQuery } from "@/api/admin";
import { whoAmIQuery } from "@/api/groups";
import DeleteAccountSection from "@/components/DeleteAccountSection";
import PasswordSection from "@/components/PasswordSection";
import PhoneSubHeader from "@/components/PhoneSubHeader";
import { displayName, useSignedInUser } from "@/context/auth";
import { CALENDAR_ACCOUNTS_PATH } from "@/hooks/useCalendarsHome";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { useT } from "@/i18n/lang";

/** Admin mode's panel, loaded only when an admin opens it (as on the computer). */
const AdminPanel = lazy(() => import("@/components/AdminPanel"));

/**
 * One of the phone profile's screens (/profile/:screen), opened from its hub
 * (ProfileHub). A computer has all of them on the profile page itself, so it
 * is sent there, with any link parameters, which that page understands.
 */
export default function ProfileScreen() {
  const { screen } = useParams();
  const { search } = useLocation();
  const phone = usePhoneLayout();

  if (!phone)
    return <Navigate to={`/profile${screen === "admin" ? "?mode=admin" : search}`} replace />;
  switch (screen) {
    case "calendars": // moved to the Calendar tab; old links still arrive
      return <Navigate to={`${CALENDAR_ACCOUNTS_PATH}${search}`} replace />;
    case "password":
      return <PasswordScreen />;
    case "account":
      return <AccountScreen />;
    case "admin":
      return <AdminScreen />;
    default:
      return <Navigate to="/profile" replace />;
  }
}

function Screen({ title, children }: { title: string; children: ReactNode }) {
  const t = useT();
  return (
    <div className="min-h-screen bg-background">
      <PhoneSubHeader title={title} back="/profile" backLabel={t.nav.profileShort} />
      <main className="px-4 pb-8">{children}</main>
    </div>
  );
}

function PasswordScreen() {
  const t = useT();
  const user = useSignedInUser();
  const { data: whoAmI } = useQuery(whoAmIQuery(user.id));
  return (
    <Screen title={t.profileHub.security}>
      <PasswordSection name={whoAmI?.name ?? displayName(user)} titled={false} />
    </Screen>
  );
}

function AccountScreen() {
  const t = useT();
  return (
    <Screen title={t.deleteAccount.title}>
      <DeleteAccountSection titled={false} />
    </Screen>
  );
}

function AdminScreen() {
  const t = useT();
  const user = useSignedInUser();
  const { data: isAdmin } = useQuery(adminStatusQuery(user.id));
  // The server checks on every admin action; this only decides what to show.
  if (isAdmin === false) return <Navigate to="/profile" replace />;
  return (
    <Screen title={t.profileHub.admin}>
      {isAdmin && (
        <Suspense
          fallback={
            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t.profile.adminOpening}
            </p>
          }
        >
          <AdminPanel youId={user.id} />
        </Suspense>
      )}
    </Screen>
  );
}
