import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookUser, Link2, Loader2, QrCode as QrIcon, Share, UserPlus } from "lucide-react";

import {
  createInvite,
  groupsQuery,
  groupsQueryKey,
  inviteMembers,
  type Invitees,
} from "@/api/groups";
import InvitePicker from "@/components/InvitePicker";
import CopyField from "@/components/ui/CopyField";
import Modal, { ModalForm } from "@/components/ui/Modal";
import Notice from "@/components/ui/Notice";
import QrCode from "@/components/ui/QrCode";
import { useSignedInUser } from "@/context/auth";
import { useT } from "@/i18n/lang";
import {
  canText,
  pickContacts,
  recipientsOf,
  textInvite,
  type TextResult,
} from "@/lib/contactInvite";
import { inviteExpiryLabel, knownPeople } from "@/lib/groups";
import { isNativeApp } from "@/lib/nativeApp";
import { shareLink } from "@/lib/share";

/**
 * Bringing more people into a group you're in, three ways: tick people you
 * know from your other groups, type an email, or make a link. The first two
 * send invitations the person answers on My events; a link lets anyone who
 * has it straight in, which the dialog says before handing one out. The same
 * link can be shown as a QR code (#150), for people sitting together. In the
 * app, friends can be picked from the contacts and sent the link in a message
 * (#149); where the phone has a share sheet, the link can go anywhere else.
 */
export default function InviteDialog({
  group,
  open,
  onClose,
}: {
  group: { id: string; name: string };
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose}>
      <InviteForm group={group} onClose={onClose} />
    </Modal>
  );
}

function InviteForm({
  group,
  onClose,
}: {
  group: { id: string; name: string };
  onClose: () => void;
}) {
  const t = useT();
  const userId = useSignedInUser().id;
  const queryClient = useQueryClient();
  const { data: groups = [] } = useQuery(groupsQuery(userId));
  const [invitees, setInvitees] = useState<Invitees>({ profileIds: [], emails: [] });
  const send = useMutation({
    mutationFn: () => inviteMembers(group.id, invitees),
    // The answer marks the picked people as invited in your groups.
    onSuccess: (data) => queryClient.setQueryData(groupsQueryKey(userId), data.groups),
  });
  // A fresh link every time: only a fingerprint of each is stored (see the
  // groups function), so an earlier one can't be shown again.
  const link = useMutation({ mutationFn: () => createInvite(group.id) });
  const [showQr, setShowQr] = useState(false);
  const message = t.invite.message(group.name);
  // Contacts picked, a link made if there is none yet, and Messages opened with
  // them and the link; a phone that can't text gets the share sheet instead.
  const contacts = useMutation({
    mutationFn: async (): Promise<TextResult | "shared" | null> => {
      const to = recipientsOf(await pickContacts());
      if (to.length === 0) return null;
      const invite = link.data ?? (await link.mutateAsync());
      if (await canText()) return await textInvite(to, `${message} ${invite.url}`);
      await shareLink({ title: t.invite.shareTitle(group.name), text: message, url: invite.url });
      return "shared";
    },
  });
  const canShare = isNativeApp || typeof navigator.share === "function";
  const qrButton = (
    <button
      type="button"
      onClick={() => {
        setShowQr(!showQr);
        if (!link.data && !link.isPending) link.mutate();
      }}
      disabled={link.isPending}
      aria-expanded={showQr}
      className="mt-2 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium text-foreground transition hover:bg-secondary disabled:opacity-50"
    >
      <QrIcon className="h-4 w-4" />
      {showQr ? t.invite.hideQr : t.invite.showQr}
    </button>
  );

  const people = knownPeople(groups, group.id);
  const invited = groups.find((g) => g.id === group.id)?.invited ?? [];
  const count = invitees.profileIds.length + invitees.emails.length;
  // Still the list just sent: it's only cleared by "Invite more".
  const sentEmails = invitees.emails.length > 0;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (count > 0) send.mutate();
  }

  function inviteMore() {
    setInvitees({ profileIds: [], emails: [] });
    send.reset();
  }

  return (
    <ModalForm onSubmit={handleSubmit} className="max-w-md">
      <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
        <UserPlus className="h-5 w-5 shrink-0 text-primary" />
        <span className="min-w-0 break-words">{t.invite.title(group.name)}</span>
      </h2>

      {isNativeApp && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => contacts.mutate()}
            disabled={contacts.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {contacts.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <BookUser className="h-4 w-4" />
            )}
            {t.invite.fromContacts}
          </button>
          <p className="mt-1.5 text-xs text-muted-foreground">{t.invite.fromContactsHelp}</p>
          {contacts.data === "sent" && (
            <Notice tone="success" className="mt-2">
              {t.invite.texted}
            </Notice>
          )}
          {(contacts.data === "failed" || contacts.isError) && (
            <Notice tone="error" className="mt-2">
              {t.invite.textFailed}
            </Notice>
          )}
        </div>
      )}

      {send.isSuccess ? (
        <div className="mt-4">
          <Notice tone="success">{sentEmails ? t.invite.sentWithEmail : t.invite.sent}</Notice>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={inviteMore}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-secondary"
            >
              {t.invite.inviteMore}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              {t.invite.close}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-4">
            <InvitePicker
              people={people}
              invited={invited}
              allInWhenEmpty={groups.length > 1}
              value={invitees}
              onChange={setInvitees}
            />
          </div>
          {count > 0 && <p className="mt-3 text-xs text-muted-foreground">{t.invite.consent}</p>}
          {send.isError && (
            <Notice tone="error" className="mt-3">
              {send.error.message}
            </Notice>
          )}
          <div className="mt-4 flex justify-end gap-2">
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
              disabled={send.isPending || count === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {send.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t.invite.send(count)}
            </button>
          </div>
        </>
      )}

      <div className="mt-5 border-t pt-4">
        <p className="text-sm font-medium text-foreground">{t.invite.orLink}</p>
        {link.data ? (
          <>
            <CopyField value={link.data.url} label={t.groupsSection.inviteLink} className="mt-2" />
            {showQr && (
              <figure className="mt-3 flex flex-col items-center gap-2">
                <QrCode
                  value={link.data.url}
                  label={t.invite.qrLabel(group.name)}
                  className="h-56 w-56 rounded-xl"
                />
                <figcaption className="text-center text-xs text-muted-foreground">
                  {t.invite.qrHelp}
                </figcaption>
              </figure>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {t.invite.linkHelp(inviteExpiryLabel(link.data.expiresAt, t.inviteExpiry))}
            </p>
            <div className="flex flex-wrap gap-2">
              {canShare && (
                <button
                  type="button"
                  onClick={() =>
                    void shareLink({
                      title: t.invite.shareTitle(group.name),
                      text: message,
                      url: link.data!.url,
                    })
                  }
                  className="mt-2 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium text-foreground transition hover:bg-secondary"
                >
                  <Share className="h-4 w-4" />
                  {t.invite.shareLink}
                </button>
              )}
              {qrButton}
            </div>
          </>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => link.mutate()}
              disabled={link.isPending}
              className="mt-2 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium text-foreground transition hover:bg-secondary disabled:opacity-50"
            >
              {link.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              {link.isPending ? t.invite.makingLink : t.invite.makeLink}
            </button>
            {qrButton}
          </div>
        )}
        {link.isError && (
          <Notice tone="error" bare className="mt-2">
            {link.error.message}
          </Notice>
        )}
      </div>
    </ModalForm>
  );
}
