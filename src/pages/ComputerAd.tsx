import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";

import { previewFriend, previewInvite } from "@/api/groups";
import ChatScene from "@/components/chatScene/ChatScene";
import { ACTIVITIES, CUE_TARGETS, type SceneName, type Words } from "@/components/chatScene/script";
import LanguageToggle from "@/components/LanguageToggle";
import QrCode from "@/components/ui/QrCode";
import LogoMark from "@/components/ui/LogoMark";
import PhoneDevice from "@/components/welcome/phone/PhoneDevice";
import { DEVICE } from "@/components/welcome/phone/geometry";
import { displayName, useAuth } from "@/context/auth";
import { APP_NAME } from "@/i18n/brand";
import { useLang, useT } from "@/i18n/lang";
import { APP_STORE_URL } from "@/lib/appStore";
import { APP_URL, SITE_URL } from "@/lib/nativeApp";

/** Wide enough for the app's lines beside the phone, with arrows; narrower, they stand above it. */
const BESIDE = "(min-width: 1180px)";
/** The room left of the phone that the lines and their arrows take, in px. */
const ZONE = 280;

/** The phone's size and where the lines go, following the window. */
function useStage(): { scale: number; beside: boolean } {
  const read = () => {
    const beside = window.matchMedia(BESIDE).matches;
    // Beside, the phone takes the window's height; above it, the line takes some.
    // Always with room to spare: the window's height less a margin, and never above 0.82.
    const room = beside ? window.innerHeight - 96 : window.innerHeight - 220;
    return { beside, scale: Math.min(0.82, Math.max(0.45, room / DEVICE.height)) };
  };
  const [stage, setStage] = useState(read);
  useEffect(() => {
    const onResize = () => setStage(read());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return stage;
}

/**
 * Where in the stage the cue's subject is (its left edge, its middle), followed
 * every frame while the cue stands, since the chat keeps moving under it.
 */
function useTarget(stage: React.RefObject<HTMLDivElement | null>, cue: Words | null, on: boolean) {
  const name = cue && on ? CUE_TARGETS.get(cue) : undefined;
  const [at, setAt] = useState<{ name: string; x: number; y: number } | null>(null);
  useEffect(() => {
    if (!name) return;
    let frame = 0;
    const follow = () => {
      const host = stage.current;
      const el = host?.querySelector(`[data-cue-target="${name}"]`);
      if (host && el) {
        const h = host.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        const next = { name, x: r.left - h.left, y: r.top - h.top + r.height / 2 };
        setAt((prev) =>
          prev?.name === name && Math.abs(prev.x - next.x) < 0.5 && Math.abs(prev.y - next.y) < 0.5
            ? prev
            : next,
        );
      }
      frame = requestAnimationFrame(follow);
    };
    frame = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(frame);
  }, [stage, name]);
  // Only this cue's own subject: none until it has been found on the screen.
  return name && at?.name === name ? at : null;
}

/**
 * The phone on the right: the joke's stories (#275) playing by themselves,
 * one after the other with a new plan each time. On a wide screen the app's
 * lines stand to the left of the phone, each with an arrow to what it is about
 * (the plan's last word, the link in the field, the found day); narrower, above
 * it. Nothing to press: a phone on a computer's screen is to watch, not to hold.
 */
function PlayingPhone() {
  const { lang } = useLang();
  const { scale, beside } = useStage();
  const [round, setRound] = useState(0);
  const [cue, setCue] = useState<Words | null>(null);
  const scene: SceneName = round % 2 === 0 ? "idea" : "again";
  const stage = useRef<HTMLDivElement>(null);
  const target = useTarget(stage, cue, beside);
  const phoneW = DEVICE.width * scale;
  const phoneH = DEVICE.height * scale;
  // The line sits a little above what it points at, its arrow curving down to it.
  // The line stands a little above its subject; its arrow ends at the phone's edge, level
  // with the subject, which the phone rings in orange.
  const lineY = target ? Math.min(Math.max(target.y - 40, 40), phoneH - 60) : 0;
  const from = { x: ZONE - 44, y: lineY + 4 };
  const to = target ? { x: ZONE - 10, y: target.y } : from;

  const line = (className: string) =>
    cue && (
      <motion.p
        key={cue.da}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        className={className}
        aria-live="polite"
      >
        {cue[lang]}
      </motion.p>
    );

  const phone = (
    <div style={{ width: phoneW, height: phoneH }} aria-hidden>
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
  );

  if (!beside) {
    return (
      <div className="flex flex-col items-center gap-4" style={{ width: phoneW }}>
        <div className="flex h-[5.25rem] w-full items-end justify-center">
          <AnimatePresence mode="wait">
            {line("text-balance text-center text-[1.75rem] font-bold leading-tight")}
          </AnimatePresence>
        </div>
        {phone}
      </div>
    );
  }

  return (
    <div ref={stage} className="relative" style={{ width: ZONE + phoneW, height: phoneH }}>
      <div className="absolute right-0 top-0">{phone}</div>
      <AnimatePresence>
        {target && (
          <motion.div
            key={cue?.da}
            className="pointer-events-none absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute left-0 flex justify-end"
              style={{ top: lineY, width: ZONE - 56, transform: "translateY(-50%)" }}
            >
              {line("text-balance text-right text-[1.5rem] font-bold leading-tight")}
            </div>
            <svg
              className="absolute inset-0 overflow-visible"
              width={ZONE + phoneW}
              height={phoneH}
              aria-hidden
            >
              <defs>
                <marker
                  id="cue-arrow"
                  viewBox="0 0 10 10"
                  refX="7"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path
                    d="M1 1 L8 5 L1 9"
                    fill="none"
                    stroke="#FF4D00"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </marker>
              </defs>
              <motion.path
                d={`M ${from.x} ${from.y} Q ${from.x + 6} ${to.y} ${to.x} ${to.y}`}
                fill="none"
                stroke="#FF4D00"
                strokeWidth="2.5"
                strokeLinecap="round"
                markerEnd="url(#cue-arrow)"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.5, ease: "easeOut", delay: 0.15 }}
              />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** The QR code and the ways to the app beside it. */
function GetTheApp({ link, scanLine, label }: { link: string; scanLine: string; label: string }) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-border">
        <QrCode value={link} label={label} border={2} className="h-40 w-40" />
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-[1.0625rem] font-semibold">{scanLine}</p>
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
    <div className="relative bg-background text-foreground">
      {/* Floating in the corner, so the phone can have the window's whole height. */}
      <div className="absolute right-6 top-5 z-10">
        <LanguageToggle />
      </div>
      <main className="mx-auto grid min-h-screen max-w-6xl items-center gap-12 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-16">
        <section className="flex min-w-0 flex-col gap-6">
          <h1>
            <LogoMark label={APP_NAME} className="block w-[min(24rem,30vw,38vh)] text-[#FF4D00]" />
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
            <GetTheApp link={APP_URL} scanLine={t.computerAd.scan} label={t.computerAd.qrLabel} />
          ) : (
            <GetTheApp
              link={here}
              scanLine={kind === "invite" ? t.computerAd.inviteScan : t.computerAd.friendScan}
              label={t.computerAd.inviteQrLabel}
            />
          )}

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
