import { useId, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createGroup, groupsQueryKey } from "@/api/groups";
import { setGroupPicture } from "@/api/pictures";
import InviteBody, { SendButton } from "@/components/groups/InviteBody";
import PictureButton from "@/components/pictures/PictureButton";
import Avatar from "@/components/ui/Avatar";
import { FIELD, FIELD_LABEL } from "@/components/ui/field";
import FlowButton from "@/components/ui/FlowButton";
import Notice from "@/components/ui/Notice";
import Sheet from "@/components/ui/Sheet";
import { SWAP } from "@/components/ui/swap";
import { useSignedInUser } from "@/context/auth";
import { useInvite } from "@/hooks/useInvite";
import { useOpenRound } from "@/hooks/useOpenRound";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { useT } from "@/i18n/lang";
import { MAX_GROUP_DESCRIPTION_LENGTH, MAX_GROUP_NAME_LENGTH } from "@/lib/groups";
import { pictureUrl } from "@/lib/pictureFile";

/**
 * "New group" (#153), two steps in one sheet: the name and, if wanted, what the
 * group is for (#152), on a phone with its picture above them (#225), and "Næste" makes the group; then the same sheet is that group's Invite (contacts, people from
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
  const descriptionId = useId();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const phone = usePhoneLayout();
  const [picture, setPicture] = useState<string | null>(null);
  const [unreadable, setUnreadable] = useState<string | null>(null);
  const [made, setMade] = useState<{ id: string; name: string } | null>(null);
  // Called before the group exists too (hooks can't wait); nothing in it runs until then.
  // On a phone sending ends it, so one press finishes the whole thing (#227).
  const invite = useInvite(made ?? { id: "", name }, phone ? close : undefined);

  const create = useMutation({
    // The picture needs the group to exist, so it follows. Without it the
    // group is still made: the next step says so, and the group's screen can add it.
    mutationFn: async (group: { name: string; description?: string }) => {
      const data = await createGroup(group);
      if (!picture) return { ...data, pictureLost: false };
      try {
        const url = await setGroupPicture(data.createdId, picture);
        const groups = data.groups.map((g) =>
          g.id === data.createdId ? { ...g, pictureUrl: url } : g,
        );
        return { ...data, groups, pictureLost: false };
      } catch {
        return { ...data, pictureLost: true };
      }
    },
    onSuccess: (data, group) => {
      queryClient.setQueryData(groupsQueryKey(userId), data.groups);
      setMade({ id: data.createdId, name: group.name });
      onCreated(data.createdId);
    },
  });

  function close() {
    if (made) onDone?.(made.id);
    onClose();
  }

  function handleName(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (name.trim() && !create.isPending) {
      create.mutate({ name: name.trim(), description: description.trim() || undefined });
    }
  }

  const nameStep = (
    <>
      {phone && (
        <div className="mb-5 flex flex-col items-center">
          <PictureButton
            label={picture ? t.pictures.changeGroup : t.pictures.addGroup}
            busy={false}
            onPicked={(image) => {
              setUnreadable(null);
              setPicture(image);
            }}
            onError={setUnreadable}
          >
            <Avatar
              name={name.trim()}
              index={0}
              size="lg"
              src={picture && pictureUrl(picture)}
              className="h-28 w-28 bg-secondary text-[2.5rem] text-foreground short:h-20 short:w-20 short:text-[2rem]"
            />
          </PictureButton>
          {picture && (
            <button
              type="button"
              onClick={() => setPicture(null)}
              className="hit mt-2 text-[0.8125rem] font-medium text-primary"
            >
              {t.pictures.remove}
            </button>
          )}
          {unreadable && (
            <Notice tone="error" bare className="mt-2">
              {unreadable}
            </Notice>
          )}
        </div>
      )}
      <label htmlFor={nameId} className={FIELD_LABEL}>
        {t.newGroup.nameLabel}
      </label>
      <input
        id={nameId}
        type="text"
        required
        // On a phone the keyboard would cover what is being made.
        autoFocus={!phone}
        maxLength={MAX_GROUP_NAME_LENGTH}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t.newGroup.placeholder}
        className={`${FIELD} font-semibold`}
      />
      <label htmlFor={descriptionId} className={`${FIELD_LABEL} mt-4`}>
        {t.newGroup.descriptionLabel}
      </label>
      <input
        id={descriptionId}
        type="text"
        maxLength={MAX_GROUP_DESCRIPTION_LENGTH}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={t.newGroup.descriptionPlaceholder}
        className={FIELD}
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
          {made ? (
            <>
              {create.data?.pictureLost && (
                <Notice tone="error" bare className="mb-3">
                  {t.newGroup.pictureLost}
                </Notice>
              )}
              <InviteBody invite={invite} />
            </>
          ) : (
            nameStep
          )}
        </motion.div>
      </AnimatePresence>
    </Sheet>
  );
}
