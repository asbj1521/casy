import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft } from "lucide-react";

import GlassButton from "@/components/ui/GlassButton";
import JokeStage from "@/components/welcome/JokeStage";
import { rectOfCard, type MorphRect } from "@/components/welcome/phone/morph";
import { APP_NAME } from "@/i18n/brand";
import { useT } from "@/i18n/lang";
import { loadPage } from "@/pages/lazyPages";

// Only for the friend who came by an invite (#237): fetched when asked for.
/** Remembered once the welcome's journey has been played through (#275). */
const SEEN_KEY = "casy-welcome-seen";

const InvitePasteSheet = lazy(() => import("@/components/invite/InvitePasteSheet"));

/**
 * The iPhone app's way in, signed out (#151, #228): the welcome screen and
 * sign-in, one place with the same colour in it. It stays open across the two
 * addresses, so the phone can become the sign-in card and the colour spread out
 * behind it, whichever moment of the animation "Kom i gang" was pressed in. Back
 * runs the same thing the other way. Under the phone, never moving, one line and
 * the two ways on, to make an account or to log in, and for a friend who got
 * the app from an invite, the way back to it (#237). No language switch on the
 * welcome screen (the app starts in the phone's language). The website keeps its
 * landing page.
 */
export default function AppWelcome({
  signIn = false,
  children,
}: {
  /** At /sign-in: the page (`children`) is open over the colour. */
  signIn?: boolean;
  children?: ReactNode;
}) {
  const t = useT();
  const navigate = useNavigate();
  const { search } = useLocation();
  const still = useReducedMotion() ?? false;
  // Opened straight on sign-in there is nothing to morph from: it is simply there.
  const [openedOnSignIn, setOpenedOnSignIn] = useState(signIn);
  const cardOnLeaving = useRef<MorphRect | null>(null);
  // "Indsæt link" (#237): asked for once, then kept so the sheet can close.
  const [pasting, setPasting] = useState(false);
  const [pasteWanted, setPasteWanted] = useState(false);
  // Kom i gang and Indsæt link wait until the journey has been played through once (#275);
  // after that first time, they are there at once. Log ind is always at the bottom.
  const [seen, setSeen] = useState(() => {
    try {
      return localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      return false;
    }
  });
  const journeyDone = useCallback(() => {
    setSeen(true);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Private mode: shown again next time, which is fine.
    }
  }, []);

  // The colour reaches up under the clock.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("glass-top", signIn);
    return () => root.classList.remove("glass-top");
  }, [signIn]);

  // Fetched ahead, so the card is there to morph into the moment it is pressed.
  useEffect(() => {
    void loadPage.signIn();
  }, []);

  const back = () => {
    cardOnLeaving.current = rectOfCard();
    setOpenedOnSignIn(false);
    // Sent here from an invite: back to that. Otherwise to the animation.
    if (new URLSearchParams(search).has("next")) void navigate(-1);
    else void navigate("/");
  };

  const appear = openedOnSignIn || still ? false : { opacity: 0 };
  const appearing = { delay: 0.48, duration: 0.25 };

  return (
    <main
      className="relative flex flex-col overflow-hidden"
      style={{ height: "calc(100dvh - env(safe-area-inset-top))" }}
    >
      <div className="min-h-0 flex-1">
        <JokeStage leaving={signIn} onDone={journeyDone} />
      </div>
      <motion.div
        aria-hidden={signIn}
        inert={signIn}
        className="relative px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 text-center"
        initial={false}
        animate={{ opacity: signIn ? 0 : 1 }}
        transition={signIn ? { duration: 0.18 } : { delay: 0.3, duration: 0.25 }}
      >
        {/* The phone says it all; the name stays for screen readers. */}
        <h1 className="sr-only">{APP_NAME}</h1>
        <AnimatePresence initial={false}>
          {seen && (
            <motion.div
              key="ways-on"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 26 }}
            >
              <Link
                to="/sign-in?signup=1"
                className="flex h-14 items-center justify-center rounded-full bg-cta text-[1.0625rem] font-bold text-white transition active:scale-[0.98]"
              >
                {t.welcome.start}
              </Link>
              <p className="mt-4 text-[0.9375rem] text-muted-foreground">
                {t.invitePaste.ask}{" "}
                <button
                  type="button"
                  onClick={() => {
                    setPasteWanted(true);
                    setPasting(true);
                  }}
                  className="hit font-semibold text-foreground"
                >
                  {t.invitePaste.paste}
                </button>
              </p>
            </motion.div>
          )}
        </AnimatePresence>
        <p className="mt-4 text-[0.9375rem] text-muted-foreground">
          {t.welcome.haveAccount}{" "}
          <Link to="/sign-in" className="hit font-semibold text-foreground">
            {t.nav.signIn}
          </Link>
        </p>
      </motion.div>
      {pasteWanted && (
        <Suspense fallback={null}>
          <InvitePasteSheet open={pasting} onClose={() => setPasting(false)} />
        </Suspense>
      )}
      {signIn && (
        <>
          <motion.div
            className="absolute inset-0 z-10 overflow-y-auto"
            initial={appear}
            animate={{ opacity: 1 }}
            transition={appearing}
          >
            <Suspense fallback={null}>{children}</Suspense>
          </motion.div>
          <motion.div
            className="absolute left-4 top-0 z-20 flex h-12 items-center"
            initial={appear}
            animate={{ opacity: 1 }}
            transition={appearing}
          >
            {/* Solid: orange text can't be read through glass on the orange behind it. */}
            <GlassButton icon={ChevronLeft} size="sm" onClick={back} className="!bg-card">
              {t.welcome.back}
            </GlassButton>
          </motion.div>
        </>
      )}
    </main>
  );
}
