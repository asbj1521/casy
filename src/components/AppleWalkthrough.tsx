import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { SiApple } from "react-icons/si";
import {
  Apple,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Contact,
  Diamond,
  Fingerprint,
  LifeBuoy,
  Pause,
  Play,
  Plus,
  RectangleEllipsis,
  RotateCcw,
  Search,
  ShieldEllipsis,
  ShoppingBag,
  X,
} from "lucide-react";

import { useLang } from "@/i18n/lang";
import { cn } from "@/lib/utils";

/**
 * Making an app-specific password at Apple, acted out: a drawing of Apple's
 * account pages on a Mac, with a cursor that clicks through them in order and
 * a caption for each step. It is what the iCloud setup shows before it hands
 * out the link to Apple, so people have seen every screen before they meet it.
 *
 * The screens are drawn from screenshots of account.apple.com in Safari on a
 * Mac (September 2026), in Apple's own Danish wording. Two things they showed
 * shape the route drawn here: signing in with Touch ID is not enough (Apple
 * refuses to make the password and asks for a password sign-in), so the
 * cursor declines Touch ID; and the final box has no copy button, so the
 * password is selected by hand. The person shown is made up.
 *
 * Everything is laid out at a fixed size (W x H) and scaled to fit, so the
 * cursor's targets are plain coordinates. The timeline is a list of beats:
 * where the cursor goes, whether it clicks, and which state the screen is in.
 * Anyone whose system asks for less motion gets no autoplay and no gliding,
 * just the same frames to step through.
 */

const W = 720;
const H = 450;
/** The drawn browser bar; the page starts below it. */
const CHROME = 34;

const BLUE = "#0071e3";
const INK = "#1d1d1f";
const GREY = "#6e6e73";

type SceneId =
  | "landing"
  | "touchId"
  | "signIn"
  | "code"
  | "security"
  | "list"
  | "generate"
  | "confirm"
  | "reveal";

const SCENES: SceneId[] = [
  "landing",
  "touchId",
  "signIn",
  "code",
  "security",
  "list",
  "generate",
  "confirm",
  "reveal",
];

interface Beat {
  scene: SceneId;
  /** Which state the scene is drawn in: typed text, scrolled, selected. */
  phase: number;
  /** Where the cursor tip is, in canvas coordinates. */
  at: [number, number];
  click?: boolean;
  /** How long this beat lasts before the next one. */
  ms: number;
  /** The beat shown when someone steps to this scene by hand. */
  key?: boolean;
}

// Coordinates follow the layouts drawn below (page coordinates + CHROME).
const BEATS: Beat[] = [
  { scene: "landing", phase: 0, at: [560, 260], ms: 900 },
  { scene: "landing", phase: 0, at: [360, 377], ms: 1100, key: true },
  { scene: "landing", phase: 0, at: [360, 377], ms: 700, click: true },

  { scene: "touchId", phase: 0, at: [360, 377], ms: 900 },
  { scene: "touchId", phase: 0, at: [454, 123], ms: 1200, key: true },
  { scene: "touchId", phase: 0, at: [454, 123], ms: 700, click: true },

  { scene: "signIn", phase: 0, at: [360, 198], ms: 1000 },
  { scene: "signIn", phase: 1, at: [360, 198], ms: 900 },
  { scene: "signIn", phase: 2, at: [360, 232], ms: 1000 },
  { scene: "signIn", phase: 2, at: [452, 232], ms: 800, key: true },
  { scene: "signIn", phase: 2, at: [452, 232], ms: 700, click: true },

  { scene: "code", phase: 0, at: [360, 200], ms: 900 },
  { scene: "code", phase: 1, at: [360, 200], ms: 1300, key: true },

  { scene: "security", phase: 0, at: [470, 250], ms: 1100 },
  { scene: "security", phase: 1, at: [470, 250], ms: 900 },
  { scene: "security", phase: 2, at: [346, 321], ms: 1000, key: true },
  { scene: "security", phase: 2, at: [346, 321], ms: 700, click: true },

  // The tip rests on the corner of the +, so the arrow doesn't hide it.
  { scene: "list", phase: 0, at: [346, 321], ms: 800 },
  { scene: "list", phase: 0, at: [512, 244], ms: 1100, key: true },
  { scene: "list", phase: 0, at: [512, 244], ms: 700, click: true },

  { scene: "generate", phase: 0, at: [360, 215], ms: 1000 },
  { scene: "generate", phase: 1, at: [360, 215], ms: 900 },
  { scene: "generate", phase: 1, at: [360, 253], ms: 800, key: true },
  { scene: "generate", phase: 1, at: [360, 253], ms: 700, click: true },

  { scene: "confirm", phase: 0, at: [360, 219], ms: 1000 },
  { scene: "confirm", phase: 1, at: [360, 219], ms: 900 },
  { scene: "confirm", phase: 1, at: [360, 255], ms: 800, key: true },
  { scene: "confirm", phase: 1, at: [360, 255], ms: 700, click: true },

  { scene: "reveal", phase: 0, at: [360, 180], ms: 1100 },
  { scene: "reveal", phase: 1, at: [360, 180], ms: 800, click: true },
  { scene: "reveal", phase: 2, at: [360, 180], ms: 1300, key: true },
  { scene: "reveal", phase: 2, at: [360, 259], ms: 900 },
  { scene: "reveal", phase: 2, at: [360, 259], ms: 1000, click: true },
];

function keyBeat(scene: SceneId): number {
  return BEATS.findIndex((b) => b.scene === scene && b.key);
}

const URLS: Record<SceneId, string> = {
  landing: "account.apple.com",
  touchId: "account.apple.com/sign-in",
  signIn: "account.apple.com/sign-in",
  code: "account.apple.com/sign-in",
  security: "account.apple.com/account/manage",
  list: "account.apple.com/account/manage",
  generate: "account.apple.com/account/manage",
  confirm: "account.apple.com/account/manage",
  reveal: "account.apple.com/account/manage",
};

const da = {
  captions: {
    landing: "Klik på Log ind.",
    touchId:
      "Tilbyder din Mac Touch ID, så klik på Annuller. Apple skal have din adgangskode, ikke dit fingeraftryk.",
    signIn: "Log ind med din e-mail og din Apple-adgangskode.",
    code: "Skriv den kode, Apple sender til din iPhone.",
    security: "Rul ned, og klik på App-specifikke adgang…",
    list: "Klik på +.",
    generate: "Skriv Casy, og klik på Opret.",
    confirm: "Beder Apple om din adgangskode igen? Skriv den, og klik på Fortsæt.",
    reveal: "Markér koden ved at klikke tre gange på den, kopiér den med ⌘C, og klik på OK.",
  } satisfies Record<SceneId, string>,
  controls: {
    previous: "Forrige",
    next: "Næste",
    pause: "Pause",
    play: "Afspil",
    replay: "Se igen",
    goTo: (n: number) => `Gå til ${n}`,
  },
  apple: {
    nav: ["Store", "Mac", "iPad", "iPhone", "Watch", "AirPods", "TV og hjem", "Underholdning", "Tilbehør", "Support"],
    account: "Apple-konto",
    headerLinks: ["Log ind", "Opret din Apple-konto", "Ofte stillede spørgsmål"],
    signOut: "Log ud",
    landingTitle: "Én konto til alt Apple",
    landingBody:
      "En enkelt Apple-konto og en adgangskode giver dig adgang til alle Apples tjenester. Log ind for at administrere din konto.",
    signIn: "Log ind",
    sheetText: "Log ind på din Apple-konto til account.apple.com.",
    yourAccount: "Din konto",
    otherAccount: "Brug en anden Apple-konto",
    touchId: "Fortsæt med Touch ID",
    cancel: "Annuller",
    emailField: "E-mail eller telefonnummer",
    passwordField: "Adgangskode",
    twoFactor: "Tofaktorgodkendelse",
    security: "Login og sikkerhed",
    securityBody:
      "Administrer indstillinger, der er relateret til at logge ind på din konto, kontosikkerhed, og hvordan du gendanner dine data, når du har problemer med at logge ind.",
    menu: ["Personlige oplysninger", "Login og sikkerhed", "Betaling og levering", "Abonnementer", "Familie", "Enheder", "Anonymitet"],
    tiles: [
      ["E-mails og telefonnumre", "frida@icloud.com", "og yderligere 1"],
      ["Adgangskode", "Sidst opdateret den 03.02.2025"],
      ["Kontosikkerhed", "Tofaktorgodkendelse", "1 pålideligt telefonnummer"],
      ["Kontogendannelse", "Ikke indstillet"],
      ["Arvekontakt", "1 kontakt"],
      ["Log ind med Apple", "12 apps og websteder"],
      ["App-specifikke adgang…", "Vis oplysninger"],
    ],
    listTitle: "App-specifikke adgangskoder",
    listBody:
      "Brug en app-specifik adgangskode til at logge ind på en app eller tjeneste, som ikke er fra Apple.",
    listLink: "Om app-specifikke adgangskoder",
    passwords: "Adgangskoder",
    generateTitle: "Generer app-specifik adgangskode",
    namePlaceholder: "f.eks. Bill Pay",
    create: "Opret",
    confirmTitle: "Bekræft din adgangskode",
    confirmBody: "Af hensyn til din sikkerhed skal du skrive adgangskoden til:",
    continue: "Fortsæt",
    revealTitle: "Din app-specifikke adgangskode er:",
    revealBody:
      "Skriv denne adgangskode i adgangskodefeltet til den app, som du vil logge ind på. Der skelnes mellem store og små bogstaver i adgangskoder.",
    ok: "OK",
  },
};

// Apple's English wording here is translated from the Danish screenshots, not
// copied from the English pages; check it against them before relying on it.
const en: typeof da = {
  captions: {
    landing: "Click Sign In.",
    touchId:
      "If your Mac offers Touch ID, click Cancel. Apple needs your password, not your fingerprint.",
    signIn: "Sign in with your email and your Apple password.",
    code: "Type the code Apple sends to your iPhone.",
    security: "Scroll down and click App-Specific Passwo…",
    list: "Click +.",
    generate: "Type Casy and click Create.",
    confirm: "If Apple asks for your password again, type it and click Continue.",
    reveal: "Select the code by clicking it three times, copy it with ⌘C, and click OK.",
  },
  controls: {
    previous: "Previous",
    next: "Next",
    pause: "Pause",
    play: "Play",
    replay: "Watch again",
    goTo: (n: number) => `Go to ${n}`,
  },
  apple: {
    nav: ["Store", "Mac", "iPad", "iPhone", "Watch", "AirPods", "TV & Home", "Entertainment", "Accessories", "Support"],
    account: "Apple Account",
    headerLinks: ["Sign In", "Create Your Apple Account", "FAQ"],
    signOut: "Sign Out",
    landingTitle: "One account for everything Apple",
    landingBody:
      "A single Apple Account and password gives you access to all Apple services. Sign in to manage your account.",
    signIn: "Sign In",
    sheetText: "Sign in to your Apple Account for account.apple.com.",
    yourAccount: "Your account",
    otherAccount: "Use a different Apple Account",
    touchId: "Continue with Touch ID",
    cancel: "Cancel",
    emailField: "Email or Phone Number",
    passwordField: "Password",
    twoFactor: "Two-Factor Authentication",
    security: "Sign-In and Security",
    securityBody:
      "Manage settings related to signing in to your account, account security, and how to recover your data when you have trouble signing in.",
    menu: ["Personal Information", "Sign-In and Security", "Payment & Shipping", "Subscriptions", "Family", "Devices", "Privacy"],
    tiles: [
      ["Email & Phone Numbers", "frida@icloud.com", "and 1 more"],
      ["Password", "Last updated 3 Feb 2025"],
      ["Account Security", "Two-Factor Authentication", "1 trusted phone number"],
      ["Account Recovery", "Not set up"],
      ["Legacy Contact", "1 contact"],
      ["Sign in with Apple", "12 apps & websites"],
      ["App-Specific Passwo…", "View details"],
    ],
    listTitle: "App-Specific Passwords",
    listBody: "Use an app-specific password to sign in to an app or service not provided by Apple.",
    listLink: "About app-specific passwords",
    passwords: "Passwords",
    generateTitle: "Generate app-specific password",
    namePlaceholder: "e.g. Bill Pay",
    create: "Create",
    confirmTitle: "Confirm your password",
    confirmBody: "For your security, enter the password for:",
    continue: "Continue",
    revealTitle: "Your app-specific password is:",
    revealBody:
      "Enter this password into the password field of the app you want to sign in to. Passwords are case sensitive.",
    ok: "OK",
  },
};

type AppleWords = typeof da.apple;

function useCopy() {
  const { lang } = useLang();
  return lang === "da" ? da : en;
}

/** Absolute placement in the drawing's own coordinates. */
function at(left: number, top: number, width?: number, height?: number): CSSProperties {
  return { position: "absolute", left, top, width, height };
}

/* ----------------------------------------------------------------------------
 * Pieces of Apple's pages
 * ------------------------------------------------------------------------- */

function BrowserBar({ url }: { url: string }) {
  return (
    <div style={at(0, 0, W, CHROME)} className="flex items-center border-b border-[#d8d8dc] bg-[#f3f3f5] px-3">
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
    <div style={at(0, 0, W, 24)} className="flex items-center justify-center gap-[17px] text-[7.5px]" >
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

/** Apple's ring of coloured dots, round the logo on the signed-out page. */
function DotRing() {
  const rings = [
    { r: 34, n: 18, s: 2.2 },
    { r: 46, n: 24, s: 2.8 },
    { r: 58, n: 30, s: 3.4 },
  ];
  return (
    <svg width="140" height="140" viewBox="-70 -70 140 140" aria-hidden="true">
      {rings.flatMap(({ r, n, s }) =>
        Array.from({ length: n }, (_, i) => {
          const turn = i / n;
          const angle = turn * 2 * Math.PI - Math.PI / 2;
          return (
            <circle
              key={`${r}-${i}`}
              cx={r * Math.cos(angle)}
              cy={r * Math.sin(angle)}
              r={s}
              fill={`hsl(${195 + turn * 180} 78% 62%)`}
            />
          );
        }),
      )}
    </svg>
  );
}

/** The ring of small blue dots round the logo, atop Apple's dialogs. */
function DottedAppleIcon({ cx, cy }: { cx: number; cy: number }) {
  return (
    <>
      {Array.from({ length: 22 }, (_, i) => {
        const angle = (i / 22) * 2 * Math.PI;
        return (
          <span
            key={i}
            style={{ ...at(cx + 13 * Math.cos(angle) - 1.2, cy + 13 * Math.sin(angle) - 1.2, 2.4, 2.4), background: BLUE }}
            className="rounded-full"
          />
        );
      })}
      <span style={at(cx - 5, cy - 6, 10, 11)} className="flex items-center justify-center">
        <SiApple className="h-2.5 w-2.5" style={{ color: BLUE }} />
      </span>
    </>
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

function DialogButton({ top, label, filled, faint }: { top: number; label: string; filled?: boolean; faint?: boolean }) {
  return (
    <div
      style={{
        ...at(255, top, 210, 22),
        background: filled ? (faint ? "#a9c8f3" : BLUE) : "white",
        color: filled ? "white" : BLUE,
        borderColor: BLUE,
      }}
      className={cn("flex items-center justify-center rounded-[7px] text-[9px] transition-colors", !filled && "border")}
    >
      {label}
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * The screens
 * ------------------------------------------------------------------------- */

function LandingPage({ a }: { a: AppleWords }) {
  return (
    <>
      <div style={at(0, 60, W, H - CHROME - 60)} className="bg-[#f5f5f7]" />
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

function TouchIdSheet({ a }: { a: AppleWords }) {
  return (
    <>
      <AppleNav a={a} />
      <AccountHeader a={a} signedIn={false} />
      <div style={at(0, 0, W, H - CHROME)} className="bg-black/45" />
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
        <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-gradient-to-b from-[#a5b4fc] to-[#6366f1] text-[8px] font-semibold text-white">
          FJ
        </span>
        <span className="flex flex-col">
          <span className="text-[9px] text-white">Frida Jensen</span>
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
      <Field left={250} top={150} width={220} placeholder={a.emailField} value={phase >= 1 ? "frida@icloud.com" : undefined} caret={phase === 1} />
      <Field left={250} top={184} width={220} placeholder={a.passwordField} value={phase >= 2 ? "••••••••••" : undefined} caret={phase === 2}>
        <span style={{ borderColor: GREY }} className="ml-auto flex h-4 w-4 items-center justify-center rounded-full border">
          <ArrowRight className="h-2.5 w-2.5" style={{ color: GREY }} />
        </span>
      </Field>
    </>
  );
}

function CodeEntry({ a, phase }: { a: AppleWords; phase: number }) {
  const digits = "381047";
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
          {phase >= 1 ? digits[i] : ""}
        </span>
      ))}
    </>
  );
}

const TILE_ICONS = [Apple, RectangleEllipsis, ShieldEllipsis, LifeBuoy, Contact, null, Diamond];

/** Login og sikkerhed, where Apple lands you after signing in. */
function SecurityPage({ a, scrolled, hover }: { a: AppleWords; scrolled: boolean; hover: boolean }) {
  return (
    <>
      <AppleNav a={a} />
      <AccountHeader a={a} signedIn />
      <div style={at(0, 60, W, H - CHROME - 60)} className="overflow-hidden">
        <motion.div
          animate={{ y: scrolled ? -110 : 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          style={at(0, 0, W, 420)}
        >
          <span
            style={at(100, 20, 40, 40)}
            className="flex items-center justify-center rounded-full bg-gradient-to-b from-[#d1d5db] to-[#9ca3af] text-[12px] font-semibold text-white"
          >
            FJ
          </span>
          <span style={{ ...at(100, 68), color: INK }} className="text-[11px] font-semibold">
            Frida Jensen
          </span>
          <span style={{ ...at(100, 84), color: GREY }} className="text-[8.5px]">
            frida@icloud.com
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
          {a.tiles.map(([title, ...lines], i) => {
            const Icon = TILE_ICONS[i];
            const target = i === a.tiles.length - 1;
            return (
              <div
                key={title}
                style={at(i % 2 === 0 ? 258 : 444, 90 + Math.floor(i / 2) * 72, 176, 62)}
                className={cn(
                  "rounded-[10px] border bg-white px-3 py-2.5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] transition-shadow",
                  target && hover ? "border-[#0071e3] ring-2 ring-[#0071e3]/25" : "border-[#e5e5ea]",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="truncate text-[9px] font-semibold" style={{ color: INK }}>
                    {title}
                  </span>
                  {Icon ? (
                    <Icon className="h-3 w-3 shrink-0" style={{ color: BLUE }} />
                  ) : (
                    <span className="flex h-3 w-3 shrink-0 items-center justify-center rounded-[3px] border" style={{ borderColor: BLUE }}>
                      <SiApple className="h-1.5 w-1.5" style={{ color: BLUE }} />
                    </span>
                  )}
                </div>
                {lines.map((line) => (
                  <p key={line} className="mt-0.5 truncate text-[8px]" style={{ color: GREY }}>
                    {line}
                  </p>
                ))}
              </div>
            );
          })}
        </motion.div>
      </div>
    </>
  );
}

/** The App-Specific Passwords box, as a first-timer sees it: no passwords yet. */
function ListModal({ a }: { a: AppleWords }) {
  return (
    <>
      <div style={at(0, 0, W, H - CHROME)} className="bg-[#f5f5f7]/80" />
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
      <div style={at(0, 0, W, H - CHROME)} className="bg-white/55" />
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
        frida@icloud.com
      </p>
      <Field left={270} top={172} width={180} placeholder={a.passwordField} value={phase >= 1 ? "••••••••••" : undefined} caret={phase >= 1} />
      <DialogButton top={210} label={a.continue} filled faint={phase < 1} />
      <DialogButton top={240} label={a.cancel} />
    </SmallModal>
  );
}

function RevealModal({ a, phase }: { a: AppleWords; phase: number }) {
  return (
    <SmallModal top={70} height={196}>
      <DottedAppleIcon cx={360} cy={100} />
      <p style={{ ...at(235, 119, 250), color: INK }} className="text-center text-[10.5px] font-semibold">
        {a.revealTitle}
      </p>
      <p style={{ ...at(235, 137, 250), color: INK }} className="text-center text-[12px] font-semibold">
        <span className={cn("rounded-sm px-0.5", phase >= 1 && "bg-[#b3d7ff]")}>abcd-efgh-ijkl-mnop</span>
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
    case "touchId":
      return <TouchIdSheet a={a} />;
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

/** The pointer: macOS's arrow, tip at the element's top left. */
function Pointer() {
  return (
    <svg width="14" height="20" viewBox="0 0 14 20" style={{ filter: "drop-shadow(0 1px 1.5px rgba(0,0,0,0.35))" }}>
      <path
        d="M1 1 L1 16 L4.8 12.4 L7.6 18.6 L10 17.6 L7.3 11.5 L12.5 11.5 Z"
        fill="#000"
        stroke="#fff"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ----------------------------------------------------------------------------
 * The player
 * ------------------------------------------------------------------------- */

export default function AppleWalkthrough() {
  const c = useCopy();
  const reduceMotion = useReducedMotion();
  const [beat, setBeat] = useState(() => (reduceMotion ? keyBeat("landing") : 0));
  const [playing, setPlaying] = useState(!reduceMotion);
  const current = BEATS[beat];
  const sceneIndex = SCENES.indexOf(current.scene);
  const finished = !playing && beat === BEATS.length - 1;

  // Scaled to whatever width the page gives it; the drawing keeps its layout.
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.8);
  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / W));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // The clock: each beat hands over to the next when its time is up, and the
  // last one stops the show rather than looping, so it ends on the password.
  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => {
      if (beat + 1 < BEATS.length) setBeat(beat + 1);
      else setPlaying(false);
    }, BEATS[beat].ms);
    return () => clearTimeout(timer);
  }, [playing, beat]);

  function showScene(index: number) {
    setPlaying(false);
    setBeat(keyBeat(SCENES[index]));
  }

  function togglePlay() {
    if (finished) {
      setBeat(0);
      setPlaying(true);
    } else {
      setPlaying((p) => !p);
    }
  }

  const iconButton =
    "flex h-9 w-9 items-center justify-center rounded-full border bg-card text-foreground transition hover:bg-secondary disabled:pointer-events-none disabled:opacity-30";

  return (
    <div>
      <div
        ref={frameRef}
        aria-hidden="true"
        className="relative w-full overflow-hidden rounded-xl border bg-white shadow-sm"
        style={{ height: H * scale }}
      >
        <div style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: "top left" }} className="relative">
          <BrowserBar url={URLS[current.scene]} />
          <div style={at(0, CHROME, W, H - CHROME)} className="overflow-hidden bg-white">
            <AnimatePresence initial={false}>
              <motion.div
                key={current.scene}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.3 }}
                style={at(0, 0, W, H - CHROME)}
              >
                <Scene id={current.scene} phase={current.phase} a={c.apple} />
              </motion.div>
            </AnimatePresence>
          </div>
          {current.click && !reduceMotion && (
            <motion.span
              key={beat}
              initial={{ scale: 0.2, opacity: 0.55 }}
              animate={{ scale: 1.6, opacity: 0 }}
              transition={{ duration: 0.55 }}
              style={{ ...at(current.at[0] - 12, current.at[1] - 12, 24, 24), background: BLUE }}
              className="rounded-full"
            />
          )}
          <motion.div
            style={at(0, 0)}
            initial={false}
            animate={{ x: current.at[0] - 1, y: current.at[1] - 1, scale: current.click ? 0.85 : 1 }}
            transition={{ duration: reduceMotion ? 0 : 0.65, ease: "easeInOut" }}
          >
            <Pointer />
          </motion.div>
        </div>
      </div>

      {/* Spoken only when someone steps by hand; read aloud every few
          seconds while it plays, it would talk over everything else. */}
      <p aria-live={playing ? "off" : "polite"} className="mt-3 min-h-[2.75rem] text-sm leading-relaxed text-foreground">
        <span className="mr-1.5 font-semibold tabular-nums text-primary">{sceneIndex + 1}.</span>
        {c.captions[current.scene]}
      </p>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => showScene(sceneIndex - 1)} disabled={sceneIndex === 0} aria-label={c.controls.previous} className={iconButton}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? c.controls.pause : finished ? c.controls.replay : c.controls.play}
            className={cn(iconButton, finished && "w-auto gap-1.5 px-3 text-sm font-medium")}
          >
            {playing ? (
              <Pause className="h-4 w-4" />
            ) : finished ? (
              <>
                <RotateCcw className="h-4 w-4" />
                {c.controls.replay}
              </>
            ) : (
              <Play className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => showScene(sceneIndex + 1)}
            disabled={sceneIndex === SCENES.length - 1}
            aria-label={c.controls.next}
            className={iconButton}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center">
          {SCENES.map((s, i) => (
            <button key={s} type="button" onClick={() => showScene(i)} aria-label={c.controls.goTo(i + 1)} className="p-1">
              <span className={cn("block h-2 w-2 rounded-full transition-colors", i === sceneIndex ? "bg-primary" : "bg-border")} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * The same steps as plain text, for the step where people go and do it: what
 * they glance back at between tabs, word for word what the animation said.
 */
export function AppleWalkthroughChecklist() {
  const c = useCopy();
  return (
    <ol className="space-y-2">
      {SCENES.map((s, i) => (
        <li key={s} className="flex gap-3 text-sm text-foreground">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold tabular-nums text-primary">
            {i + 1}
          </span>
          <span className="pt-0.5 leading-relaxed">{c.captions[s]}</span>
        </li>
      ))}
    </ol>
  );
}
