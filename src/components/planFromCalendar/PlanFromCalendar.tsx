import { useEffect, useRef, useState, type RefObject } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";

import { deleteShortcut, saveShortcut, shortcutsQuery, shortcutsQueryKey } from "@/api/shortcuts";
import NewGroupDialog from "@/components/NewGroupDialog";
import BottomSheet from "@/components/ui/BottomSheet";
import ConfirmPanel from "@/components/ui/ConfirmPanel";
import FlowButton from "@/components/ui/FlowButton";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import Notice from "@/components/ui/Notice";
import { PUSH, pushTransition } from "@/components/ui/push";
import { useSignedInUser } from "@/context/auth";
import { usePlanning } from "@/hooks/usePlanning";
import { useT } from "@/i18n/lang";
import { MAX_SHORTCUT_NAME, shortcutPlan, type Shortcut } from "@/lib/shortcuts";

import PileScreen from "./PileScreen";
import PlanSetup from "./PlanSetup";
import ShortcutsScreen from "./ShortcutsScreen";

/** The sheet's screens (#175): the plan, the genveje beside it, and one genvej being made or changed. */
type Screen =
  { kind: "plan" } | { kind: "shortcuts" } | { kind: "editor"; shortcut: Shortcut | null };
const DEPTH: Record<Screen["kind"], number> = { plan: 0, shortcuts: 1, editor: 2 };

/**
 * Planning from My calendar (#126): "Planlæg" opens a glass sheet over the
 * calendar to say what is planned, and "Find dato" shows the calendars
 * piling up and finding the dates, ending in the button that sends them.
 * The same plan as the scheduler's (usePlanning): begun here, it is there
 * too, and the other way round. Loaded only once Planlæg is pressed, so
 * opening My calendar never fetches a group's calendars.
 *
 * Genveje (#175): its button beside the group slides the sheet sideways to
 * the saved plans (ShortcutsScreen), as the profile's screens slide in
 * (#174). A tap on one fills the plan in and goes straight to the pile; its
 * "..." or a plus opens the plan itself to change and save (the plan on
 * screen is what a new genvej starts from), with Slet last.
 */
export default function PlanFromCalendar({
  open,
  onClose,
  onClosed,
  origin,
}: {
  /**
   * Whether the plan is open (?plan). Closed, it stays on the page until its
   * sheet has shrunk back into the pill (#169), then says so (`onClosed`).
   */
  open: boolean;
  onClose: () => void;
  onClosed: () => void;
  /** The home page's Planlæg pill, which the sheet grows out of (#169). */
  origin?: RefObject<HTMLElement | null>;
}) {
  const t = useT();
  const words = t.shortcuts;
  const reduce = useReducedMotion();
  const userId = useSignedInUser().id;
  const queryClient = useQueryClient();
  // Sent, the plan closes onto the home page, the dates having flown into
  // its Aftaler button (#169).
  const planning = usePlanning({ onSent: onClose });
  const [stage, setStage] = useState<"setup" | "pile">("setup");
  // The sheet grows out of the pill and shrinks back into it, but once the
  // pile has begun it slides away and back as before: the pill is hidden
  // behind the plan then. Read by the sheet as it opens and as it closes.
  const sheetOrigin = useRef<HTMLElement | null>(origin?.current ?? null);
  const toPile = () => {
    sheetOrigin.current = null;
    setStage("pile");
  };
  // Closed from the pile, there is no sheet to wait for. The sheet's own
  // closing says when it is done, unless it closed only to make way for the pile.
  const stillOpen = useRef(open);
  useEffect(() => {
    stillOpen.current = open;
    if (!open && stage === "pile") onClosed();
  }, [open, stage, onClosed]);
  // A new pile each time it starts over (a shorter holiday picked at its end).
  const [run, setRun] = useState(0);

  // Which screen the sheet shows, and which way the last move went.
  const [screen, setScreen] = useState<Screen>({ kind: "plan" });
  const [dir, setDir] = useState(1);
  const go = (next: Screen) => {
    setDir(DEPTH[next.kind] >= DEPTH[screen.kind] ? 1 : -1);
    setScreen(next);
  };

  const { data: shortcuts, error: shortcutsError } = useQuery({
    ...shortcutsQuery(userId),
    enabled: open,
  });
  const fill = (s: Shortcut) => planning.loadPlan({ groupId: s.groupId, name: s.name, ...s.plan });
  const runShortcut = (s: Shortcut) => {
    fill(s);
    toPile();
  };
  const save = useMutation({
    mutationFn: (shortcut: Shortcut | null) =>
      saveShortcut({
        id: shortcut?.id ?? null,
        name: planning.name.trim().slice(0, MAX_SHORTCUT_NAME),
        groupId: planning.activeGroup?.isExample ? null : planning.activeGroupId,
        plan: shortcutPlan(planning.sched, planning.extras, planning.peopleChoice),
      }),
    onSuccess: ({ shortcuts: all }) => {
      queryClient.setQueryData(shortcutsQueryKey(userId), all);
      go({ kind: "shortcuts" });
    },
  });
  const [removing, setRemoving] = useState(false);
  const remove = useMutation({
    mutationFn: (id: string) => deleteShortcut(id),
    onSuccess: (all) => {
      queryClient.setQueryData(shortcutsQueryKey(userId), all);
      setRemoving(false);
      go({ kind: "shortcuts" });
    },
  });

  const editing = screen.kind === "editor" ? screen.shortcut : null;
  const named = planning.name.trim() !== "";
  const title =
    screen.kind === "shortcuts"
      ? words.title
      : screen.kind === "editor"
        ? (editing?.name ?? words.add)
        : t.planFromCalendar.button;

  return (
    <>
      <BottomSheet
        open={open && stage === "setup"}
        onClose={onClose}
        onClosed={() => {
          setScreen({ kind: "plan" });
          if (!stillOpen.current) onClosed();
        }}
        title={title}
        doneLabel={t.common.cancel}
        origin={sheetOrigin}
        stacked
        back={
          screen.kind === "shortcuts"
            ? { label: t.planFromCalendar.button, onBack: () => go({ kind: "plan" }) }
            : screen.kind === "editor"
              ? { label: words.title, onBack: () => go({ kind: "shortcuts" }) }
              : undefined
        }
        footer={
          screen.kind === "plan" ? (
            <FlowButton
              onClick={toPile}
              disabled={!planning.activeGroup || planning.planner.pending}
            >
              {t.planFromCalendar.findDate}
            </FlowButton>
          ) : screen.kind === "editor" ? (
            <FlowButton
              onClick={() => save.mutate(editing)}
              disabled={!named || !planning.activeGroup || planning.activeGroup.isExample}
              busy={save.isPending}
            >
              {words.save}
            </FlowButton>
          ) : undefined
        }
      >
        <AnimatePresence initial={false} mode="popLayout" custom={dir}>
          <motion.div
            key={screen.kind}
            custom={dir}
            variants={PUSH}
            initial="enter"
            animate="center"
            exit="exit"
            transition={pushTransition(reduce)}
            className="flex min-h-0 w-full flex-auto flex-col overflow-y-auto overscroll-contain px-4 pb-4"
          >
            {screen.kind === "plan" && (
              <PlanSetup planning={planning} onShortcuts={() => go({ kind: "shortcuts" })} />
            )}
            {screen.kind === "shortcuts" && (
              <ShortcutsScreen
                shortcuts={shortcuts}
                groups={planning.groups}
                error={shortcutsError?.message ?? null}
                onRun={runShortcut}
                onEdit={(s) => {
                  fill(s);
                  go({ kind: "editor", shortcut: s });
                }}
                onNew={() => go({ kind: "editor", shortcut: null })}
              />
            )}
            {screen.kind === "editor" && (
              <>
                {editing && !planning.groups.some((g) => g.id === editing.groupId) && (
                  <Notice tone="info" bare className="mb-3">
                    {words.pickGroup}
                  </Notice>
                )}
                <PlanSetup planning={planning} />
                {!named && (
                  <p className="mt-3 px-1 text-[12px] text-muted-foreground">{words.nameFirst}</p>
                )}
                {save.error && (
                  <Notice tone="error" bare className="mt-3">
                    {save.error.message}
                  </Notice>
                )}
                {editing &&
                  (removing ? (
                    <ConfirmPanel
                      className="mt-6"
                      message={words.removeAsk(editing.name)}
                      confirmLabel={words.remove}
                      busy={remove.isPending}
                      error={remove.error?.message ?? null}
                      onConfirm={() => remove.mutate(editing.id)}
                      onCancel={() => setRemoving(false)}
                    />
                  ) : (
                    <ListGroup className="mt-6">
                      <ListRow
                        icon={Trash2}
                        label={words.remove}
                        tone="danger"
                        onClick={() => setRemoving(true)}
                      />
                    </ListGroup>
                  ))}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </BottomSheet>

      {open && stage === "pile" && (
        <PileScreen
          key={run}
          planning={planning}
          onChange={() => {
            setScreen({ kind: "plan" });
            setStage("setup");
          }}
          onRestart={() => setRun((n) => n + 1)}
          onClose={onClose}
        />
      )}

      <NewGroupDialog
        open={planning.newGroupOpen}
        onClose={() => planning.setNewGroupOpen(false)}
        onCreated={planning.groupCreated}
      />
    </>
  );
}
