import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";

import { createGroup, groupsQuery, groupsQueryKey, type Group } from "@/api/groups";
import GroupsSection from "@/components/GroupsSection";
import InvitationsSection from "@/components/myEvents/InvitationsSection";
import NewGroupDialog from "@/components/NewGroupDialog";
import TopNav from "@/components/TopNav";
import Avatar from "@/components/ui/Avatar";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import Notice from "@/components/ui/Notice";
import { useSignedInUser } from "@/context/auth";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { useT } from "@/i18n/lang";

/**
 * Your groups and the invitations waiting for your answer: the phone's Groups
 * tab (TabBar). On a computer the same sections stay where they always were,
 * on the profile page and on My events, and nothing links here.
 */
export default function Groups() {
  const t = useT();
  const phone = usePhoneLayout();

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="px-4 pb-16 pt-2 sm:px-6 sm:pt-0 lg:px-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.groupsPage.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.groupsPage.intro}</p>
        <InvitationsSection />
        {phone ? <GroupList /> : <GroupsSection />}
      </main>
    </div>
  );
}

/**
 * The groups as an iPhone list: one row each, opening the group's own screen
 * (GroupScreen), and a row at the end to make a new one.
 */
function GroupList() {
  const t = useT();
  const youId = useSignedInUser().id;
  const queryClient = useQueryClient();
  const { data: groups, isPending, isError } = useQuery(groupsQuery(youId));
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const create = useMutation({
    mutationFn: createGroup,
    onSuccess: (data) => {
      queryClient.setQueryData(groupsQueryKey(youId), data.groups);
      setNewGroupOpen(false);
    },
  });

  if (isPending) {
    return (
      <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t.groupsSection.loading}
      </p>
    );
  }
  if (isError) {
    return (
      <Notice tone="error" bare className="mt-6">
        {t.groupsSection.loadFailed}
      </Notice>
    );
  }

  return (
    <>
      <ListGroup
        title={t.groupsSection.title}
        footnote={groups.length === 0 ? t.groupsPage.empty : t.groupPanel.whatMembersSeeBody}
      >
        {groups.map((group, i) => (
          <ListRow
            key={group.id}
            to={`/groups/${group.id}`}
            leading={<Avatar name={group.name} index={i} size="row" />}
            label={group.name}
            detail={memberLine(group, t.groupsPage.you)}
          />
        ))}
        <ListRow
          icon={Plus}
          tone="primary"
          label={t.groupsSection.makeGroup}
          onClick={() => {
            create.reset();
            setNewGroupOpen(true);
          }}
        />
      </ListGroup>

      <NewGroupDialog
        open={newGroupOpen}
        submitting={create.isPending}
        error={create.error?.message ?? null}
        onSubmit={(group) => create.mutate(group)}
        onCancel={() => setNewGroupOpen(false)}
      />
    </>
  );
}

/** Who's in it, you first: "Dig, Simon, Maja". */
function memberLine(group: Group, you: string): string {
  return [...group.members]
    .sort((a, b) => Number(b.isYou) - Number(a.isYou))
    .map((m) => (m.isYou ? you : m.name))
    .join(", ");
}
