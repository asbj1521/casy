import { useQuery } from "@tanstack/react-query";
import { CircleArrowUp } from "lucide-react";

import { appVersionQuery } from "@/api/appVersion";
import { useT } from "@/i18n/lang";
import { APP_VERSION, isOutdated } from "@/lib/appVersion";
import { isNativeApp } from "@/lib/nativeApp";

/**
 * In the iPhone app, an app older than the oldest release Casy still works
 * with (#143) gets "Update Casy" over everything, signed in or not, with a way
 * to the App Store. Asked on opening and again on coming back to the app; a
 * failed answer blocks nothing. Never on the website, which is always the latest.
 */
export default function UpdateRequired() {
  const t = useT();
  const { data } = useQuery({
    ...appVersionQuery,
    enabled: isNativeApp,
    staleTime: 30 * 60_000,
    retry: false,
  });
  if (!isNativeApp || !data || !isOutdated(APP_VERSION, data.minVersion)) return null;

  const words = t.updateRequired;
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="update-required-title"
      className="fixed inset-0 z-[300] flex flex-col items-center justify-center gap-4 bg-background px-8 text-center"
    >
      <CircleArrowUp className="h-14 w-14 text-primary" strokeWidth={1.5} aria-hidden />
      <h1 id="update-required-title" className="text-2xl font-bold text-foreground">
        {words.title}
      </h1>
      <p className="max-w-sm text-[15px] text-muted-foreground">{words.body}</p>
      {data.storeUrl && (
        <a
          href={data.storeUrl}
          className="mt-2 rounded-full bg-cta px-6 py-3 text-[15px] font-bold text-white"
        >
          {words.button}
        </a>
      )}
    </div>
  );
}
