import { useId, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Users } from "lucide-react";

import { groupsQuery, type Invitees } from "@/api/groups";
import InvitePicker from "@/components/InvitePicker";
import Modal, { ModalForm } from "@/components/ui/Modal";
import Notice from "@/components/ui/Notice";
import { useSignedInUser } from "@/context/auth";
import { useT } from "@/i18n/lang";
import { knownPeople, MAX_GROUP_NAME_LENGTH } from "@/lib/groups";

/**
 * "New group": a name, and who to invite straight away, picked from people
 * you already share a group with or by email. Anyone else gets the group's
 * link afterwards. Only opened by someone signed in.
 *
 * The form only exists while the dialog is open, so it starts empty every
 * time by simply being new: a cancelled attempt can't come back half filled.
 */
export default function NewGroupDialog({
  open,
  submitting,
  error,
  onSubmit,
  onCancel,
}: {
  open: boolean;
  submitting: boolean;
  error: string | null;
  onSubmit: (group: { name: string; invitees: Invitees }) => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} busy={submitting} onClose={onCancel}>
      <NewGroupForm submitting={submitting} error={error} onSubmit={onSubmit} onCancel={onCancel} />
    </Modal>
  );
}

function NewGroupForm({
  submitting,
  error,
  onSubmit,
  onCancel,
}: {
  submitting: boolean;
  error: string | null;
  onSubmit: (group: { name: string; invitees: Invitees }) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const userId = useSignedInUser().id;
  const { data: groups = [] } = useQuery(groupsQuery(userId));
  const [name, setName] = useState("");
  const [invitees, setInvitees] = useState<Invitees>({ profileIds: [], emails: [] });
  const nameId = useId();
  const count = invitees.profileIds.length + invitees.emails.length;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (name.trim()) onSubmit({ name: name.trim(), invitees });
  }

  return (
    <ModalForm onSubmit={handleSubmit} className="max-w-md">
      <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
        <Users className="h-5 w-5 text-primary" />
        {t.newGroup.title}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t.newGroup.body}</p>

      <label className="mt-4 block text-sm" htmlFor={nameId}>
        <span className="mb-1 block font-medium text-foreground">{t.newGroup.nameLabel}</span>
        <input
          id={nameId}
          type="text"
          required
          autoFocus
          maxLength={MAX_GROUP_NAME_LENGTH}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.newGroup.placeholder}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
      </label>

      <div className="mt-5">
        <InvitePicker people={knownPeople(groups)} value={invitees} onChange={setInvitees} />
      </div>

      {count > 0 && <p className="mt-3 text-xs text-muted-foreground">{t.invite.consent}</p>}

      {error && (
        <Notice tone="error" className="mt-3">
          {error}
        </Notice>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-secondary disabled:opacity-50"
        >
          {t.common.cancel}
        </button>
        <button
          type="submit"
          disabled={submitting || !name.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {count > 0 ? t.newGroup.createAndInvite(count) : t.newGroup.create}
        </button>
      </div>
    </ModalForm>
  );
}
