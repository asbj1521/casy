import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { KeyRound, LogOut, ShieldCheck, Trash2 } from "lucide-react";

import { adminStatusQuery } from "@/api/adminStatus";
import GroupsRow from "@/components/profile/GroupsRow";
import NameCard from "@/components/profile/NameCard";
import SettingsRow from "@/components/profile/SettingsRow";
import { BuildLine, FeedbackShareGroup, HelpGroup } from "@/components/profile/ProfileLinks";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { useAuth, useSignedInUser } from "@/context/auth";
import { CALENDAR_ACCOUNTS_PATH, isCalendarArrival } from "@/hooks/useCalendarsHome";
import { useT } from "@/i18n/lang";

/**
 * Links into the profile and the phone screen that answers each: back from
 * connecting Google or Outlook, new from sign-in, the weak-password note, and
 * admin mode. (The computer's profile answers the last two in place.)
 */
function screenFor(params: URLSearchParams): string | null {
  if (isCalendarArrival(params)) return CALENDAR_ACCOUNTS_PATH;
  if (params.has("password")) return "/profile/password";
  if (params.get("mode") === "admin") return "/profile/admin";
  return null;
}

/**
 * The phone's /profile: the profile is a sheet over the home page now (#169,
 * ProfileSheet), so the address leads there, after the links into one of its
 * screens have been sent on to it.
 */
export default function ProfileHub() {
  const [searchParams] = useSearchParams();
  const screen = screenFor(searchParams);
  if (screen) return <Navigate to={`${screen}?${searchParams}`} replace />;
  return <Navigate to="/?profile" replace />;
}

/**
 * The phone's profile: who you are, then rows that each open their own screen
 * (ProfileScreen), so it fits in a sheet instead of the computer's long page.
 * Calendars aren't repeated here: they are on the home page itself.
 */
export function ProfileHubList() {
  const user = useSignedInUser();
  const { signOut } = useAuth();
  const t = useT();
  const navigate = useNavigate();

  const { data: isAdmin } = useQuery(adminStatusQuery(user.id));

  return (
    <>
      <NameCard />

      <ListGroup>
        <SettingsRow />
        <GroupsRow />
      </ListGroup>

      <ListGroup>
        <ListRow to="/profile/password" icon={KeyRound} label={t.profileHub.security} />
        {isAdmin && <ListRow to="/profile/admin" icon={ShieldCheck} label={t.profileHub.admin} />}
      </ListGroup>

      <FeedbackShareGroup />
      <HelpGroup />

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
        <ListRow to="/profile/account" icon={Trash2} label={t.deleteAccount.title} tone="danger" />
      </ListGroup>

      <BuildLine />
    </>
  );
}
