import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SiApple } from "react-icons/si";

import LogoMark from "@/components/ui/LogoMark";
import { APP_NAME } from "@/i18n/brand";
import { useT } from "@/i18n/lang";
import { APP_STORE_URL, isIphoneBrowser } from "@/lib/appStore";
import { isNativeApp, SITE_URL } from "@/lib/nativeApp";

/**
 * casy.app/app, the address in the computer's QR code (#270), and the same on
 * the name's domains, vifinderligeendag.dk/app and .com/app, which "Del
 * appen" sends (#271). An iPhone with the app installed never gets here: the
 * link opens the app (apple-app-site-association). An iPhone without it goes
 * to the App Store; any other phone, an Android say, to the phone website. A
 * computer sees the ad (App.tsx).
 *
 * On an iPhone the page is drawn too, with a button to the App Store: the
 * browsers inside Messenger, Instagram and the like refuse a jump to the App
 * Store that no tap asked for, and would otherwise show an empty page.
 */
export default function AppLink() {
  const navigate = useNavigate();
  const iPhone = !isNativeApp && isIphoneBrowser();
  useEffect(() => {
    if (iPhone) window.location.replace(APP_STORE_URL);
    // On the name's own domains, which serve only this (vercel.json): the site itself.
    else if (
      window.location.hostname !== "casy.app" &&
      window.location.hostname.includes("vifinderligeendag")
    )
      window.location.replace(SITE_URL);
    else navigate("/", { replace: true });
  }, [iPhone, navigate]);
  if (!iPhone) return <div className="min-h-screen bg-background" />;
  return <ToTheAppStore />;
}

function ToTheAppStore() {
  const t = useT();
  return (
    <main className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#FF4D00] px-8 text-center text-white">
      <h1 className="w-full max-w-[17rem]">
        <LogoMark label={APP_NAME} className="block h-auto w-full text-white" />
      </h1>
      <p className="mt-8 text-balance text-[1.375rem] font-bold leading-tight">
        {t.computerAd.tagline}
      </p>
      <a
        href={APP_STORE_URL}
        className="mt-10 inline-flex items-center gap-2.5 whitespace-nowrap rounded-full bg-white px-7 py-4 text-[1.125rem] font-semibold text-black shadow-lg active:scale-[0.98]"
      >
        <SiApple aria-hidden className="h-5 w-5" />
        {t.computerAd.appStore}
      </a>
    </main>
  );
}
