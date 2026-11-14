import { useCallback, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { SiApple } from "react-icons/si";

import { previewFriend, previewInvite } from "@/api/groups";
import LanguageToggle from "@/components/LanguageToggle";
import QrCode from "@/components/ui/QrCode";
import LogoMark from "@/components/ui/LogoMark";
import WelcomeIntro from "@/components/welcome/WelcomeIntro";
import WelcomeStage from "@/components/welcome/WelcomeStage";
import type { MorphRect } from "@/components/welcome/phone/morph";
import { displayName, useAuth } from "@/context/auth";
import { appName } from "@/i18n/brand";
import { useLang, useT } from "@/i18n/lang";
import { APP_STORE_URL } from "@/lib/appStore";
import { APP_URL, SITE_URL } from "@/lib/nativeApp";

/**
 * The right-hand side: the app's own opening (#275), the orange intro with
 * the message that grows old, its link growing into the phone; then the
 * app's welcome animation (#228), colour shapes and all, looping. The same
 * as in the app, so someone who comes from here finds it familiar. Every
 * visit starts with the intro. Nothing to press.
 */
function PlayingPhone() {
  const [intro, setIntro] = useState(
    // The browser tests skip it, as in the app's own (AppWelcome).
    !(window as unknown as { __casySkipIntro?: boolean }).__casySkipIntro,
  );
  const [card, setCard] = useState<MorphRect | null>(null);
  const introDone = useCallback((from: MorphRect | null) => {
    setCard(from);
    setIntro(false);
  }, []);
  return (
    <div className="relative h-[min(52rem,calc(100vh-3rem))] w-[min(30rem,40vw)]">
      {!intro && <WelcomeStage contained fromIntro={card} />}
      <AnimatePresence>
        {intro && (
          <motion.div
            key="intro"
            className="absolute inset-0"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <WelcomeIntro contained onDone={introDone} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** The bubbles: where each stands (its middle, as a share of the page), how big, and its colour. */
const BUBBLES = [
  // Behind the intro's white words and the phone: the deep ones.
  {
    x: 76,
    y: 34,
    size: 62,
    fill: "radial-gradient(circle at 30% 25%, #fdba74, #fb923c 45%, #f43f5e)",
    drift: 24,
  },
  {
    x: 98,
    y: 82,
    size: 56,
    fill: "radial-gradient(circle at 30% 25%, #fb7185, #ff2d78 50%, #e11d48)",
    drift: 28,
  },
  // The light ones, lower and at the edge, where no white word stands.
  {
    x: 60,
    y: 104,
    size: 40,
    fill: "radial-gradient(circle at 35% 30%, #fde68a, #ffd60a 50%, #fbbf24)",
    drift: 21,
  },
  {
    x: 102,
    y: 4,
    size: 34,
    fill: "radial-gradient(circle at 35% 30%, #fde68a, #fbbf24 55%, #f97316)",
    drift: 26,
  },
] as const;

/**
 * The colour behind the right half (#270): the app's own colour shapes, but
 * big, as a computer's screen has room for, and only drifting a little and
 * slowly, which reads as the same life. The intro's white words and the
 * phone stand on them; the words on the left stay readable over their edge.
 */
function Bubbles() {
  const still = useReducedMotion() ?? false;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {BUBBLES.map((b, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${b.x}%`,
            top: `${b.y}%`,
            width: `${b.size}vmax`,
            height: `${b.size}vmax`,
            marginLeft: `-${b.size / 2}vmax`,
            marginTop: `-${b.size / 2}vmax`,
            background: b.fill,
          }}
          animate={
            still
              ? undefined
              : { x: ["-2%", "2%", "-2%"], y: ["1.5%", "-2%", "1.5%"], scale: [1, 1.04, 1] }
          }
          transition={{ duration: b.drift, repeat: Infinity, ease: "easeInOut", delay: -i * 4 }}
        />
      ))}
    </div>
  );
}

/**
 * The QR code and the way to the App Store as one card: the code on its own
 * white, and beside it, on one left edge, what to do and the App Store's button.
 */
function GetTheApp({ link, scanLine, label }: { link: string; scanLine: string; label: string }) {
  const t = useT();
  return (
    <div className="flex w-fit items-center gap-5 rounded-[1.75rem] bg-card/90 p-3 pr-6 shadow-sm ring-1 ring-border backdrop-blur">
      <div className="rounded-[1.25rem] bg-white p-2">
        <QrCode value={link} label={label} border={1} className="h-32 w-32" />
      </div>
      <div className="flex flex-col items-start gap-3">
        <p className="max-w-[13rem] text-[1.0625rem] font-semibold leading-snug">{scanLine}</p>
        <a
          href={APP_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-full bg-foreground px-5 text-[0.9375rem] font-semibold text-background transition active:scale-[0.98]"
        >
          <SiApple aria-hidden className="h-4 w-4" />
          {t.computerAd.appStore}
        </a>
      </div>
    </div>
  );
}

/**
 * What a computer sees instead of the website (#270): on the left the name,
 * what the app does and a QR code to it; on the right the app's own animation. An invite or friend link opened on a computer gets the same page, with
 * who invited you and a code that holds that very link, so scanning it lands
 * in the group, through the App Store too (#237). The help pages, the terms and
 * the privacy policy stay as they are (App.tsx), and so does finishing an
 * email's link on the sign-in page.
 */
export default function ComputerAd({ kind = "home" }: { kind?: "home" | "invite" | "friend" }) {
  const t = useT();
  const { lang } = useLang();
  const { token } = useParams();
  const { user, signOut } = useAuth();

  const invite = useQuery({
    queryKey: ["invite-preview", token],
    queryFn: () => previewInvite(token ?? ""),
    enabled: kind === "invite" && !!token,
    retry: false,
  });
  const friend = useQuery({
    queryKey: ["friend-preview", token],
    queryFn: () => previewFriend(token ?? ""),
    enabled: kind === "friend" && !!token,
    retry: false,
  });

  // The code holds the address as it would be sent: the site's own, whatever this one is.
  const here = `${SITE_URL}${window.location.pathname}`;
  const group = invite.data?.group;
  const friendName = friend.data?.friend.name;

  return (
    <div className="relative overflow-hidden bg-background text-foreground">
      <Bubbles />
      {/* Floating in the corner, so the phone can have the window's whole height. */}
      <div className="absolute right-6 top-5 z-10">
        <LanguageToggle />
      </div>
      <main className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-12 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-16">
        {/* Over the colour shapes, which spill out from beside the phone. */}
        <section className="relative z-10 flex w-fit min-w-0 max-w-[36rem] flex-col items-start">
          {/* As wide as the column's longest line, so the name spans the text under it;
              never so tall that the card falls below a short window. */}
          <h1 className="w-full max-w-[46vh]">
            <LogoMark label={appName(lang)} className="block h-auto w-full text-[#FF4D00]" />
          </h1>
          <p className="mt-8 text-[1.625rem] font-bold leading-tight">{t.computerAd.tagline}</p>
          <p className="mt-2 text-[1.0625rem] leading-relaxed text-muted-foreground">
            {t.computerAd.about}
          </p>

          {(kind === "invite" && group) || kind === "friend" ? (
            <p className="mt-6 text-[1.0625rem] font-semibold text-primary">
              {kind === "friend"
                ? friendName
                  ? t.friendLink.asks(friendName)
                  : t.friendLink.asksAnon
                : group!.invitedBy
                  ? t.computerAd.invited(group!.invitedBy, group!.name)
                  : t.computerAd.invitedAnon(group!.name)}
            </p>
          ) : null}

          <div className="mt-8">
            {kind === "home" ? (
              <GetTheApp link={APP_URL} scanLine={t.computerAd.scan} label={t.computerAd.qrLabel} />
            ) : (
              <GetTheApp
                link={here}
                scanLine={kind === "invite" ? t.computerAd.inviteScan : t.computerAd.friendScan}
                label={t.computerAd.inviteQrLabel}
              />
            )}
          </div>

          {user && (
            <p className="mt-6 text-[0.875rem] text-muted-foreground">
              {t.computerAd.signedIn(displayName(user))}{" "}
              <button
                type="button"
                onClick={() => void signOut()}
                className="hit font-semibold text-primary underline-offset-2 hover:underline"
              >
                {t.computerAd.signOut}
              </button>
            </p>
          )}
        </section>
        <section className="flex justify-center">
          <PlayingPhone />
        </section>
      </main>
    </div>
  );
}
