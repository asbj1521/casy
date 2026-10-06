import { useState } from "react";
import { CircleHelp, Database, FileText, Lock, MessageSquare, Share } from "lucide-react";

import CopyField from "@/components/ui/CopyField";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { useT } from "@/i18n/lang";
import { APP_BUILD, feedbackMailto } from "@/lib/feedback";
import { isNativeApp } from "@/lib/nativeApp";
import { shareLink } from "@/lib/share";

/** What "Share Casy" hands on. */
const CASY_URL = "https://casy.app";

/**
 * The profile's "Send feedback" (an email with the build and device filled
 * in) and "Share Casy" (the share sheet; where there is none, the link to
 * copy). The same on a phone and a computer.
 */
export function FeedbackShareGroup() {
  const t = useT();
  const [showLink, setShowLink] = useState(false);

  function shareCasy() {
    void shareLink({ title: "Casy", text: t.profileHub.shareText, url: CASY_URL }).then((opened) =>
      setShowLink(!opened),
    );
  }

  return (
    <>
      <ListGroup>
        <ListRow
          icon={MessageSquare}
          label={t.profileHub.feedback}
          onClick={() => {
            window.location.href = feedbackMailto({
              subject: t.profileHub.feedbackSubject,
              prompt: t.profileHub.feedbackPrompt,
              build: APP_BUILD,
              platform: isNativeApp ? "app" : "web",
              userAgent: navigator.userAgent,
            });
          }}
        />
        <ListRow icon={Share} label={t.profileHub.share} onClick={shareCasy} />
      </ListGroup>
      {showLink && <CopyField value={CASY_URL} label={t.profileHub.share} className="mt-2" />}
    </>
  );
}

/** Your data, how Casy works, the terms and the privacy policy. */
export function HelpGroup() {
  const t = useT();
  return (
    <ListGroup>
      <ListRow to="/profile/data" icon={Database} label={t.myData.row} />
      <ListRow to="/how-it-works" icon={CircleHelp} label={t.footer.howItWorks} />
      <ListRow to="/terms" icon={FileText} label={t.footer.terms} />
      <ListRow to="/privacy" icon={Lock} label={t.footer.privacy} />
    </ListGroup>
  );
}

/** Which build this is, for anyone reporting a bug. */
export function BuildLine() {
  const t = useT();
  return (
    <p className="mt-6 text-center text-xs text-muted-foreground">
      {t.profileHub.version(APP_BUILD)}
    </p>
  );
}
