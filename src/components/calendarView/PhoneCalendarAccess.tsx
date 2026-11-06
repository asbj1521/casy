import { Link } from "react-router-dom";

import OnlyTimesDemo from "@/components/calendarView/OnlyTimesDemo";
import BottomSheet from "@/components/ui/BottomSheet";
import FlowButton from "@/components/ui/FlowButton";
import { useCalendarsHome } from "@/hooks/useCalendarsHome";
import type { usePhoneImport } from "@/hooks/usePhoneImport";
import { useT } from "@/i18n/lang";
import { openPhoneSettings } from "@/lib/phoneCalendar";

type Import = ReturnType<typeof usePhoneImport>;

/**
 * What the iPhone app says when this phone isn't connected (#132): a sheet
 * over the month (#215), so the month keeps its place. It says Casy can't see
 * a calendar yet and has one button: import the phone's, or lead to Settings
 * when it was refused. Before iOS has asked, the button is only "Fortsæt" and
 * the sheet can't be put away: it leads straight to iOS's own question, where
 * the person answers (App Store guideline 5.1.1(iv), #147). After that answer
 * it can be put away ("Ikke nu"), until the app is opened again, and another
 * calendar can be chosen: nothing in Casy is behind this question.
 */
export default function PhoneCalendarAccess({
  phone,
  open,
  onNotNow,
}: {
  phone: Import;
  open: boolean;
  onNotNow: () => void;
}) {
  const t = useT();
  const words = t.phoneCalendar;
  const home = useCalendarsHome();
  const { access, importing, outcome, error } = phone;
  const denied = access === "denied" || outcome?.state === "denied";
  const beforeIos = access === "prompt" && !denied;

  const button = importing
    ? words.importing
    : denied
      ? words.openSettings
      : beforeIos
        ? words.continueToIos
        : words.importCalendar;
  // What the last press came to, under the text.
  const note = error
    ? error
    : outcome?.state === "synced" && outcome.calendars === 0
      ? words.nothingOnPhone
      : outcome && outcome.state !== "synced" && outcome.state !== "denied"
        ? words.couldntRead
        : null;

  return (
    <BottomSheet
      open={open}
      onClose={beforeIos ? () => undefined : onNotNow}
      title={phone.others ? words.phoneTitle : words.needTitle}
      doneLabel={beforeIos ? undefined : words.notNow}
      footer={
        <FlowButton
          disabled={importing}
          busy={importing}
          onClick={denied ? () => void openPhoneSettings() : phone.importNow}
        >
          {button}
        </FlowButton>
      }
    >
      <OnlyTimesDemo />
      <p className="px-1 text-[0.9375rem] text-muted-foreground">
        {denied ? words.denied : words.needBody}
        {beforeIos && ` ${words.needAsk}`}
      </p>
      {note && <p className="mt-3 px-1 text-[0.8125rem] text-red-600">{note}</p>}
      {!phone.others && !beforeIos && (
        <Link
          to={home.to}
          className="mt-3 block px-1 pb-2 text-[0.9375rem] font-semibold text-primary"
        >
          {words.otherCalendar}
        </Link>
      )}
    </BottomSheet>
  );
}
