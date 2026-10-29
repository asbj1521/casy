import { Link, Navigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import SettingsGroups from "@/components/profile/SettingsGroups";
import TopNav from "@/components/TopNav";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { useT } from "@/i18n/lang";
import { sheetAddress } from "@/lib/profileScreens";

/**
 * Settings (#129), under the profile: the language and light or dark, the
 * same on a phone, a computer and in the iPhone app. A screen in the Profil
 * sheet on a phone (#174), a page on a computer.
 */
export default function Settings() {
  const t = useT();
  const phone = usePhoneLayout();

  // A phone opens it inside the Profil sheet on the home page (#174).
  if (phone) return <Navigate to={sheetAddress("settings")} replace />;

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
