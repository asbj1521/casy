import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { APP_STORE_URL, isIphoneBrowser } from "@/lib/appStore";
import { isNativeApp, SITE_URL } from "@/lib/nativeApp";

/**
 * casy.app/app, the address in the computer's QR code (#270), and the same on
 * the name's domains, vifinderligeendag.dk/app and .com/app, which "Del
 * appen" sends (#271). An iPhone with
 * the app installed never gets here: the link opens the app
 * (apple-app-site-association). An iPhone without it goes to the App Store; any
 * other phone, an Android say, to the phone website. A computer sees the ad
 * (App.tsx).
 */
export default function AppLink() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!isNativeApp && isIphoneBrowser()) window.location.replace(APP_STORE_URL);
    // On the name's own domains, which serve only this (vercel.json): the site itself.
    else if (
      window.location.hostname !== "casy.app" &&
      window.location.hostname.includes("vifinderligeendag")
    )
      window.location.replace(SITE_URL);
    else navigate("/", { replace: true });
  }, [navigate]);
  return <div className="min-h-screen bg-background" />;
}
