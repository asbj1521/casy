import { useEffect } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { groupsQuery } from "@/api/groups";
import GroupDetails from "@/components/groups/GroupDetails";
import GroupList from "@/components/groups/GroupList";
import InvitationsSection from "@/components/myEvents/InvitationsSection";
import TopNav from "@/components/TopNav";
import { useSignedInUser } from "@/context/auth";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { useT } from "@/i18n/lang";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { sheetAddress } from "@/lib/profileScreens";

/**
 * Your groups, and the invitations waiting for your answer (/groups, and
 * /groups/:groupId for one group). A phone opens them as screens in the
 * Profil sheet on the home page (#174, PhoneGroupsContent, PhoneGroupContent);
 * a computer shows both side by side, the group in the address open on the
 * right, else the first.
 */
export default function Groups() {
  const { groupId } = useParams();
  const phone = usePhoneLayout();
  // A phone opens them inside the Profil sheet on the home page (#174).
  if (phone)
    return <Navigate to={sheetAddress(groupId ? `groups/${groupId}` : "groups")} replace />;
  return <GroupsPage selectedId={groupId} />;
}

/** The list beside the open group (a computer). */
function GroupsPage({ selectedId }: { selectedId?: string }) {
  const t = useT();
  useDocumentTitle(t.nav.groups);
  const youId = useSignedInUser().id;
  const { data: groups } = useQuery(groupsQuery(youId));

  // A computer always has a group open: the one asked for, else the first.
  const index = !groups
    ? -1
    : Math.max(
        groups.findIndex((g) => g.id === selectedId),
        0,
      );
  const open = groups?.[index];
  // Asked for one that's gone (left, deleted, or never yours): the plain page.
  if (selectedId && groups && open?.id !== selectedId) {
    return <Navigate to="/groups" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="px-4 pb-16 pt-2 sm:px-6 sm:pt-0 lg:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.groupsPage.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.groupsPage.intro}</p>
        <InvitationsSection />
        <div className="grid items-start gap-x-8 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
          <GroupList selectedId={open?.id} privacyNote={false} />
          {open && (
            <section className="mt-6 min-w-0 rounded-2xl border bg-card/60 p-5 pt-0 sm:p-6 sm:pt-0">
              <GroupDetails group={open} index={index} youId={youId} layout="pane" />
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

/** The phone's groups, in the Profil sheet (#174): invitations, then your groups. */
export function PhoneGroupsContent() {
  return (
    <>
      <InvitationsSection />
      {/* What members see is said once, on a group's own screen. */}
      <GroupList privacyNote={false} />
    </>
  );
}

/**
 * One group on a phone, in the Profil sheet (#174), opened from the list. One
 * that is gone (left or deleted, here or elsewhere) says so to the sheet
 * (`onGone`), which goes back to the list.
 */
export function PhoneGroupContent({ groupId, onGone }: { groupId: string; onGone: () => void }) {
  const youId = useSignedInUser().id;
  const { data: groups, isError } = useQuery(groupsQuery(youId));
  const index = groups ? groups.findIndex((g) => g.id === groupId) : -2;
  const gone = isError || index === -1;
  useEffect(() => {
    if (gone) onGone();
  }, [gone, onGone]);
  if (!groups || index < 0) return null; // the groups are almost always cached already
  return <GroupDetails group={groups[index]} index={index} youId={youId} layout="screen" />;
}
