import { Fragment, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SiApple } from "react-icons/si";
import {
  ChevronDown,
  ChevronRight,
  KeyRound,
  Menu,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  X,
} from "lucide-react";

import {
  at,
  BLUE,
  FAINT_BLUE,
  GREY,
  INK,
  PERSON,
  SIZE,
  type SceneId,
} from "@/components/appleWalkthrough/layout";
import {
  Avatar,
  DotRing,
  DottedAppleIcon,
  SceneFade,
  TileIcon,
} from "@/components/appleWalkthrough/Parts";
import {
  EXAMPLE_CODE,
  EXAMPLE_PASSWORD,
  useAppleWords,
  type AppleWords,
} from "@/components/appleWalkthrough/words";
import { cn } from "@/lib/utils";

/**
 * account.apple.com in Safari on an iPhone, one scene at a time, drawn from
 * screenshots. The phone's layout differs from the Mac's in ways that matter
 * to someone following along: one column of tiles (so a long scroll to the
 * one you need), a sign-in sheet that rises from the bottom, a list that
 * fills the screen, and copying by press and hold, which selects only one
 * group of the password until its handles are dragged out.
 *
 * Coordinates are the drawing's own (SIZE.iphone); the walkthrough's touch
 * targets in AppleWalkthrough.tsx point into them.
 */

const W = SIZE.iphone.w;
const H = SIZE.iphone.h;

/** Apple's bar: logo, then search, bag and menu. */
function PhoneNav() {
  return (
    <div style={at(0, 0, W, 40)} className="flex items-center px-4">
      <SiApple className="h-[18px] w-[18px]" style={{ color: INK }} />
      <span className="ml-auto flex items-center gap-5">
        <Search className="h-[17px] w-[17px]" style={{ color: INK }} />
        <ShoppingBag className="h-[17px] w-[17px]" style={{ color: INK }} />
        <Menu className="h-[18px] w-[18px]" style={{ color: INK }} />
      </span>
    </div>
  );
}

/** "Apple-konto" with its section menu (and Log ud, once signed in). */
function PhoneHeader({
  a,
  signedIn,
  top = 40,
}: {
  a: AppleWords;
  signedIn: boolean;
  top?: number;
}) {
  return (
    <div
      style={at(0, top, W, 38)}
      className="flex items-center border-b border-[#d2d2d7] bg-white px-4"
    >
      <span className="text-[15px] font-semibold" style={{ color: INK }}>
        {a.account}
      </span>
      <span className="ml-auto flex items-center gap-4">
        <ChevronDown className="h-4 w-4" style={{ color: INK }} />
        {signedIn && (
          <span
            className="rounded-full px-3 py-0.5 text-[11px] text-white"
            style={{ background: BLUE }}
          >
            {a.signOut}
          </span>
        )}
      </span>
    </div>
  );
}

/** Safari's address, floating at the bottom of the screen. */
function SafariPill() {
  return (
    <span
      style={at(115, 606, 130, 24)}
      className="flex items-center justify-center rounded-full bg-[#8e8e93]/90 text-[10px] text-white shadow"
    >
      account.apple.com
    </span>
  );
}

function PhoneField({
  left = 16,
  top,
  width = 328,
  placeholder,
  value,
  caret,
}: {
  left?: number;
  top: number;
  width?: number;
  placeholder: string;
  value?: string;
  caret?: boolean;
}) {
  return (
    <div
      style={at(left, top, width, 40)}
      className="flex items-center rounded-[10px] border border-[#86868b] bg-white px-3 text-[12px]"
    >
      {value ? (
        <span style={{ color: INK }}>{value}</span>
      ) : (
        <span style={{ color: GREY }}>{placeholder}</span>
      )}
      {caret && <span className="ml-px h-4 w-px animate-pulse" style={{ background: INK }} />}
    </div>
  );
}

function PhoneDialogButton({
  top,
  label,
  filled,
  faint,
}: {
  top: number;
  label: string;
  filled?: boolean;
  faint?: boolean;
}) {
  return (
    <div
      style={{
        ...at(66, top, 228, 30),
        background: filled ? (faint ? FAINT_BLUE : BLUE) : "white",
        color: filled ? "white" : BLUE,
        borderColor: BLUE,
      }}
      className={cn(
        "flex items-center justify-center rounded-[8px] text-[12px] transition-colors",
        !filled && "border",
      )}
    >
      {label}
    </div>
  );
}

function PhoneLanding({ a }: { a: AppleWords }) {
  return (
    <>
      <div style={at(0, 78, W, H - 78)} className="bg-[#f5f5f7]" />
      <PhoneNav />
      <PhoneHeader a={a} signedIn={false} />
      <div style={at(110, 104, 140, 140)}>
        <DotRing />
        <span style={at(53, 50, 34, 40)} className="flex items-center justify-center">
          <SiApple className="h-8 w-8" style={{ color: "#000" }} />
        </span>
      </div>
      <p
        style={{ ...at(0, 272, W), color: INK }}
        className="text-center text-[21px] font-semibold tracking-tight"
      >
        {a.landingTitle}
      </p>
      <p
        style={{ ...at(30, 310, 300), color: INK }}
        className="text-center text-[11.5px] leading-snug"
      >
        {a.landingBody}
      </p>
      <div
        style={{ ...at(138, 398, 84, 32), background: BLUE }}
        className="flex items-center justify-center rounded-full text-[13px] text-white"
      >
        {a.signIn}
      </div>
      <SafariPill />
    </>
  );
}

/** The Face ID sheet Safari raises over the sign-in page. */
function PhoneBiometric({ a }: { a: AppleWords }) {
  return (
    <>
      <div style={at(0, 78, W, H - 78)} className="bg-[#f5f5f7]" />
      <PhoneNav />
      <PhoneHeader a={a} signedIn={false} />
      <div style={at(110, 104, 140, 140)}>
        <DotRing />
      </div>
      <div style={at(0, 0, W, H)} className="bg-black/35" />
      <div style={at(8, 372, 344, 262)} className="rounded-[26px] bg-[#6a6a6d] shadow-2xl" />
      <span style={at(28, 392)} className="text-[16px] font-semibold text-white">
        {a.account}
      </span>
      <span
        style={at(302, 388, 34, 34)}
        className="flex items-center justify-center rounded-full border border-white/25 bg-white/10"
      >
        <X className="h-4 w-4 text-white" />
      </span>
      <span style={at(26, 436, 34, 34)}>
        <DotRing size={34} />
        <span style={at(11, 10, 12, 13)} className="flex items-center justify-center">
          <SiApple className="h-3 w-3 text-white" />
        </span>
      </span>
      <p style={at(70, 443, 262)} className="text-[9.5px] leading-snug text-white">
        {a.sheetText}
      </p>
      <div
        style={at(22, 486, 316, 46)}
        className="flex items-center gap-3 rounded-full bg-[#1c1c1e] px-2"
      >
        <Avatar size={32} fontSize={11} />
        <span className="text-[12px] text-white">{PERSON.name}</span>
      </div>
      <div style={at(8, 552, 344, 1)} className="bg-white/15" />
      <p style={at(8, 590, 344)} className="text-center text-[10.5px] text-[#64d2ff]">
        {a.otherAccount}
      </p>
    </>
  );
}

/** Apple's sign-in form: email, Fortsæt, then the password (phases 0, 1, 2). */
function PhoneSignIn({ a, phase }: { a: AppleWords; phase: number }) {
  return (
    <>
      <PhoneNav />
      <PhoneHeader a={a} signedIn={false} />
      <div style={at(135, 88, 90, 90)}>
        <DotRing size={90} />
        <span style={at(34, 32, 22, 26)} className="flex items-center justify-center">
          <SiApple className="h-5 w-5" style={{ color: "#000" }} />
        </span>
      </div>
      <p style={{ ...at(0, 184, W), color: INK }} className="text-center text-[19px] font-semibold">
        {a.account}
      </p>
      <p style={{ ...at(0, 212, W), color: INK }} className="text-center text-[12px]">
        {a.manageAccount}
      </p>
      <PhoneField
        top={240}
        placeholder={a.emailField}
        value={phase >= 1 ? PERSON.email : undefined}
        caret={phase === 1}
      />
      {phase >= 2 ? (
        <PhoneField top={290} placeholder={a.passwordField} value="••••••••••" caret />
      ) : (
        <p style={{ ...at(16, 294, 328), color: INK }} className="text-[9px] leading-snug">
          {a.privacy} <span style={{ color: BLUE }}>{a.privacyLink}</span>
        </p>
      )}
      <div
        style={{ ...at(16, 350, 154, 32), background: phase >= 1 ? BLUE : FAINT_BLUE }}
        className="flex items-center justify-center rounded-[9px] text-[12px] text-white transition-colors"
      >
        {a.continue}
      </div>
      <div
        style={at(178, 350, 166, 32)}
        className="flex items-center justify-center gap-1.5 rounded-[9px] bg-black text-[10.5px] text-white"
      >
        <KeyRound className="h-3.5 w-3.5" />
        {a.passkey}
      </div>
      <p
        style={{ ...at(178, 388, 166), color: INK }}
        className="text-center text-[7.5px] leading-snug"
      >
        {a.passkeyNote}
      </p>
      <SafariPill />
    </>
  );
}

function PhoneCode({ a, phase }: { a: AppleWords; phase: number }) {
  return (
    <>
      <PhoneNav />
      <PhoneHeader a={a} signedIn={false} />
      <p style={{ ...at(0, 150, W), color: INK }} className="text-center text-[18px] font-semibold">
        {a.twoFactor}
      </p>
      {Array.from({ length: 6 }, (_, i) => (
        <span
          key={i}
          style={{ ...at(52 + i * 44, 196, 36, 44), color: INK }}
          className="flex items-center justify-center rounded-[9px] border border-[#86868b] bg-white text-[18px]"
        >
          {phase >= 1 ? EXAMPLE_CODE[i] : ""}
        </span>
      ))}
      <SafariPill />
    </>
  );
}

/** How far the page scrolls to bring the last tile (App-specifikke adgang…) into view. */
const TILE_SCROLL = 527;

/** Login og sikkerhed: one column of tiles, the one to tap is the last. */
function PhoneSecurity({
  a,
  scrolled,
  hover,
}: {
  a: AppleWords;
  scrolled: boolean;
  hover: boolean;
}) {
  return (
    <>
      <div style={at(0, 0, W, H)} className="overflow-hidden">
        <motion.div
          animate={{ y: scrolled ? -TILE_SCROLL : 0 }}
          transition={{ duration: 1.4, ease: "easeInOut" }}
          style={at(0, 0, W, 1100)}
        >
          <PhoneNav />
          <PhoneHeader a={a} signedIn />
          <span
            style={{ ...at(52, 96), color: INK }}
            className="text-[20px] font-bold tracking-tight"
          >
            {a.security}
          </span>
          <p style={{ ...at(52, 128, 262), color: INK }} className="text-[10.5px] leading-snug">
            {a.securityBody}
          </p>
          {a.tiles.map(([title, ...lines], i) => (
            <div
              key={title}
              style={at(52, 204 + i * 116, 256, 98)}
              className={cn(
                "rounded-[14px] border bg-white px-4 py-3.5 shadow-[0_1px_6px_rgba(0,0,0,0.06)] transition-shadow",
                i === a.tiles.length - 1 && hover
                  ? "border-[#0071e3] ring-2 ring-[#0071e3]/25"
                  : "border-[#e5e5ea]",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="truncate text-[13.5px] font-semibold" style={{ color: INK }}>
                  {title}
                </span>
                <TileIcon index={i} size={17} />
              </div>
              {lines.map((line) => (
                <p key={line} className="mt-1 truncate text-[10.5px]" style={{ color: GREY }}>
                  {line}
                </p>
              ))}
            </div>
          ))}
        </motion.div>
      </div>
      {/* Once scrolled, Apple keeps its account bar pinned at the top. */}
      <AnimatePresence>
        {scrolled && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.5 }}
          >
            <PhoneHeader a={a} signedIn top={0} />
          </motion.div>
        )}
      </AnimatePresence>
      <SafariPill />
    </>
  );
}

/** The App-Specific Passwords list, filling the screen; a first-timer has none yet. */
function PhoneList({ a }: { a: AppleWords }) {
  return (
    <>
      <div style={at(0, 0, W, H)} className="bg-white" />
      <X style={{ ...at(18, 22, 20, 20), color: INK }} />
      <p
        style={{ ...at(0, 100, W), color: INK }}
        className="text-center text-[18.5px] font-semibold"
      >
        {a.listTitle}
      </p>
      <p
        style={{ ...at(24, 140, 312), color: INK }}
        className="text-center text-[10.5px] leading-snug"
      >
        {a.listBody}
      </p>
      <p style={{ ...at(0, 178, W), color: BLUE }} className="text-center text-[10.5px]">
        {a.listLink} ↗
      </p>
      <span style={{ ...at(16, 240), color: INK }} className="text-[15px] font-semibold">
        {a.passwords}
      </span>
      <Plus strokeWidth={2} style={{ ...at(318, 240, 22, 22), color: BLUE }} />
      <SafariPill />
    </>
  );
}

/** One of Apple's boxes over the list, centred on the screen. */
function PhoneCard({
  top,
  height,
  children,
}: {
  top: number;
  height: number;
  children: ReactNode;
}) {
  return (
    <>
      <div style={at(0, 0, W, H)} className="bg-[#e5e5ea]/75" />
      <div
        style={at(43, top, 274, height)}
        className="rounded-[16px] bg-white shadow-[0_8px_40px_rgba(0,0,0,0.15)]"
      />
      {children}
    </>
  );
}

function PhoneGenerate({ a, phase }: { a: AppleWords; phase: number }) {
  return (
    <PhoneCard top={150} height={330}>
      <DottedAppleIcon cx={180} cy={190} r={18} />
      <p
        style={{ ...at(55, 218, 250), color: INK }}
        className="text-center text-[15px] font-semibold leading-tight"
      >
        {a.generateTitle}
      </p>
      <p
        style={{ ...at(62, 264, 236), color: GREY }}
        className="text-center text-[10.5px] leading-snug"
      >
        {a.listBody}
      </p>
      <PhoneField
        left={66}
        top={318}
        width={228}
        placeholder={a.namePlaceholder}
        value={phase >= 1 ? "Casy" : undefined}
        caret={phase >= 1}
      />
      <PhoneDialogButton top={378} label={a.create} filled faint={phase < 1} />
      <PhoneDialogButton top={416} label={a.cancel} />
    </PhoneCard>
  );
}

function PhoneConfirm({ a, phase }: { a: AppleWords; phase: number }) {
  return (
    <PhoneCard top={160} height={320}>
      <DottedAppleIcon cx={180} cy={198} r={18} />
      <p
        style={{ ...at(55, 226, 250), color: INK }}
        className="text-center text-[15px] font-semibold"
      >
        {a.confirmTitle}
      </p>
      <p
        style={{ ...at(62, 252, 236), color: GREY }}
        className="text-center text-[10.5px] leading-snug"
      >
        {a.confirmBody}
        <br />
        {PERSON.email}
      </p>
      <PhoneField
        left={76}
        top={312}
        width={208}
        placeholder={a.passwordField}
        value={phase >= 1 ? "••••••••••" : undefined}
        caret={phase >= 1}
      />
      <PhoneDialogButton top={370} label={a.continue} filled faint={phase < 1} />
      <PhoneDialogButton top={408} label={a.cancel} />
    </PhoneCard>
  );
}

/** iOS's selection handle: a line with a dot, above the start or below the end. */
function Handle({ side }: { side: "start" | "end" }) {
  return (
    <span
      className={cn(
        "absolute top-0 h-full w-[2px] bg-[#0a84ff]",
        side === "start" ? "-left-px" : "-right-px",
      )}
    >
      <span
        className={cn(
          "absolute left-1/2 h-[9px] w-[9px] -translate-x-1/2 rounded-full bg-[#0a84ff]",
          side === "start" ? "-top-[8px]" : "-bottom-[8px]",
        )}
      />
    </span>
  );
}

/** The password, with the groups in `selected` highlighted as iOS does. */
function SelectablePassword({ selected }: { selected: number[] }) {
  const first = Math.min(...selected);
  const last = Math.max(...selected);
  return (
    <>
      {EXAMPLE_PASSWORD.map((group, i) => (
        <Fragment key={group}>
          {i > 0 && (
            <span
              className={cn(selected.includes(i - 1) && selected.includes(i) && "bg-[#b3d7ff]")}
            >
              -
            </span>
          )}
          <span className={cn("relative", selected.includes(i) && "bg-[#b3d7ff]")}>
            {group}
            {selected.length > 0 && i === first && <Handle side="start" />}
            {selected.length > 0 && i === last && <Handle side="end" />}
          </span>
        </Fragment>
      ))}
    </>
  );
}

/** Which groups are selected in each phase: one after the long press, then dragged out to all four. */
const SELECTED_BY_PHASE: number[][] = [[], [1], [0, 1], [0, 1, 2, 3], [0, 1, 2, 3]];

/**
 * The new password. Phase 1 is the long press (one group and iOS's text
 * menu), 2 and 3 drag the handles out, 4 is after Kopier (menu gone).
 */
function PhoneReveal({ a, phase }: { a: AppleWords; phase: number }) {
  const [copy, ...rest] = a.textMenu;
  return (
    <PhoneCard top={170} height={290}>
      <DottedAppleIcon cx={180} cy={208} r={18} />
      <p
        style={{ ...at(55, 234, 250), color: INK }}
        className="text-center text-[15px] font-semibold leading-tight"
      >
        {a.revealTitle}
      </p>
      <p
        style={{ ...at(43, 280, 274), color: INK }}
        className="text-center text-[16px] font-semibold"
      >
        <SelectablePassword selected={SELECTED_BY_PHASE[phase] ?? []} />
      </p>
      <p
        style={{ ...at(62, 314, 236), color: GREY }}
        className="text-center text-[10.5px] leading-snug"
      >
        {a.revealBody}
      </p>
      <PhoneDialogButton top={392} label={a.ok} filled />
      {phase >= 1 && phase <= 3 && (
        <div
          style={at(20, 312, 320, 30)}
          className="flex items-center justify-between rounded-full bg-[#636366]/95 px-3.5 text-[10.5px] text-white shadow-lg"
        >
          <span>{copy}</span>
          <span className="h-3.5 w-px bg-white/30" />
          <Sparkles className="h-3.5 w-3.5" />
          {rest.map((item) => (
            <Fragment key={item}>
              <span className="h-3.5 w-px bg-white/30" />
              <span>{item}</span>
            </Fragment>
          ))}
          <ChevronRight className="h-3.5 w-3.5" />
        </div>
      )}
    </PhoneCard>
  );
}

function Scene({ id, phase, a }: { id: SceneId; phase: number; a: AppleWords }) {
  switch (id) {
    case "landing":
      return <PhoneLanding a={a} />;
    case "biometric":
      return <PhoneBiometric a={a} />;
    case "signIn":
      return <PhoneSignIn a={a} phase={phase} />;
    case "code":
      return <PhoneCode a={a} phase={phase} />;
    case "security":
      return <PhoneSecurity a={a} scrolled={phase >= 1} hover={phase >= 2} />;
    case "list":
      return <PhoneList a={a} />;
    case "generate":
      return (
        <>
          <PhoneList a={a} />
          <PhoneGenerate a={a} phase={phase} />
        </>
      );
    case "confirm":
      return (
        <>
          <PhoneList a={a} />
          <PhoneConfirm a={a} phase={phase} />
        </>
      );
    case "reveal":
      return (
        <>
          <PhoneList a={a} />
          <PhoneReveal a={a} phase={phase} />
        </>
      );
  }
}

/** The whole iPhone drawing for one moment: the screen below the status bar. */
export default function IphoneScreen({ scene, phase }: { scene: SceneId; phase: number }) {
  const a = useAppleWords();
  return (
    <div style={at(0, 0, W, H)} className="overflow-hidden bg-white">
      <SceneFade scene={scene} width={W} height={H}>
        <Scene id={scene} phase={phase} a={a} />
      </SceneFade>
    </div>
  );
}
