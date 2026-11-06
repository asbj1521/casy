import { lazy, Suspense } from "react";
import type { UseMutationResult } from "@tanstack/react-query";
import { Check, Copy, Link2, Loader2, QrCode as QrIcon, Share } from "lucide-react";

import { ListRow } from "@/components/ui/ListGroup";
import Notice from "@/components/ui/Notice";
import { useCopy } from "@/hooks/useCopy";
import { useT } from "@/i18n/lang";
import { shareLink } from "@/lib/share";

// The QR library is only fetched once a code is asked for (#157).
const QrCode = lazy(() => import("@/components/ui/QrCode"));

export type LinkMutation = UseMutationResult<{ url: string; expiresAt: string }, Error, void>;

/** Making a link, copying and sharing it, and its QR code: rows for inside a ListGroup. */
export function LinkRows({
  link,
  canShare,
  shareTitle,
  message,
  showQr,
  setShowQr,
  onUsed,
}: {
  /** The link was copied, shared or its QR code shown: someone is probably being invited. */
  onUsed?: () => void;
  link: LinkMutation;
  canShare: boolean;
  shareTitle: string;
  message: string;
  showQr: boolean;
  setShowQr: (show: boolean) => void;
}) {
  const t = useT();
  const [copied, copy] = useCopy();
  return (
    <>
      {link.data ? (
        <ListRow
          icon={Link2}
          label={link.data.url}
          value={
            <span className="flex items-center gap-1 text-primary">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? t.common.copied : t.common.copy}
            </span>
          }
          onClick={() => {
            copy(link.data!.url);
            onUsed?.();
          }}
        />
      ) : (
        <ListRow
          icon={Link2}
          label={link.isPending ? t.invite.makingLink : t.invite.makeLink}
          value={link.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
          onClick={() => !link.isPending && link.mutate()}
        />
      )}
      {link.data && canShare && (
        <ListRow
          icon={Share}
          label={t.invite.shareLink}
          onClick={() => {
            void shareLink({ title: shareTitle, text: message, url: link.data!.url });
            onUsed?.();
          }}
        />
      )}
      <ListRow
        icon={QrIcon}
        label={showQr ? t.invite.hideQr : t.invite.showQr}
        expanded={showQr}
        onClick={() => {
          setShowQr(!showQr);
          if (!showQr) onUsed?.();
          if (!link.data && !link.isPending) link.mutate();
        }}
      />
    </>
  );
}

/** Under the rows: the QR code when asked for, and what went wrong. */
export function LinkOutcome({
  link,
  showQr,
  qrLabel,
  qrHelp,
}: {
  link: LinkMutation;
  showQr: boolean;
  qrLabel: string;
  qrHelp: string;
}) {
  return (
    <>
      {showQr && link.data && (
        <figure className="mt-3 flex flex-col items-center gap-2">
          <Suspense fallback={<div className="h-56 w-56 rounded-xl bg-white" />}>
            <QrCode value={link.data.url} label={qrLabel} className="h-56 w-56 rounded-xl" />
          </Suspense>
          <figcaption className="text-center text-xs text-muted-foreground">{qrHelp}</figcaption>
        </figure>
      )}
      {link.isError && (
        <Notice tone="error" bare className="mt-2">
          {link.error.message}
        </Notice>
      )}
    </>
  );
}
