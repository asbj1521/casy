import { Loader2, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import ConfirmPanel from "@/components/ui/ConfirmPanel";
import { ListRow } from "@/components/ui/ListGroup";
import Switch from "@/components/ui/Switch";
import type { AiConsentControl } from "@/hooks/useAiConsentSetting";
import { useAiShareSetting } from "@/hooks/useAiShareSetting";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { useT } from "@/i18n/lang";

/**
 * The switch for Casy's AI using the names of your calendars and the titles
 * of your events (#120), in pieces so Your data can put it where it belongs:
 * at the top while it is off, as a row of the AI list once it is on. They all
 * take one `control` from useAiConsentControl.
 */

/** The row itself: the question, what is the case now (`detail`), and the switch. */
export function AiConsentRow({
  control,
  detail,
}: {
  control: AiConsentControl;
  detail: ReactNode;
}) {
  const t = useT().aiConsent;
  const phone = usePhoneLayout();
  return (
    <ListRow
      label={t.row}
      detail={detail}
      value={
        <Switch
          checked={control.consented}
          disabled={control.saving}
          size={phone ? "lg" : "md"}
          label={t.row}
          onChange={(on) => (on ? control.set(true) : control.setConfirming(true))}
        />
      }
    />
  );
}

/** What it means, with the link to the policy: under the row while it is off. */
export function AiConsentFootnote({ control }: { control: AiConsentControl }) {
  const t = useT().aiConsent;
  return (
    <>
      {t.footnote(
        <Link to="/privacy#ai" className="underline underline-offset-2 hover:text-foreground">
          {t.privacyLink}
        </Link>,
      )}
      {control.error && <span className="mt-1 block text-red-700">{control.error}</span>}
    </>
  );
}

/** Turning it off asks first: it deletes the labels kept on this phone. Below the list the row is in. */
export function AiConsentConfirm({ control }: { control: AiConsentControl }) {
  const t = useT().aiConsent;
  if (!control.confirming) return null;
  return (
    <ConfirmPanel
      tone="neutral"
      className="mt-2"
      message={t.turnOffMessage}
      confirmLabel={t.turnOff}
      busy={control.saving}
      error={control.error}
      onConfirm={() => {
        control.set(false);
        control.setConfirming(false);
      }}
      onCancel={() => control.setConfirming(false)}
    />
  );
}

/**
 * The corrections you write to the AI and whether they go to Casy for review
 * (#122): a switch of its own, apart from the yes it comes with, and the
 * corrections already sent, with a delete. Rows of the AI list in Your data,
 * shown while the yes is given.
 */
export function AiShareRows({ kept, sharing }: { kept: number; sharing: boolean }) {
  const t = useT();
  const phone = usePhoneLayout();
  const { setSharing, removeSent, saving, removing, error } = useAiShareSetting();
  return (
    <>
      <ListRow
        label={t.myData.shareCorrections}
        detail={error ?? (sharing ? t.myData.shareOn : t.myData.shareOff)}
        value={
          <Switch
            checked={sharing}
            disabled={saving}
            size={phone ? "lg" : "md"}
            label={t.myData.shareCorrections}
            onChange={setSharing}
          />
        }
      />
      <ListRow label={t.myData.correctionsKept} value={kept} />
      {kept > 0 && (
        <ListRow
          leading={
            removing ? (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-red-600" />
            ) : (
              <Trash2 className="h-5 w-5 shrink-0 text-red-600" />
            )
          }
          tone="danger"
          label={t.myData.correctionsDelete}
          onClick={removing ? undefined : removeSent}
        />
      )}
    </>
  );
}
