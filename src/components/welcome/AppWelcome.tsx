import { Link } from "react-router-dom";

import WelcomeStage from "@/components/welcome/WelcomeStage";
import { useT } from "@/i18n/lang";

/**
 * The iPhone app's first screen, signed out (#151, #228): a real phone playing
 * the app above, and below it, never moving, one line and the two ways on, to
 * make an account or to log in. No language switch (the app starts in the
 * phone's language; Settings changes it). The website keeps its landing page.
 */
export default function AppWelcome() {
  const t = useT();
  return (
    <main
      className="flex flex-col overflow-hidden bg-background"
      style={{ height: "calc(100dvh - env(safe-area-inset-top))" }}
    >
      <div className="min-h-0 flex-1">
        <WelcomeStage />
      </div>
      <div className="relative px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 text-center">
        <h1 className="text-balance text-[2rem] font-bold leading-tight tracking-tight text-foreground">
          {t.welcome.headline}
        </h1>
        <Link
          to="/sign-in?signup=1"
          className="mt-5 flex h-14 items-center justify-center rounded-full bg-cta text-[1.0625rem] font-bold text-white transition active:scale-[0.98]"
        >
          {t.welcome.start}
        </Link>
        <p className="mt-4 text-[0.9375rem] text-muted-foreground">
          {t.welcome.haveAccount}{" "}
          <Link to="/sign-in" className="hit font-semibold text-foreground">
            {t.nav.signIn}
          </Link>
        </p>
      </div>
    </main>
  );
}
