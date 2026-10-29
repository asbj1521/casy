import { lazy, Suspense } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { adminStatusQuery } from "@/api/adminStatus";
import { whoAmIQuery } from "@/api/groups";
import DeleteAccountSection from "@/components/DeleteAccountSection";
import PasswordSection from "@/components/PasswordSection";
import { displayName, useSignedInUser } from "@/context/auth";
import { CALENDAR_ACCOUNTS_PATH } from "@/hooks/useCalendarsHome";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { useT } from "@/i18n/lang";
import { sheetAddress, sheetScreenFor } from "@/lib/profileScreens";

/** Admin mode's panel, loaded only when an admin opens it (as on the computer). */
const AdminPanel = lazy(() => import("@/components/AdminPanel"));

/**
 * The phone profile's old screen addresses (/profile/:screen): their screens
 * open inside the Profil sheet on the home page now (#174), so a phone is
 * sent there, with whatever the link carried. A computer has all of them on
 * the profile page itself, so it is sent there, with any link parameters,
 * which that page understands.
 */
export default function ProfileScreen() {
  const { screen } = useParams();
  const { search } = useLocation();
  const phone = usePhoneLayout();

  if (!phone)
    return <Navigate to={`/profile${screen === "admin" ? "?mode=admin" : search}`} replace />;
  if (screen === "calendars") {
    // Moved to the Calendar tab; old links still arrive.
    return <Navigate to={`${CALENDAR_ACCOUNTS_PATH}${search}`} replace />;
  }
  const key = sheetScreenFor(`/profile/${screen}`);
  return <Navigate to={key ? sheetAddress(key, search) : "/?profile"} replace />;
}

/** Log ind og sikkerhed, in the Profil sheet (#174). */
export function PasswordContent() {
  const user = useSignedInUser();
  const { data: whoAmI } = useQuery(whoAmIQuery(user.id));
  return <PasswordSection name={whoAmI?.name ?? displayName(user)} titled={false} />;
}

/** Slet konto, in the Profil sheet (#174). */
export function AccountContent() {
  return <DeleteAccountSection titled={false} />;
}

/** Admin mode, in the Profil sheet (#174); the server checks every action itself. */
export function AdminContent() {
  const t = useT();
  const user = useSignedInUser();
  const { data: isAdmin } = useQuery(adminStatusQuery(user.id));
  if (!isAdmin) return null;
  return (
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
  );
}
