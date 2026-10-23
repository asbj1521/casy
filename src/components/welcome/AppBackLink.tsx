import { useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

import { useAuth } from "@/context/auth";
import { useT } from "@/i18n/lang";
import { isNativeApp } from "@/lib/nativeApp";
import { cn } from "@/lib/utils";

/**
 * "Tilbage" on the pages someone signed out can reach in the iPhone app
 * (sign-in, the terms and privacy policy, #151): the app has no tab bar until
 * someone signs in, and iOS's web view has no swipe back, so without it these
 * pages would be dead ends. A step back, or to the welcome screen when the
 * page was opened first. Nothing on the website or once signed in.
 */
export default function AppBackLink({ className }: { className?: string }) {
  const t = useT();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  if (!isNativeApp || loading || user) return null;
  return (
    <button
      type="button"
      onClick={() => (location.key === "default" ? navigate("/") : navigate(-1))}
      className={cn("-ml-1 flex items-center gap-0.5 text-[17px] text-primary", className)}
    >
      <ChevronLeft className="h-5 w-5" />
      {t.welcome.back}
    </button>
  );
}
