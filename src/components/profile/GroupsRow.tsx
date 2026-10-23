import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";

import { invitationsQuery } from "@/api/groups";
import { ListRow } from "@/components/ui/ListGroup";
import { useSignedInUser } from "@/context/auth";
import { useT } from "@/i18n/lang";

/**
 * The phone's way into Your groups: a row of the profile (the tab bar has no
 * Groups tab), with the number of invitations waiting for an answer, the same
 * count the Profile tab carries.
 */
export default function GroupsRow() {
  const t = useT();
  const youId = useSignedInUser().id;
  const { data: invitations } = useQuery(invitationsQuery(youId));
  const waiting = invitations?.length ?? 0;
  return (
    <ListRow
      to="/groups"
      icon={Users}
      label={t.groupsPage.title}
      value={
        waiting > 0 ? (
          <span
            aria-label={t.nav.waitingForAnswer(waiting)}
            className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold leading-none text-primary-foreground"
          >
            {waiting}
          </span>
        ) : null
      }
    />
  );
}
