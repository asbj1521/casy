import { useId, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { describeGroup, groupsQueryKey, type Group } from "@/api/groups";
import { FIELD, FIELD_LABEL } from "@/components/ui/field";
import FlowButton from "@/components/ui/FlowButton";
import Notice from "@/components/ui/Notice";
import Sheet from "@/components/ui/Sheet";
import { useOpenRound } from "@/hooks/useOpenRound";
import { useT } from "@/i18n/lang";
import { MAX_GROUP_DESCRIPTION_LENGTH } from "@/lib/groups";

/**
 * What a group is for (#152), changed by any member like its name. Saving an
 * empty field removes the description. The footnote is the promise: everyone
 * in the group can change it, and where it is shown.
 */
export default function GroupDescriptionSheet({
  group,
  userId,
  open,
  onClose,
}: {
  group: Group;
  userId: string;
  open: boolean;
  onClose: () => void;
}) {
  // A new round each time it opens: the field starts from what is stored now.
  return (
    <DescriptionForm
      key={useOpenRound(open)}
      group={group}
      userId={userId}
      open={open}
      onClose={onClose}
    />
  );
}

function DescriptionForm({
  group,
  userId,
  open,
  onClose,
}: {
  group: Group;
  userId: string;
  open: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const fieldId = useId();
  const [draft, setDraft] = useState(group.description ?? "");

  const save = useMutation({
    mutationFn: (description: string) => describeGroup(group.id, description),
    onSuccess: (data) => {
      queryClient.setQueryData(groupsQueryKey(userId), data.groups);
      onClose();
    },
  });

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!save.isPending) save.mutate(draft.trim());
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t.groupDescription.title}
      closeLabel={t.common.cancel}
      onSubmit={handleSubmit}
      busy={save.isPending}
      footer={
        <FlowButton type="submit" busy={save.isPending}>
          {t.common.save}
        </FlowButton>
      }
    >
      <label htmlFor={fieldId} className={FIELD_LABEL}>
        {t.groupDescription.label}
      </label>
      <input
        id={fieldId}
        type="text"
        autoFocus
        maxLength={MAX_GROUP_DESCRIPTION_LENGTH}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={t.groupDescription.placeholder}
        className={FIELD}
      />
      <p className="mt-2 px-1 text-xs text-muted-foreground">{t.groupDescription.footnote}</p>
      {save.isError && (
        <Notice tone="error" className="mt-3">
          {save.error.message}
        </Notice>
      )}
    </Sheet>
  );
}
