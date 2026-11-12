import { useState } from "react";
import {
  CircleHelp,
  Database,
  FileText,
  LifeBuoy,
  Lock,
  MessageSquare,
  Share,
  Star,
} from "lucide-react";

import CopyField from "@/components/ui/CopyField";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { useT } from "@/i18n/lang";
import { APP_VERSION } from "@/lib/appVersion";
import { APP_BUILD, feedbackMailto } from "@/lib/feedback";
import { isNativeApp } from "@/lib/nativeApp";
import { shareLink } from "@/lib/share";
import { SITE_URL } from "@/lib/nativeApp";

/**
 * The App Store's own page for writing a review of Casy (#256): an itms-apps
 * link, which iOS hands to the App Store app, never to Safari.
 */
const WRITE_REVIEW = "itms-apps://apps.apple.com/app/id6830713238?action=write-review";

/**
 * The profile's "Send feedback" (an email with the build and device filled
 * in), "Share Casy" (the share sheet; where there is none, the link to
 * copy) and, in the app, "Rate Casy" (#256: the App Store opens on its page to
 * rate and review; every rating helps a new app be found).
 */
export function FeedbackShareGroup() {
  const t = useT();
  const [showLink, setShowLink] = useState(false);

  function shareCasy() {
    void shareLink({ title: "Casy", text: t.profileHub.shareText, url: SITE_URL }).then((opened) =>
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
              build: `${APP_VERSION} · ${APP_BUILD}`,
              platform: isNativeApp ? "app" : "web",
              userAgent: navigator.userAgent,
            });
          }}
        />
        <ListRow icon={Share} label={t.profileHub.share} onClick={shareCasy} />
        {isNativeApp && (
          <ListRow
            icon={Star}
            label={t.rateCasy}
            onClick={() => {
              window.location.href = WRITE_REVIEW;
            }}
          />
        )}
      </ListGroup>
      {showLink && <CopyField value={SITE_URL} label={t.profileHub.share} className="mt-2" />}
    </>
  );
}

/** Your data, how Casy works, the terms and the privacy policy. */
export function HelpGroup() {
  const t = useT();
  return (
    <ListGroup>
      <ListRow to="/profile/data" icon={Database} label={t.myData.row} />
      <ListRow to="/support" icon={LifeBuoy} label={t.footer.support} />
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
      {t.profileHub.version(APP_VERSION, APP_BUILD)}
    </p>
  );
}
