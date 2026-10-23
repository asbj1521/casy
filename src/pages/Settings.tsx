import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import PhoneSubHeader from "@/components/PhoneSubHeader";
import SettingsGroups from "@/components/profile/SettingsGroups";
import TopNav from "@/components/TopNav";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { useT } from "@/i18n/lang";

/**
 * Settings (#129), under the profile: the language and light or dark, the
 * same on a phone, a computer and in the iPhone app. A screen with a back
 * button on a phone, a page on a computer.
 */
export default function Settings() {
  const t = useT();
  const phone = usePhoneLayout();

  if (phone) {
    return (
      <div className="min-h-screen bg-background">
        <PhoneSubHeader
          title={t.profileHub.settings}
          back="/profile"
          backLabel={t.nav.profileShort}
        />
        <main className="px-4 pb-8">
          <SettingsGroups />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="px-4 pb-20 pt-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <Link
            to="/profile"
            className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {t.nav.profile}
          </Link>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground">
            {t.profileHub.settings}
          </h1>
          <SettingsGroups />
        </div>
      </main>
    </div>
  );
}
