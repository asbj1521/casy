import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { APP_STORE_URL, isIphoneBrowser } from "@/lib/appStore";
import { isNativeApp } from "@/lib/nativeApp";

/**
 * casy.app/app, the address in the computer's QR code (#270). An iPhone with
 * the app installed never gets here: the link opens the app
 * (apple-app-site-association). An iPhone without it goes to the App Store; any
 * other phone, an Android say, to the phone website. A computer sees the ad
 * (App.tsx).
 */
export default function AppLink() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!isNativeApp && isIphoneBrowser()) window.location.replace(APP_STORE_URL);
    else navigate("/", { replace: true });
  }, [navigate]);
  return <div className="min-h-screen bg-background" />;
}
