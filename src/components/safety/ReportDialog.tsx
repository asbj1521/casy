import { useId, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Ban, LogOut } from "lucide-react";

import { groupsQueryKey, leaveGroup } from "@/api/groups";
import {
  blockedQueryKey,
  blockPerson,
  REPORT_REASONS,
  sendReport,
  type ReportReason,
  type ReportTarget,
} from "@/api/safety";
import { FIELD_LABEL, TEXTAREA } from "@/components/ui/field";
import FlowButton from "@/components/ui/FlowButton";
import { ListGroup, ListPickRow, ListSwitchRow } from "@/components/ui/ListGroup";
import Notice from "@/components/ui/Notice";
import Sheet from "@/components/ui/Sheet";
import { useSignedInUser } from "@/context/auth";
import { useOpenRound } from "@/hooks/useOpenRound";
import { useT } from "@/i18n/lang";

/** One thing the dialog can report: what it says, and who it is when it is a person. */
interface ReportChoice {
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
  // A new round each time it opens: nothing picked, nothing written.
  return (
    <ReportSheet
      key={useOpenRound(open)}
      open={open}
      onClose={onClose}
      choices={choices}
      group={group}
    />
  );
}

function ReportSheet({
  open,
  choices,
  group,
  onClose,
}: {
  open: boolean;
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
    <Sheet
      open={open}
      onClose={close}
      title={words.title}
      closeLabel={send.isSuccess ? t.invite.close : t.common.cancel}
      onSubmit={handleSubmit}
      busy={send.isPending}
      // Always a footer (switching layouts would slide the sheet in again);
      // once sent, closing is the top's Luk.
      footer={
        <>
          {!send.isSuccess && (
            <FlowButton type="submit" disabled={!reason} busy={send.isPending}>
              {words.send}
            </FlowButton>
          )}
        </>
      }
    >
      {send.isSuccess ? (
        <Notice tone="success">{words.sent}</Notice>
      ) : (
        <>
          {choices.length > 1 && (
            <ListGroup title={words.what} className="mt-0">
              {choices.map((c, i) => (
                <ListPickRow
                  key={i}
                  type="radio"
                  name="report-what"
                  checked={picked === i}
                  onChange={() => {
                    setPicked(i);
                    setBlock(false);
                  }}
                  label={c.label}
                />
              ))}
            </ListGroup>
          )}

          <ListGroup title={words.why} className={choices.length > 1 ? undefined : "mt-0"}>
            {REPORT_REASONS.map((r) => (
              <ListPickRow
                key={r}
                type="radio"
                name="report-why"
                checked={reason === r}
                onChange={() => setReason(r)}
                label={words.reasons[r]}
              />
            ))}
          </ListGroup>

          <div className="mt-6">
            <label htmlFor={noteId} className={FIELD_LABEL}>
              {words.note}
            </label>
            <textarea
              id={noteId}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={3}
              className={TEXTAREA}
            />
          </div>

          {(choice.person || group) && (
            <ListGroup footnote={words.intro}>
              {choice.person && (
                <ListSwitchRow
                  icon={Ban}
                  label={words.blockToo(choice.person.name)}
                  detail={words.blockHelp(choice.person.name)}
                  checked={block}
                  onChange={setBlock}
                />
              )}
              {group && (
                <ListSwitchRow
                  icon={LogOut}
                  label={words.leaveToo(group.name)}
                  checked={leave}
                  onChange={setLeave}
                />
              )}
            </ListGroup>
          )}
          {!choice.person && !group && (
            <p className="mt-1.5 px-4 text-xs text-muted-foreground">{words.intro}</p>
          )}

          {send.isError && (
            <Notice tone="error" className="mt-3">
              {send.error.message}
            </Notice>
          )}
        </>
      )}
    </Sheet>
  );
}
