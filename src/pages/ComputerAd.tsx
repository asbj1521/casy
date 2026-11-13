import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";

import { previewFriend, previewInvite } from "@/api/groups";
import ChatScene from "@/components/chatScene/ChatScene";
import { ACTIVITIES, type SceneName, type Words } from "@/components/chatScene/script";
import LanguageToggle from "@/components/LanguageToggle";
import QrCode from "@/components/ui/QrCode";
import Wordmark from "@/components/ui/Wordmark";
import PhoneDevice from "@/components/welcome/phone/PhoneDevice";
import { DEVICE } from "@/components/welcome/phone/geometry";
import { displayName, useAuth } from "@/context/auth";
import { APP_NAME } from "@/i18n/brand";
import { useLang, useT } from "@/i18n/lang";
import { APP_STORE_URL } from "@/lib/appStore";
import { SITE_URL } from "@/lib/nativeApp";

/** How tall the phone may be: the window's height less room for its cue and the page's edges. */
function usePhoneScale(): number {
  const fit = () => Math.min(0.8, Math.max(0.45, (window.innerHeight - 190) / DEVICE.height));
  const [scale, setScale] = useState(fit);
  useEffect(() => {
    const onResize = () => setScale(fit());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return scale;
}

/**
 * The phone on the right: the joke's stories (#275) playing by themselves,
 * one after the other with a new plan each time, and the app's lines above it.
 * Nothing to press: a phone on a computer's screen is to watch, not to hold.
 */
function PlayingPhone() {
  const { lang } = useLang();
  const scale = usePhoneScale();
  const [round, setRound] = useState(0);
  const [cue, setCue] = useState<Words | null>(null);
  const scene: SceneName = round % 2 === 0 ? "idea" : "again";

  return (
    <div className="flex flex-col items-center gap-4" style={{ width: DEVICE.width * scale }}>
      <div className="flex h-[5.25rem] w-full items-end justify-center">
        <AnimatePresence mode="wait">
          {cue && (
            <motion.p
              key={cue.da}
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              className="text-balance text-center text-[1.75rem] font-bold leading-tight"
              aria-live="polite"
            >
              {cue[lang]}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
      <div style={{ width: DEVICE.width * scale, height: DEVICE.height * scale }} aria-hidden>
        <div
          className="relative origin-top-left"
          style={{ width: DEVICE.width, height: DEVICE.height, transform: `scale(${scale})` }}
        >
          <PhoneDevice>
            <ChatScene
              key={round}
              scene={scene}
              activity={round % ACTIVITIES.length}
              mode="auto"
              onCue={setCue}
              onEnd={() => {
                setCue(null);
                setRound((r) => r + 1);
              }}
            />
          </PhoneDevice>
        </div>
      </div>
    </div>
  );
}

/** The QR code and the ways to the app beside it. */
function GetTheApp({ link, scanLine, label }: { link: string; scanLine: string; label: string }) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="rounded-2xl bg-white p-2 shadow-sm ring-1 ring-border">
        <QrCode value={link} label={label} className="h-36 w-36" />
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-[1.0625rem] font-semibold">{scanLine}</p>
        <p className="text-[0.9375rem] text-muted-foreground">{t.computerAd.orGo}</p>
        <a
          href={APP_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="glass-pill mt-1 inline-flex w-fit items-center rounded-full px-5 py-2.5 text-[0.9375rem] font-semibold text-primary"
        >
          {t.computerAd.appStore}
        </a>
      </div>
    </div>
  );
}

/**
 * What a computer sees instead of the website (#270): on the left the name,
 * what the app does and a QR code to it; on the right a phone playing the
 * joke. An invite or friend link opened on a computer gets the same page, with
 * who invited you and a code that holds that very link, so scanning it lands
 * in the group, through the App Store too (#237). The help pages, the terms and
 * the privacy policy stay as they are (App.tsx), and so does finishing an
 * email's link on the sign-in page.
 */
export default function ComputerAd({ kind = "home" }: { kind?: "home" | "invite" | "friend" }) {
  const t = useT();
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
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex justify-end px-6 pt-5">
        <LanguageToggle />
      </div>
      <main className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-12 pt-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-16">
        <section className="flex min-w-0 flex-col gap-6">
          <h1>
            <Wordmark className="block text-[clamp(3.25rem,7vw,6.25rem)] text-[#FF4D00]" />
            <span className="sr-only">{APP_NAME}</span>
          </h1>
          <p className="text-balance text-[1.75rem] font-bold leading-tight">
            {t.computerAd.tagline}
          </p>
          <p className="max-w-[34rem] text-[1.0625rem] leading-relaxed text-muted-foreground">
            {t.computerAd.about}
          </p>

          {kind === "invite" && group && (
            <p className="text-[1.25rem] font-semibold">
              {group.invitedBy
                ? t.computerAd.invited(group.invitedBy, group.name)
                : t.computerAd.invitedAnon(group.name)}
            </p>
          )}
          {kind === "friend" && (
            <p className="text-[1.25rem] font-semibold">
              {friendName ? t.friendLink.asks(friendName) : t.friendLink.asksAnon}
            </p>
          )}

          {kind === "home" ? (
            <GetTheApp
              link={`${SITE_URL}/app`}
              scanLine={t.computerAd.scan}
              label={t.computerAd.qrLabel}
            />
          ) : (
            <GetTheApp
              link={here}
              scanLine={kind === "invite" ? t.computerAd.inviteScan : t.computerAd.friendScan}
              label={t.computerAd.inviteQrLabel}
            />
          )}

          <p className="text-[0.875rem] text-muted-foreground">{t.computerAd.android}</p>

          {user && (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.875rem] text-muted-foreground">
              {t.computerAd.signedIn(displayName(user))}
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
