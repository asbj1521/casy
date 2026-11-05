import { useId, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { describeGroup, groupsQueryKey, renameGroup, type Group } from "@/api/groups";
import { removeGroupPicture, setGroupPicture } from "@/api/pictures";
import PictureButton from "@/components/pictures/PictureButton";
import Avatar from "@/components/ui/Avatar";
import { FIELD, FIELD_LABEL } from "@/components/ui/field";
import FlowButton from "@/components/ui/FlowButton";
import Notice from "@/components/ui/Notice";
import Sheet from "@/components/ui/Sheet";
import { useOpenRound } from "@/hooks/useOpenRound";
import { useT } from "@/i18n/lang";
import { MAX_GROUP_DESCRIPTION_LENGTH, MAX_GROUP_NAME_LENGTH } from "@/lib/groups";
import { pictureUrl } from "@/lib/pictureFile";

/**
 * A group's picture, name and description in one sheet on a phone (#227), laid
 * out as a new group's (NewGroupDialog). Any member may change them. Only what
 * changed is saved, when Gem is pressed.
 */
export default function EditGroupSheet({
  group,
  index,
  userId,
  open,
  onClose,
}: {
  group: Group;
  index: number;
  userId: string;
  open: boolean;
  onClose: () => void;
}) {
  // A new round each time it opens: the fields start from what is stored now.
  return (
    <EditForm
      key={useOpenRound(open)}
      group={group}
      index={index}
      userId={userId}
      open={open}
      onClose={onClose}
    />
  );
}

function EditForm({
  group,
  index,
  userId,
  open,
  onClose,
}: {
  group: Group;
  index: number;
  userId: string;
  open: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const nameId = useId();
  const descriptionId = useId();
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? "");
  // Left alone (undefined), a new one, or taken away (null).
  const [picture, setPicture] = useState<string | null | undefined>(undefined);
  const [unreadable, setUnreadable] = useState<string | null>(null);
  const shown = picture === undefined ? group.pictureUrl : picture && pictureUrl(picture);

  const save = useMutation({
    mutationFn: async () => {
      const newName = name.trim();
      const newDescription = description.trim();
      if (newName !== group.name) await renameGroup(group.id, newName);
      if (newDescription !== (group.description ?? "")) {
        await describeGroup(group.id, newDescription);
      }
      if (picture) await setGroupPicture(group.id, picture);
      else if (picture === null) await removeGroupPicture(group.id);
    },
    // Fetched again either way: part of it may have been saved before a failure.
    onSettled: () => queryClient.invalidateQueries({ queryKey: groupsQueryKey(userId) }),
    onSuccess: onClose,
  });

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (name.trim() && !save.isPending) save.mutate();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t.groupsSection.edit}
      closeLabel={t.common.cancel}
      onSubmit={submit}
      busy={save.isPending}
      footer={
        <FlowButton type="submit" disabled={!name.trim()} busy={save.isPending}>
          {t.common.save}
        </FlowButton>
      }
    >
      <div className="mb-5 flex flex-col items-center">
        <PictureButton
          label={shown ? t.pictures.changeGroup : t.pictures.addGroup}
          busy={false}
          onPicked={(image) => {
            setUnreadable(null);
            setPicture(image);
          }}
          onError={setUnreadable}
        >
          <Avatar
            name={name.trim()}
            index={index}
            size="lg"
            src={shown}
            className="h-28 w-28 text-[2.5rem] short:h-20 short:w-20 short:text-[2rem]"
          />
        </PictureButton>
        {shown && (
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
      <label htmlFor={nameId} className={FIELD_LABEL}>
        {t.newGroup.nameLabel}
      </label>
      <input
        id={nameId}
        type="text"
        required
        maxLength={MAX_GROUP_NAME_LENGTH}
        value={name}
        onChange={(e) => setName(e.target.value)}
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
      {save.isError && (
        <Notice tone="error" className="mt-3">
          {save.error.message}
        </Notice>
      )}
    </Sheet>
  );
}
