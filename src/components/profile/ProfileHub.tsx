import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { KeyRound, LogOut, ShieldCheck, Trash2 } from "lucide-react";

import { adminStatusQuery } from "@/api/admin";
import AppearanceGroup from "@/components/profile/AppearanceGroup";
import NameCard from "@/components/profile/NameCard";
import { BuildLine, FeedbackShareGroup, HelpGroup } from "@/components/profile/ProfileLinks";
import TopNav from "@/components/TopNav";
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
 * The phone's profile: who you are, then rows that each open their own screen
 * (ProfileScreen), so it fits on one screen instead of the computer's long
 * page. Groups and calendars aren't repeated here: they have their own tabs.
 */
export default function ProfileHub() {
  const user = useSignedInUser();
  const { signOut } = useAuth();
  const t = useT();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { data: isAdmin } = useQuery(adminStatusQuery(user.id));

  const screen = screenFor(searchParams);
  if (screen) return <Navigate to={`${screen}?${searchParams}`} replace />;

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="px-4 pb-8 pt-2">
        <NameCard />

        <ListGroup>
          <ListRow to="/profile/password" icon={KeyRound} label={t.profileHub.security} />
          {isAdmin && <ListRow to="/profile/admin" icon={ShieldCheck} label={t.profileHub.admin} />}
        </ListGroup>

        <AppearanceGroup />
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
          <ListRow
            to="/profile/account"
            icon={Trash2}
            label={t.deleteAccount.title}
            tone="danger"
          />
        </ListGroup>

        <BuildLine />
      </main>
    </div>
  );
}
