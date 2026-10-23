import { useId, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createGroup, groupsQueryKey } from "@/api/groups";
import InviteBody, { SendButton } from "@/components/groups/InviteBody";
import { FIELD, FIELD_LABEL } from "@/components/ui/field";
import FlowButton from "@/components/ui/FlowButton";
import Notice from "@/components/ui/Notice";
import Sheet from "@/components/ui/Sheet";
import { SWAP } from "@/components/ui/swap";
import { useSignedInUser } from "@/context/auth";
import { useInvite } from "@/hooks/useInvite";
import { useOpenRound } from "@/hooks/useOpenRound";
import { useT } from "@/i18n/lang";
import { MAX_GROUP_NAME_LENGTH } from "@/lib/groups";

/**
 * "New group" (#153), two steps in one sheet: the name, and "Næste" makes the
 * group; then the same sheet is that group's Invite (contacts, people from
 * your groups, email, a link). Making it and inviting to it are kept apart,
 * as they are everywhere else. `onCreated` tells the page the moment the
 * group exists (the planner picks it); `onDone` once the sheet is closed
 * after it (My groups opens it). Only opened by someone signed in.
 */
export default function NewGroupDialog({
  open,
  onClose,
  onCreated,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (groupId: string) => void;
  onDone?: (groupId: string) => void;
}) {
  // A new round each time it opens: an empty name, back on the first step.
  return (
    <NewGroupSheet
      key={useOpenRound(open)}
      open={open}
      onClose={onClose}
      onCreated={onCreated}
      onDone={onDone}
    />
  );
}

function NewGroupSheet({
  open,
  onClose,
  onCreated,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (groupId: string) => void;
  onDone?: (groupId: string) => void;
}) {
  const t = useT();
  const userId = useSignedInUser().id;
  const queryClient = useQueryClient();
  const nameId = useId();
  const [name, setName] = useState("");
  const [made, setMade] = useState<{ id: string; name: string } | null>(null);
  // Called before the group exists too (hooks can't wait); nothing in it runs until then.
  const invite = useInvite(made ?? { id: "", name });

  const create = useMutation({
    mutationFn: (groupName: string) => createGroup({ name: groupName }),
    onSuccess: (data, groupName) => {
      queryClient.setQueryData(groupsQueryKey(userId), data.groups);
      setMade({ id: data.createdId, name: groupName });
      onCreated(data.createdId);
    },
  });

  function close() {
    if (made) onDone?.(made.id);
    onClose();
  }

  function handleName(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (name.trim() && !create.isPending) create.mutate(name.trim());
  }

  const nameStep = (
    <>
      <label htmlFor={nameId} className={FIELD_LABEL}>
        {t.newGroup.nameLabel}
      </label>
      <input
        id={nameId}
        type="text"
        required
        autoFocus
        maxLength={MAX_GROUP_NAME_LENGTH}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t.newGroup.placeholder}
        className={`${FIELD} font-semibold`}
      />
      {create.isError && (
        <Notice tone="error" className="mt-3">
          {create.error.message}
        </Notice>
      )}
    </>
  );

  return (
    <Sheet
      open={open}
      onClose={close}
      title={made ? t.invite.title(made.name) : t.newGroup.title}
      closeLabel={made ? t.common.done : t.common.cancel}
      onSubmit={made ? invite.submit : handleName}
      busy={create.isPending}
      footer={
        made ? (
          <SendButton invite={invite} />
        ) : (
          <FlowButton type="submit" disabled={!name.trim()} busy={create.isPending}>
            {t.newGroup.next}
          </FlowButton>
        )
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={made ? "invite" : "name"} {...SWAP}>
          {made ? <InviteBody invite={invite} /> : nameStep}
        </motion.div>
      </AnimatePresence>
    </Sheet>
  );
}
