import { Navigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { groupsQuery } from "@/api/groups";
import GroupDetails from "@/components/groups/GroupDetails";
import GroupList from "@/components/groups/GroupList";
import InvitationsSection from "@/components/myEvents/InvitationsSection";
import PhoneSubHeader from "@/components/PhoneSubHeader";
import TopNav from "@/components/TopNav";
import { useSignedInUser } from "@/context/auth";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { useT } from "@/i18n/lang";

/**
 * Your groups, and the invitations waiting for your answer (/groups, and
 * /groups/:groupId for one group). A phone shows the list (its Groups tab)
 * and each group as a screen of its own; a computer shows both side by side,
 * the group in the address open on the right, else the first.
 */
export default function Groups() {
  const { groupId } = useParams();
  const phone = usePhoneLayout();
  if (phone) return groupId ? <PhoneGroupScreen groupId={groupId} /> : <GroupsPage />;
  return <GroupsPage selectedId={groupId} />;
}

/** The list (a phone) or the list beside the open group (a computer). */
function GroupsPage({ selectedId }: { selectedId?: string }) {
  const t = useT();
  const phone = usePhoneLayout();
  const youId = useSignedInUser().id;
  const { data: groups } = useQuery(groupsQuery(youId));

  // A computer always has a group open: the one asked for, else the first.
  const index =
    phone || !groups
      ? -1
      : Math.max(
          groups.findIndex((g) => g.id === selectedId),
          0,
        );
  const open = groups?.[index];
  // Asked for one that's gone (left, deleted, or never yours): the plain page.
  if (!phone && selectedId && groups && open?.id !== selectedId) {
    return <Navigate to="/groups" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="px-4 pb-16 pt-2 sm:px-6 sm:pt-0 lg:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.groupsPage.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.groupsPage.intro}</p>
        <InvitationsSection />
        {phone ? (
          <GroupList />
        ) : (
          <div className="grid items-start gap-x-8 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
            <GroupList selectedId={open?.id} privacyNote={false} />
            {open && (
              <section className="mt-6 min-w-0 rounded-2xl border bg-card/60 p-5 pt-0 sm:p-6 sm:pt-0">
                <GroupDetails group={open} index={index} youId={youId} layout="pane" />
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

/** One group on a phone, opened from the Groups tab, with a way back. */
function PhoneGroupScreen({ groupId }: { groupId: string }) {
  const t = useT();
  const youId = useSignedInUser().id;
  const { data: groups, isError } = useQuery(groupsQuery(youId));

  // The list says why it couldn't load them.
  if (isError) return <Navigate to="/groups" replace />;
  if (!groups) return null; // the groups are almost always cached already
  const index = groups.findIndex((g) => g.id === groupId);
  // Gone (left or deleted, here or elsewhere): back to the list.
  if (index === -1) return <Navigate to="/groups" replace />;
  const group = groups[index];

  return (
    <div className="min-h-screen bg-background">
      <PhoneSubHeader title={group.name} back="/groups" backLabel={t.groupsPage.title} />
      <main className="px-4 pb-8">
        <GroupDetails group={group} index={index} youId={youId} layout="screen" />
      </main>
    </div>
  );
}
