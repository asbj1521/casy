import { Link } from "react-router-dom";

import WelcomePile from "@/components/welcome/WelcomePile";
import { useT } from "@/i18n/lang";

/**
 * The iPhone app's first screen, signed out (#151): what Casy does, shown by
 * the paper pile in small, one line on it, and one way on, to sign in. No tab
 * bar (TabBar hides it in the app until someone is signed in) and no language
 * switch (the app starts in the phone's language; Settings changes it). The
 * website keeps its landing page.
 */
export default function AppWelcome() {
  const t = useT();
  return (
    <main
      className="flex flex-col overflow-hidden bg-background"
      style={{ height: "calc(100dvh - env(safe-area-inset-top))" }}
    >
      <div className="min-h-0 flex-1">
        <WelcomePile />
      </div>
      {/* Up over the calendar's faded bottom edge. */}
      <div className="relative -mt-6 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <h1 className="text-balance text-[32px] font-bold leading-tight tracking-tight text-foreground">
          {t.welcome.headline}
        </h1>
        <p className="mt-2 text-[17px] text-muted-foreground">{t.welcome.body}</p>
        <Link
          to="/sign-in"
          className="mt-6 flex h-14 items-center justify-center rounded-full bg-cta text-[17px] font-bold text-white transition active:scale-[0.98]"
        >
          {t.welcome.start}
        </Link>
      </div>
    </main>
  );
}
