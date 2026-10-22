import { useState } from "react";
import { Link } from "react-router-dom";

import ConfirmPanel from "@/components/ui/ConfirmPanel";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import Switch from "@/components/ui/Switch";
import { useAiAllowed } from "@/hooks/useAiAllowed";
import { useAiConsentSetting } from "@/hooks/useAiConsentSetting";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { useT } from "@/i18n/lang";

/**
 * "AI og din kalender" (#120): the switch for Casy's AI using the names of
 * your calendars and the titles of your events, with what it means beneath.
 * For anyone the AI is on for; turning it off asks first, since it deletes
 * the labels kept on this phone. The same on a phone and a computer.
 */
export default function AiConsentGroup() {
  const t = useT().aiConsent;
  const phone = usePhoneLayout();
  const aiOn = useAiAllowed();
  const { consented, set, saving, error } = useAiConsentSetting();
  const [confirming, setConfirming] = useState(false);

  if (!aiOn) return null;

  return (
    <>
      <ListGroup
        title={t.group}
        footnote={
          <>
            {t.footnote(
              <Link to="/privacy#ai" className="underline underline-offset-2 hover:text-foreground">
                {t.privacyLink}
              </Link>,
            )}
            {error && <span className="mt-1 block text-red-700">{error}</span>}
          </>
        }
      >
        <ListRow
          label={t.row}
          detail={consented ? t.rowOn : t.rowOff}
          value={
            <Switch
              checked={consented}
              disabled={saving}
              size={phone ? "lg" : "md"}
              label={t.row}
              onChange={(on) => (on ? set(true) : setConfirming(true))}
            />
          }
        />
      </ListGroup>
      {confirming && (
        <ConfirmPanel
          tone="neutral"
          className="mt-2"
          message={t.turnOffMessage}
          confirmLabel={t.turnOff}
          busy={saving}
          error={error}
          onConfirm={() => {
            set(false);
            setConfirming(false);
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}
