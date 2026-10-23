import PhoneSubHeader from "@/components/PhoneSubHeader";
import TopNav from "@/components/TopNav";
import { useAuth } from "@/context/auth";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { useT } from "@/i18n/lang";

/**
 * The top of a page the profile's lists lead to (the terms, the privacy
 * policy, How it works, Help and contact): on a signed-in phone, the website's
 * and the app's alike, the "‹ Profil" way back, as Your data and Settings have;
 * otherwise the ordinary top bar. Signed out in the app, the page's own
 * AppBackLink goes back instead.
 */
export default function ProfilePageTop() {
  const t = useT();
  const { user } = useAuth();
  const phone = usePhoneLayout();
  if (phone && user) {
    return <PhoneSubHeader back="/profile" backLabel={t.nav.profileShort} />;
  }
  return <TopNav />;
}
