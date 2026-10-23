import { useId, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Flag, Loader2 } from "lucide-react";

import { groupsQueryKey, leaveGroup } from "@/api/groups";
import {
  blockedQueryKey,
  blockPerson,
  REPORT_REASONS,
  sendReport,
  type ReportReason,
  type ReportTarget,
} from "@/api/safety";
import Modal, { ModalForm } from "@/components/ui/Modal";
import Notice from "@/components/ui/Notice";
import { useSignedInUser } from "@/context/auth";
import { useT } from "@/i18n/lang";

/** One thing the dialog can report: what it says, and who it is when it is a person. */
export interface ReportChoice {
  label: string;
  target: ReportTarget;
  /** A member: they can be blocked along with the report. */
  person?: { id: string; name: string };
}

/**
 * Reporting something in a group to Casy (#142, App Store guideline 1.2):
 * what it is about (the group, an event, a member), why, and a note. A member
 * can be blocked with it, and the group left. The reported person is never
 * told; admin mode lists reports without saying who sent them.
 */
export default function ReportDialog({
  open,
  onClose,
  choices,
  group,
}: {
  open: boolean;
  onClose: () => void;
  /** What can be reported here, the first picked to begin with. */
  choices: ReportChoice[];
  /** The group, so it can be left too; none where leaving isn't offered. */
  group?: { id: string; name: string };
}) {
  return (
    <Modal open={open} onClose={onClose}>
      <ReportForm choices={choices} group={group} onClose={onClose} />
    </Modal>
  );
}

function ReportForm({
  choices,
  group,
  onClose,
}: {
  choices: ReportChoice[];
  group?: { id: string; name: string };
  onClose: () => void;
}) {
  const t = useT();
  const words = t.safety;
  const userId = useSignedInUser().id;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const noteId = useId();
  const [picked, setPicked] = useState(0);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [block, setBlock] = useState(false);
  const [leave, setLeave] = useState(false);
  const choice = choices[picked];

  const send = useMutation({
    mutationFn: async () => {
      await sendReport(choice.target, reason!, note);
      if (block && choice.person) {
        const { blocked } = await blockPerson({ profileId: choice.person.id });
        queryClient.setQueryData(blockedQueryKey(userId), blocked);
      }
      if (leave && group) {
        const { groups } = await leaveGroup(group.id);
        queryClient.setQueryData(groupsQueryKey(userId), groups);
      }
    },
  });

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (reason) send.mutate();
  }

  function close() {
    onClose();
    // The group is gone from your list: back to it.
    if (send.isSuccess && leave && group) navigate("/groups");
  }

  return (
    <ModalForm onSubmit={handleSubmit} className="max-w-md">
      <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
        <Flag className="h-5 w-5 shrink-0 text-primary" />
        {words.title}
      </h2>

      {send.isSuccess ? (
        <div className="mt-4">
          <Notice tone="success">{words.sent}</Notice>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={close}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              {t.invite.close}
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">{words.intro}</p>

          {choices.length > 1 && (
            <fieldset className="mt-4">
              <legend className="mb-1.5 text-sm font-medium text-foreground">{words.what}</legend>
              <div className="space-y-1">
                {choices.map((c, i) => (
                  <label key={i} className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="radio"
                      name="report-what"
                      checked={picked === i}
                      onChange={() => {
                        setPicked(i);
                        setBlock(false);
                      }}
                      className="accent-[hsl(var(--primary))]"
                    />
                    <span className="min-w-0 break-words">{c.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <fieldset className="mt-4">
            <legend className="mb-1.5 text-sm font-medium text-foreground">{words.why}</legend>
            <div className="space-y-1">
              {REPORT_REASONS.map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="radio"
                    name="report-why"
                    checked={reason === r}
                    onChange={() => setReason(r)}
                    className="accent-[hsl(var(--primary))]"
                  />
                  {words.reasons[r]}
                </label>
              ))}
            </div>
          </fieldset>

          <label htmlFor={noteId} className="mt-4 block text-sm font-medium text-foreground">
            {words.note}
          </label>
          <textarea
            id={noteId}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={3}
            className="mt-1.5 w-full rounded-lg border bg-background px-3 py-2 text-[16px] text-foreground sm:text-sm"
          />

          {choice.person && (
            <label className="mt-4 flex items-start gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={block}
                onChange={(e) => setBlock(e.target.checked)}
                className="mt-0.5 accent-[hsl(var(--primary))]"
              />
              <span>
                {words.blockToo(choice.person.name)}
                <span className="block text-xs text-muted-foreground">
                  {words.blockHelp(choice.person.name)}
                </span>
              </span>
            </label>
          )}
          {group && (
            <label className="mt-3 flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={leave}
                onChange={(e) => setLeave(e.target.checked)}
                className="accent-[hsl(var(--primary))]"
              />
              <span className="min-w-0 break-words">{words.leaveToo(group.name)}</span>
            </label>
          )}

          {send.isError && (
            <Notice tone="error" className="mt-3">
              {send.error.message}
            </Notice>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={send.isPending}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-secondary disabled:opacity-50"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={send.isPending || !reason}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {send.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {words.send}
            </button>
          </div>
        </>
      )}
    </ModalForm>
  );
}
