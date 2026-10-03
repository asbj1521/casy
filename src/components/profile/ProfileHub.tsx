import { useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CircleHelp,
  KeyRound,
  Lock,
  LogOut,
  MessageSquare,
  Pencil,
  Share,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import { adminStatusQuery } from "@/api/admin";
import { setDisplayName, whoAmIQuery, whoAmIQueryKey } from "@/api/groups";
import InlineTextEdit from "@/components/InlineTextEdit";
import TopNav from "@/components/TopNav";
import Avatar from "@/components/ui/Avatar";
import CopyField from "@/components/ui/CopyField";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { displayName, useAuth, useSignedInUser } from "@/context/auth";
import { CALENDAR_ACCOUNTS_PATH } from "@/hooks/useCalendarsHome";
import { useT } from "@/i18n/lang";
import { APP_BUILD, feedbackMailto } from "@/lib/feedback";
import { MAX_DISPLAY_NAME_LENGTH } from "@/lib/groups";
import { isNativeApp } from "@/lib/nativeApp";
import { shareLink } from "@/lib/share";

/** What "Share Casy" hands on. */
const CASY_URL = "https://casy.app";

/**
 * Links into the profile that the computer's single page answers in place,
 * and which screen answers them on a phone: back from connecting Google or
 * Outlook, new from sign-in, the weak-password note, and admin mode.
 */
function screenFor(params: URLSearchParams): string | null {
  if (params.has("connected") || params.has("error") || params.has("onboarding")) {
    return CALENDAR_ACCOUNTS_PATH;
  }
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

  const { data: isAdmin } = useQuery(adminStatusQuery(user.id));

  // The phone's share sheet; where there is none (a computer, or a dev
  // server's http:// address), the link is shown to copy instead.
  const [showLink, setShowLink] = useState(false);
  function shareCasy() {
    void shareLink({ title: "Casy", text: t.profileHub.shareText, url: CASY_URL }).then((opened) =>
      setShowLink(!opened),
    );
  }

  const screen = screenFor(searchParams);
  if (screen) return <Navigate to={`${screen}?${searchParams}`} replace />;

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

        <ListGroup>
          <ListRow to="/profile/password" icon={KeyRound} label={t.profileHub.security} />
          {isAdmin && <ListRow to="/profile/admin" icon={ShieldCheck} label={t.profileHub.admin} />}
        </ListGroup>

        <ListGroup>
          <ListRow
            icon={MessageSquare}
            label={t.profileHub.feedback}
            onClick={() => {
              window.location.href = feedbackMailto({
                subject: t.profileHub.feedbackSubject,
                prompt: t.profileHub.feedbackPrompt,
                build: APP_BUILD,
                platform: isNativeApp ? "app" : "web",
                userAgent: navigator.userAgent,
              });
            }}
          />
          <ListRow icon={Share} label={t.profileHub.share} onClick={shareCasy} />
        </ListGroup>
        {showLink && <CopyField value={CASY_URL} label={t.profileHub.share} className="mt-2" />}

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

        {/* Which build this is, for anyone reporting a bug. */}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          {t.profileHub.version(APP_BUILD)}
        </p>
      </main>
    </div>
  );
}
