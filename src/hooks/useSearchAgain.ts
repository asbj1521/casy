import { useQuery, useQueryClient } from "@tanstack/react-query";

import { searchVoteAgain } from "@/api/events";
import { groupBusyQuery, groupsQuery, participantsFromGroup } from "@/api/groups";
import { useSignedInUser } from "@/context/auth";
import { TODAY } from "@/hooks/useDateSearch";
import { useEventChange } from "@/hooks/useEventChange";
import { useT } from "@/i18n/lang";
import { SEARCH_WINDOW } from "@/lib/eventSearch";
import { searchAgainDates, searchSettings, withAnswers } from "@/lib/searchAgain";
import type { VoteEvent } from "@/lib/vote";
import { APP_TIME_ZONE } from "@/lib/zone";

/**
 * Searching an open vote again (#240): who in its group it leaves out, and
 * the search itself, which adds the members picked (`add`, none to only look
 * again). The group's calendars are fetched fresh, everyone's answers to the
 * dates counted in (searchAgain.ts), and the dates found replace the vote's.
 */
export function useSearchAgain(event: VoteEvent) {
  const t = useT();
  const userId = useSignedInUser().id;
  const queryClient = useQueryClient();
  const { data: groups } = useQuery(groupsQuery(userId));
  const group = groups?.find((g) => g.id === event.group.id);
  const invited = event.invitees.map((i) => i.profileId);
  const missing = group?.members.filter((m) => !invited.includes(m.profileId)) ?? [];

  const search = useEventChange(async (add: string[]) => {
    if (!group) throw new Error(t.searchAgain.noGroup);
    const busy = await queryClient.fetchQuery({
      ...groupBusyQuery(userId, group.id, SEARCH_WINDOW.start, SEARCH_WINDOW.end),
      staleTime: 0,
    });
    const everyone = [...new Set([...invited, ...add])];
    const settings = searchSettings(
      event.settings,
      everyone,
      group.members.map((m) => m.profileId),
    );
    const { participants } = participantsFromGroup(group, busy);
    const dates = searchAgainDates(
      withAnswers(participants, event.candidates),
      settings,
      { from: TODAY, end: SEARCH_WINDOW.end, count: event.candidates.length },
      APP_TIME_ZONE,
    );
    if (!dates) throw new Error(t.searchAgain.noneFound);
    return await searchVoteAgain(event.id, { add, settings, dates });
  });

  return { missing, search };
}
