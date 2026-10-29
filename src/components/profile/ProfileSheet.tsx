import { useState, type MouseEvent, type ReactNode, type RefObject } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";

import { groupsQuery } from "@/api/groups";
import { ProfileHubList } from "@/components/profile/ProfileHub";
import SettingsGroups from "@/components/profile/SettingsGroups";
import BottomSheet from "@/components/ui/BottomSheet";
import { useSignedInUser } from "@/context/auth";
import { useT } from "@/i18n/lang";
import { parentScreen, screenDepth, sheetAddress, sheetScreenFor } from "@/lib/profileScreens";
import { PhoneGroupContent, PhoneGroupsContent } from "@/pages/Groups";
import { MyDataContent } from "@/pages/MyData";
import { AccountContent, AdminContent, PasswordContent } from "@/pages/ProfileScreen";

/** iOS's own push: the new screen in from the right, the old one a little left. */
const PUSH = {
  enter: (dir: number) => ({ x: dir > 0 ? "100%" : "-30%", opacity: dir > 0 ? 1 : 0.5 }),
  center: { x: "0%", opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? "-30%" : "100%", opacity: dir > 0 ? 0.5 : 1 }),
};

/** What the home page's address says of the sheet, kept with each step. */
interface SheetState {
  fromMonth?: boolean;
  /** How many screens were pushed inside the sheet: the steps back to the profile. */
  sheetDepth?: number;
}

/**
 * The phone's profile (#169), a sheet over the home page opened by its Profil
 * button (?profile), the calendar still behind it. Its rows open their
 * screens inside it (#174): in from the right as iOS pushes a screen, the
 * header turning into "‹ Profil" and the screen's title, the sheet growing
 * to its large height; back slides them out again. Each screen is in the
 * address (`?profile=settings`, `?profile=groups/<id>`, lib/profileScreens),
 * so the phone's back steps through them, and the old addresses lead here.
 * A link inside the sheet to one of them (a row, a group in the list) opens
 * it in the sheet; the help pages stay pages of their own.
 */
export default function ProfileSheet({
  open,
  onClose,
  origin,
  arrived,
}: {
  open: boolean;
  onClose: () => void;
  /** The button it grows out of (#169). */
  origin?: RefObject<HTMLElement | null>;
  /** Open already as the home page appears: shown in place (BottomSheet). */
  arrived?: boolean;
}) {
  const t = useT();
  const location = useLocation();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const youId = useSignedInUser().id;
  const { data: groups } = useQuery(groupsQuery(youId));
  const key = new URLSearchParams(location.search).get("profile") ?? "";
  const state = (location.state as SheetState | null) ?? {};
  const depth = state.sheetDepth ?? 0;

  // Which way the screens move: deeper slides in from the right, back out
  // to it (React's pattern for state that follows a changed value).
  const [shown, setShown] = useState({ key, dir: 1 });
  if (key !== shown.key)
    setShown({ key, dir: screenDepth(key) >= screenDepth(shown.key) ? 1 : -1 });

  const openScreen = (next: string, search = "") =>
    navigate(sheetAddress(next, search), { state: { ...state, sheetDepth: depth + 1 } });
  const back = () => {
    if (depth > 0) navigate(-1);
    else navigate(sheetAddress(parentScreen(key)), { replace: true, state });
  };
  // A link to one of the sheet's screens opens it here, not as a page.
  const onClickCapture = (e: MouseEvent) => {
    const link = (e.target as HTMLElement).closest<HTMLAnchorElement>("a[href]");
    if (!link || link.origin !== window.location.origin) return;
    const next = sheetScreenFor(link.pathname);
    if (next === null) return;
    e.preventDefault();
    openScreen(next, link.search);
  };

  const groupId = key.startsWith("groups/") ? key.slice("groups/".length) : null;
  const screen: { title: string; body: ReactNode } = groupId
    ? {
        title: groups?.find((g) => g.id === groupId)?.name ?? t.groupsPage.title,
        body: (
          <PhoneGroupContent
            groupId={groupId}
            onGone={() => navigate(sheetAddress("groups"), { replace: true, state })}
          />
        ),
      }
    : key === "settings"
      ? { title: t.profileHub.settings, body: <SettingsGroups /> }
      : key === "groups"
        ? { title: t.groupsPage.title, body: <PhoneGroupsContent /> }
        : key === "password"
          ? { title: t.profileHub.security, body: <PasswordContent /> }
          : key === "account"
            ? { title: t.deleteAccount.title, body: <AccountContent /> }
            : key === "admin"
              ? { title: t.profileHub.admin, body: <AdminContent /> }
              : key === "data"
                ? { title: t.myData.title, body: <MyDataContent /> }
                : { title: t.nav.profile, body: <ProfileHubList /> };
  const atProfile = key === "";

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={screen.title}
      doneLabel={t.swipe.done}
      origin={origin}
      arrived={arrived}
      stacked
      tall={!atProfile}
      back={
        atProfile
          ? undefined
          : {
              label: parentScreen(key) === "groups" ? t.groupsPage.title : t.nav.profileShort,
              onBack: back,
            }
      }
    >
      <AnimatePresence initial={false} mode="popLayout" custom={shown.dir}>
        <motion.div
          key={key}
          custom={shown.dir}
          variants={PUSH}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: reduce ? 0 : 0.34, ease: [0.32, 0.72, 0, 1] }}
          onClickCapture={onClickCapture}
          className="flex min-h-0 w-full flex-auto flex-col overflow-y-auto overscroll-contain px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
        >
          {screen.body}
        </motion.div>
      </AnimatePresence>
    </BottomSheet>
  );
}
