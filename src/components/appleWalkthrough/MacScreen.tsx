import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SiApple } from "react-icons/si";
import { ArrowRight, Fingerprint, Plus, Search, ShoppingBag, X } from "lucide-react";

import {
  at,
  BLUE,
  FAINT_BLUE,
  GREY,
  INK,
  MAC_CHROME,
  PERSON,
  SIZE,
  type SceneId,
} from "@/components/appleWalkthrough/layout";
import { Avatar, DotRing, DottedAppleIcon, SceneFade, TileIcon } from "@/components/appleWalkthrough/Parts";
import {
  EXAMPLE_CODE,
  EXAMPLE_PASSWORD,
  useAppleWords,
  type AppleWords,
} from "@/components/appleWalkthrough/words";
import { cn } from "@/lib/utils";

/**
 * account.apple.com in Safari on a Mac, one scene at a time, drawn from
 * screenshots. Coordinates are the drawing's own (SIZE.mac, bar included);
 * the walkthrough's cursor targets in AppleWalkthrough.tsx point into them,
 * so moving something here means moving its target there too.
 */

const W = SIZE.mac.w;
/** The page's height, below the browser bar. */
const PAGE_H = SIZE.mac.h - MAC_CHROME;

const URLS: Record<SceneId, string> = {
  landing: "account.apple.com",
  biometric: "account.apple.com/sign-in",
  signIn: "account.apple.com/sign-in",
  code: "account.apple.com/sign-in",
  security: "account.apple.com/account/manage",
  list: "account.apple.com/account/manage",
  generate: "account.apple.com/account/manage",
  confirm: "account.apple.com/account/manage",
  reveal: "account.apple.com/account/manage",
};

function BrowserBar({ url }: { url: string }) {
  return (
    <div style={at(0, 0, W, MAC_CHROME)} className="flex items-center border-b border-[#d8d8dc] bg-[#f3f3f5] px-3">
      <span className="flex gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
      </span>
      <span className="mx-auto w-[300px] truncate rounded-md bg-[#e4e4e8] px-3 py-1 text-center text-[9px] text-[#3a3a3c]">
        {url}
      </span>
      <span className="w-[46px]" />
    </div>
  );
}

function AppleNav({ a }: { a: AppleWords }) {
  return (
    <div style={at(0, 0, W, 24)} className="flex items-center justify-center gap-[17px] text-[7.5px]">
      <SiApple className="h-2.5 w-2.5" style={{ color: INK }} />
      {a.nav.map((item) => (
        <span key={item} style={{ color: INK }}>
          {item}
        </span>
      ))}
      <Search className="h-2.5 w-2.5" style={{ color: INK }} />
      <ShoppingBag className="h-2.5 w-2.5" style={{ color: INK }} />
    </div>
  );
}

function AccountHeader({ a, signedIn }: { a: AppleWords; signedIn: boolean }) {
  return (
    <div style={at(100, 24, 520, 36)} className="flex items-center justify-between border-b border-[#d2d2d7]">
      <span className="text-[14px] font-semibold" style={{ color: INK }}>
        {a.account}
      </span>
      {signedIn ? (
        <span className="rounded-full px-2 py-0.5 text-[8px] text-white" style={{ background: BLUE }}>
          {a.signOut}
        </span>
      ) : (
        <span className="flex gap-3 text-[8px]" style={{ color: INK }}>
          {a.headerLinks.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </span>
      )}
    </div>
  );
}

function Field({
  left,
  top,
  width,
  placeholder,
  value,
  caret,
  children,
}: {
  left: number;
  top: number;
  width: number;
  placeholder: string;
  value?: string;
  caret?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      style={at(left, top, width, 26)}
      className="flex items-center rounded-[7px] border border-[#86868b] bg-white px-2.5 text-[10px]"
    >
      {value ? <span style={{ color: INK }}>{value}</span> : <span style={{ color: GREY }}>{placeholder}</span>}
      {caret && <span className="ml-px h-3 w-px animate-pulse" style={{ background: INK }} />}
      {children}
    </div>
  );
}

/** A full-width button in one of Apple's small dialogs; `faint` until it can be pressed. */
function DialogButton({ top, label, filled, faint }: { top: number; label: string; filled?: boolean; faint?: boolean }) {
  return (
    <div
      style={{
        ...at(255, top, 210, 22),
        background: filled ? (faint ? FAINT_BLUE : BLUE) : "white",
        color: filled ? "white" : BLUE,
        borderColor: BLUE,
      }}
      className={cn("flex items-center justify-center rounded-[7px] text-[9px] transition-colors", !filled && "border")}
    >
      {label}
    </div>
  );
}

function LandingPage({ a }: { a: AppleWords }) {
  return (
    <>
      <div style={at(0, 60, W, PAGE_H - 60)} className="bg-[#f5f5f7]" />
      <AppleNav a={a} />
      <AccountHeader a={a} signedIn={false} />
      <div style={at(290, 80, 140, 140)}>
        <DotRing />
        <span style={at(53, 50, 34, 40)} className="flex items-center justify-center">
          <SiApple className="h-8 w-8" style={{ color: "#000" }} />
        </span>
      </div>
      <p style={{ ...at(0, 232, W), color: INK }} className="text-center text-[24px] font-semibold tracking-tight">
        {a.landingTitle}
      </p>
      <p style={{ ...at(150, 272, 420), color: INK }} className="text-center text-[10px] leading-snug">
        {a.landingBody}
      </p>
      <div
        style={{ ...at(322, 330, 76, 26), background: BLUE }}
        className="flex items-center justify-center rounded-full text-[11px] text-white"
      >
        {a.signIn}
      </div>
    </>
  );
}

/** The Touch ID box Safari puts over the sign-in page. */
function BiometricSheet({ a }: { a: AppleWords }) {
  return (
    <>
      <AppleNav a={a} />
      <AccountHeader a={a} signedIn={false} />
      <div style={at(0, 0, W, PAGE_H)} className="bg-black/45" />
      <div style={at(225, 70, 270, 250)} className="rounded-[14px] border border-white/10 bg-[#2a2a2c] shadow-2xl" />
      <span style={at(239, 80)} className="text-[13px] font-semibold text-white">
        {a.account}
      </span>
      <span style={at(425, 80, 58, 18)} className="flex items-center justify-center rounded-full bg-[#48484a] text-[8.5px] text-white">
        {a.cancel}
      </span>
      <span style={at(346, 112, 28, 28)} className="flex items-center justify-center rounded-[7px] bg-white">
        <SiApple className="h-4 w-4" style={{ color: "#000" }} />
      </span>
      <p style={at(225, 150, 270)} className="text-center text-[8.5px] text-white">
        {a.sheetText}
      </p>
      <div style={at(245, 166, 230, 34)} className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2">
        <Avatar size={22} fontSize={8} />
        <span className="flex flex-col">
          <span className="text-[9px] text-white">{PERSON.name}</span>
          <span className="text-[7.5px] text-white/60">{a.yourAccount}</span>
        </span>
      </div>
      <div style={at(239, 214, 242, 1)} className="bg-white/15" />
      <p style={at(225, 224, 270)} className="text-center text-[8.5px] text-[#3b9cff]">
        {a.otherAccount}
      </p>
      <span style={at(349, 245, 22, 22)} className="flex items-center justify-center">
        <Fingerprint className="h-[22px] w-[22px] text-[#e0526b]" />
      </span>
      <p style={at(225, 276, 270)} className="text-center text-[9px] text-white">
        {a.touchId}
      </p>
    </>
  );
}

/**
 * Signing in with email and password. Drawn before a screenshot of Apple's
 * real form existed (IphoneScreen has the real one), and kept as it is.
 */
function SignInForm({ a, phase }: { a: AppleWords; phase: number }) {
  return (
    <>
      <AppleNav a={a} />
      <AccountHeader a={a} signedIn={false} />
      <span style={at(347, 86, 26, 28)} className="flex items-center justify-center">
        <SiApple className="h-6 w-6" style={{ color: INK }} />
      </span>
      <p style={{ ...at(0, 120, W), color: INK }} className="text-center text-[15px] font-semibold">
        {a.account}
      </p>
      <Field left={250} top={150} width={220} placeholder={a.macEmailField} value={phase >= 1 ? PERSON.email : undefined} caret={phase === 1} />
      <Field left={250} top={184} width={220} placeholder={a.passwordField} value={phase >= 2 ? "••••••••••" : undefined} caret={phase === 2}>
        <span style={{ borderColor: GREY }} className="ml-auto flex h-4 w-4 items-center justify-center rounded-full border">
          <ArrowRight className="h-2.5 w-2.5" style={{ color: GREY }} />
        </span>
      </Field>
    </>
  );
}

function CodeEntry({ a, phase }: { a: AppleWords; phase: number }) {
  return (
    <>
      <AppleNav a={a} />
      <AccountHeader a={a} signedIn={false} />
      <p style={{ ...at(0, 110, W), color: INK }} className="text-center text-[15px] font-semibold">
        {a.twoFactor}
      </p>
      {Array.from({ length: 6 }, (_, i) => (
        <span
          key={i}
          style={{ ...at(262 + i * 34, 150, 26, 32), color: INK }}
          className="flex items-center justify-center rounded-[7px] border border-[#86868b] bg-white text-[14px]"
        >
          {phase >= 1 ? EXAMPLE_CODE[i] : ""}
        </span>
      ))}
    </>
  );
}

/** Login og sikkerhed, where Apple lands you after signing in. */
function SecurityPage({ a, scrolled, hover }: { a: AppleWords; scrolled: boolean; hover: boolean }) {
  return (
    <>
      <AppleNav a={a} />
      <AccountHeader a={a} signedIn />
      <div style={at(0, 60, W, PAGE_H - 60)} className="overflow-hidden">
        <motion.div
          animate={{ y: scrolled ? -110 : 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          style={at(0, 0, W, 420)}
        >
          <span
            style={at(100, 20, 40, 40)}
            className="flex items-center justify-center rounded-full bg-gradient-to-b from-[#d1d5db] to-[#9ca3af] text-[12px] font-semibold text-white"
          >
            {PERSON.initials}
          </span>
          <span style={{ ...at(100, 68), color: INK }} className="text-[11px] font-semibold">
            {PERSON.name}
          </span>
          <span style={{ ...at(100, 84), color: GREY }} className="text-[8.5px]">
            {PERSON.email}
          </span>
          {a.menu.map((item, i) => (
            <span
              key={item}
              style={{ ...at(100, 110 + i * 16), color: i === 1 ? BLUE : INK }}
              className={cn("text-[9px]", i === 1 && "font-semibold")}
            >
              {item}
            </span>
          ))}
          <span style={{ ...at(258, 18), color: INK }} className="text-[18px] font-bold tracking-tight">
            {a.security}
          </span>
          <p style={{ ...at(258, 46, 360), color: INK }} className="text-[8.5px] leading-snug">
            {a.securityBody}
          </p>
          {a.tiles.map(([title, ...lines], i) => (
            <div
              key={title}
              style={at(i % 2 === 0 ? 258 : 444, 90 + Math.floor(i / 2) * 72, 176, 62)}
              className={cn(
                "rounded-[10px] border bg-white px-3 py-2.5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] transition-shadow",
                i === a.tiles.length - 1 && hover ? "border-[#0071e3] ring-2 ring-[#0071e3]/25" : "border-[#e5e5ea]",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="truncate text-[9px] font-semibold" style={{ color: INK }}>
                  {title}
                </span>
                <TileIcon index={i} size={12} />
              </div>
              {lines.map((line) => (
                <p key={line} className="mt-0.5 truncate text-[8px]" style={{ color: GREY }}>
                  {line}
                </p>
              ))}
            </div>
          ))}
        </motion.div>
      </div>
    </>
  );
}

/** The App-Specific Passwords box, as a first-timer sees it: no passwords yet. */
function ListModal({ a }: { a: AppleWords }) {
  return (
    <>
      <div style={at(0, 0, W, PAGE_H)} className="bg-[#f5f5f7]/80" />
      <div style={at(160, 30, 400, 300)} className="rounded-[16px] bg-white shadow-[0_8px_40px_rgba(0,0,0,0.12)]" />
      <X style={{ ...at(176, 46, 12, 12), color: INK }} />
      <p style={{ ...at(160, 96, 400), color: INK }} className="text-center text-[15px] font-semibold">
        {a.listTitle}
      </p>
      <p style={{ ...at(210, 126, 300), color: INK }} className="text-center text-[9px] leading-snug">
        {a.listBody}
      </p>
      <p style={{ ...at(160, 156, 400), color: BLUE }} className="text-center text-[9px]">
        {a.listLink} ↗
      </p>
      <span style={{ ...at(200, 198), color: INK }} className="text-[12px] font-semibold">
        {a.passwords}
      </span>
      <Plus strokeWidth={2.25} style={{ ...at(500, 197, 16, 16), color: BLUE }} />
    </>
  );
}

/** One of Apple's small boxes that open over the list. */
function SmallModal({ top, height, children }: { top: number; height: number; children: ReactNode }) {
  return (
    <>
      <div style={at(0, 0, W, PAGE_H)} className="bg-white/55" />
      <div style={at(235, top, 250, height)} className="rounded-[14px] bg-white shadow-[0_8px_40px_rgba(0,0,0,0.18)]" />
      {children}
    </>
  );
}

function GenerateModal({ a, phase }: { a: AppleWords; phase: number }) {
  return (
    <SmallModal top={60} height={232}>
      <DottedAppleIcon cx={360} cy={92} />
      <p style={{ ...at(235, 112, 250), color: INK }} className="text-center text-[10.5px] font-semibold">
        {a.generateTitle}
      </p>
      <p style={{ ...at(250, 131, 220), color: GREY }} className="text-center text-[8px] leading-snug">
        {a.listBody}
      </p>
      <Field left={255} top={168} width={210} placeholder={a.namePlaceholder} value={phase >= 1 ? "Casy" : undefined} caret={phase >= 1} />
      <DialogButton top={208} label={a.create} filled faint={phase < 1} />
      <DialogButton top={238} label={a.cancel} />
    </SmallModal>
  );
}

function ConfirmModal({ a, phase }: { a: AppleWords; phase: number }) {
  return (
    <SmallModal top={60} height={234}>
      <DottedAppleIcon cx={360} cy={92} />
      <p style={{ ...at(235, 112, 250), color: INK }} className="text-center text-[10.5px] font-semibold">
        {a.confirmTitle}
      </p>
      <p style={{ ...at(250, 131, 220), color: GREY }} className="text-center text-[8px] leading-snug">
        {a.confirmBody}
        <br />
        {PERSON.email}
      </p>
      <Field left={270} top={172} width={180} placeholder={a.passwordField} value={phase >= 1 ? "••••••••••" : undefined} caret={phase >= 1} />
      <DialogButton top={210} label={a.continue} filled faint={phase < 1} />
      <DialogButton top={240} label={a.cancel} />
    </SmallModal>
  );
}

/** The new password. Phase 1 has it selected (three clicks), phase 2 adds ⌘C. */
function RevealModal({ a, phase }: { a: AppleWords; phase: number }) {
  return (
    <SmallModal top={70} height={196}>
      <DottedAppleIcon cx={360} cy={100} />
      <p style={{ ...at(235, 119, 250), color: INK }} className="text-center text-[10.5px] font-semibold">
        {a.revealTitle}
      </p>
      <p style={{ ...at(235, 137, 250), color: INK }} className="text-center text-[12px] font-semibold">
        <span className={cn("rounded-sm px-0.5", phase >= 1 && "bg-[#b3d7ff]")}>{EXAMPLE_PASSWORD.join("-")}</span>
      </p>
      <p style={{ ...at(250, 160, 220), color: GREY }} className="text-center text-[8px] leading-snug">
        {a.revealBody}
      </p>
      <DialogButton top={214} label={a.ok} filled />
      <AnimatePresence>
        {phase >= 2 && (
          <motion.span
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            style={at(432, 137)}
            className="rounded-md border border-[#c7c7cc] bg-white px-1.5 py-0.5 text-[10px] font-semibold shadow-md"
          >
            ⌘ C
          </motion.span>
        )}
      </AnimatePresence>
    </SmallModal>
  );
}

function Scene({ id, phase, a }: { id: SceneId; phase: number; a: AppleWords }) {
  switch (id) {
    case "landing":
      return <LandingPage a={a} />;
    case "biometric":
      return <BiometricSheet a={a} />;
    case "signIn":
      return <SignInForm a={a} phase={phase} />;
    case "code":
      return <CodeEntry a={a} phase={phase} />;
    case "security":
      return <SecurityPage a={a} scrolled={phase >= 1} hover={phase >= 2} />;
    case "list":
      return (
        <>
          <SecurityPage a={a} scrolled hover={false} />
          <ListModal a={a} />
        </>
      );
    case "generate":
    case "confirm":
    case "reveal":
      return (
        <>
          <SecurityPage a={a} scrolled hover={false} />
          <ListModal a={a} />
          {id === "generate" && <GenerateModal a={a} phase={phase} />}
          {id === "confirm" && <ConfirmModal a={a} phase={phase} />}
          {id === "reveal" && <RevealModal a={a} phase={phase} />}
        </>
      );
  }
}

/** The whole Mac drawing for one moment: the browser bar and the page in it. */
export default function MacScreen({ scene, phase }: { scene: SceneId; phase: number }) {
  const a = useAppleWords();
  return (
    <>
      <BrowserBar url={URLS[scene]} />
      <div style={at(0, MAC_CHROME, W, PAGE_H)} className="overflow-hidden bg-white">
        <SceneFade scene={scene} width={W} height={PAGE_H}>
          <Scene id={scene} phase={phase} a={a} />
        </SceneFade>
      </div>
    </>
  );
}
