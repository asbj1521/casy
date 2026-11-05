import { useId, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserRound } from "lucide-react";

import {
  groupsQueryKey,
  setDisplayName,
  whoAmIQuery,
  whoAmIQueryKey,
  type WhoAmI,
} from "@/api/groups";
import { eventsQueryKey } from "@/api/events";
import GroupPill from "@/components/calendarView/GroupPill";
import HomePill from "@/components/calendarView/HomePill";
import { FIELD, FIELD_LABEL } from "@/components/ui/field";
import FlowButton from "@/components/ui/FlowButton";
import Notice from "@/components/ui/Notice";
import Sheet from "@/components/ui/Sheet";
import { useSignedInUser } from "@/context/auth";
import { useT } from "@/i18n/lang";
import { MAX_DISPLAY_NAME_LENGTH } from "@/lib/groups";

/** "Annuller": until the app or page is opened again, as the import ask. */
const namePutAway = { done: false };

/**
 * The home page's next step, in the vote pill's spot. Someone with no name
 * (#170: a Hide My Email sign-in with Apple's name removed) shows as "Nogen"
 * to their group and may never know, so choosing a name comes first, before
 * inviting anyone (GroupPill).
 */
export default function HomeNextStep({ hidden }: { hidden: boolean }) {
  const t = useT();
  const userId = useSignedInUser().id;
  const queryClient = useQueryClient();
  const { data: me } = useQuery(whoAmIQuery(userId));
  const nameId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const [naming, setNaming] = useState(false);
  const [later, setLater] = useState(() => namePutAway.done);
  const [name, setName] = useState("");
  const wanted = !!me?.unnamed && !later;

  const save = useMutation({
    mutationFn: setDisplayName,
    onSuccess: (data) => {
      queryClient.setQueryData<WhoAmI>(
        whoAmIQueryKey(userId),
        (w) => w && { ...w, name: data.name, unnamed: false },
      );
      // The new name stands in the groups and events lists too.
      void queryClient.invalidateQueries({ queryKey: groupsQueryKey(userId) });
      void queryClient.invalidateQueries({ queryKey: eventsQueryKey(userId) });
      setNaming(false);
    },
  });

  function cancel() {
    namePutAway.done = true;
    setLater(true);
    setNaming(false);
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (name.trim() && !save.isPending) save.mutate(name.trim());
  }

  return (
    <>
      <GroupPill hidden={hidden || wanted || naming} />
      {wanted && (
        <HomePill
          icon={UserRound}
          hidden={hidden || naming}
          buttonRef={button}
          onClick={() => setNaming(true)}
        >
          {t.homeNudge.chooseName}
        </HomePill>
      )}
      <Sheet
        open={naming}
        onClose={cancel}
        title={t.homeNudge.nameTitle}
        closeLabel={t.common.cancel}
        onSubmit={submit}
        busy={save.isPending}
        footer={
          <FlowButton type="submit" disabled={!name.trim()} busy={save.isPending}>
            {t.common.save}
          </FlowButton>
        }
      >
        <label htmlFor={nameId} className={FIELD_LABEL}>
          {t.homeNudge.nameLabel}
        </label>
        <input
          id={nameId}
          type="text"
          required
          autoFocus
          autoComplete="name"
          maxLength={MAX_DISPLAY_NAME_LENGTH}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`${FIELD} font-semibold`}
        />
        <p className="mt-2 text-xs text-muted-foreground">{t.homeNudge.nameNote}</p>
        {save.isError && (
          <Notice tone="error" className="mt-3">
            {save.error.message}
          </Notice>
        )}
      </Sheet>
    </>
  );
}
