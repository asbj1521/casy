import { useEffect, useRef, useState, type RefObject } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";

import {
  deleteShortcut,
  saveShortcut,
  shortcutsQuery,
  shortcutsQueryKey,
  type ShortcutInput,
} from "@/api/shortcuts";
import NewGroupDialog from "@/components/NewGroupDialog";
import BottomSheet from "@/components/ui/BottomSheet";
import ConfirmPanel from "@/components/ui/ConfirmPanel";
import FlowButton from "@/components/ui/FlowButton";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { PUSH, pushTransition } from "@/components/ui/push";
import { useSignedInUser } from "@/context/auth";
import { usePlanning } from "@/hooks/usePlanning";
import { useT } from "@/i18n/lang";
import {
  MAX_SHORTCUT_NAME,
  shortcutPlan,
  timeOf,
  type Shortcut,
  type ShortcutTime,
} from "@/lib/shortcuts";

import PileScreen from "./PileScreen";
import PlanSetup from "./PlanSetup";
import ShortcutsScreen from "./ShortcutsScreen";
import ShortcutTimes from "./ShortcutTimes";

/** A new genvej's id on screen until the server has given it one. */
const SAVING_ID = "saving";

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
    setSelected(null);
  };

  // The genvej shown big at the bottom of Genveje, about to run (#175).
  const [selected, setSelected] = useState<Shortcut | null>(null);
  const { data: shortcuts, error: shortcutsError } = useQuery({
    ...shortcutsQuery(userId),
    enabled: open,
  });
  const fill = (s: Shortcut) => planning.loadPlan({ name: s.name, ...s.plan });
  // Run with the group chosen in Planlæg: a genvej has none of its own.
  const runShortcut = (s: Shortcut) => {
    if (!planning.activeGroup) return;
    fill(s);
    toPile();
  };

  // The editor's times (#175): the one picked is the plan's own time on
  // screen (Tidspunkt, Fleksibel), the others kept here until picked.
  const [times, setTimes] = useState<ShortcutTime[]>([]);
  const [removing, setRemoving] = useState(false);
  const [current, setCurrent] = useState(0);
  const liveTimes = times.map((time, i) => (i === current ? timeOf(planning.sched) : time));
  const showTime = (all: ShortcutTime[], index: number) => {
    setTimes(all);
    setCurrent(index);
    planning.updateSettings(all[index]);
  };
  const openEditor = (shortcut: Shortcut | null) => {
    if (shortcut) fill(shortcut);
    setTimes(shortcut ? shortcut.plan.times : [timeOf(planning.sched)]);
    setCurrent(0);
    setRemoving(false);
    go({ kind: "editor", shortcut });
  };
  // Saved at once on screen (#175): the genvej is in its square the moment
  // Gem is pressed while the server catches up; if it fails, the list is as
  // it was and the square that didn't make it says so, a tap trying again.
  const key = shortcutsQueryKey(userId);
  const [failed, setFailed] = useState<{ input: ShortcutInput; message: string } | null>(null);
  const save = useMutation({
    mutationFn: (input: ShortcutInput) => saveShortcut(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Shortcut[]>(key);
      const shown: Shortcut = {
        id: input.id ?? SAVING_ID,
        name: input.name,
        plan: input.plan,
        updatedAt: new Date().toISOString(),
      };
      queryClient.setQueryData<Shortcut[]>(key, (list = []) =>
        input.id ? list.map((s) => (s.id === input.id ? shown : s)) : [...list, shown],
      );
      setFailed(null);
      return { previous };
    },
    onSuccess: ({ shortcuts: all }) => queryClient.setQueryData(key, all),
    onError: (error, input, context) => {
      queryClient.setQueryData(key, context?.previous);
      setFailed({ input, message: error.message });
    },
  });
  const submit = (shortcut: Shortcut | null) => {
    save.mutate({
      id: shortcut?.id ?? null,
      name: planning.name.trim().slice(0, MAX_SHORTCUT_NAME),
      // A trip looks at whole days: its times are only a meeting's.
      plan: shortcutPlan(
        planning.sched,
        planning.extras,
        planning.sched.multiDay ? [timeOf(planning.sched)] : liveTimes,
      ),
    });
    go({ kind: "shortcuts" });
  };
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
          ) : screen.kind === "shortcuts" && selected ? (
            <FlowButton onClick={() => runShortcut(selected)} disabled={!planning.activeGroup}>
              {t.planFromCalendar.findDate}
            </FlowButton>
          ) : screen.kind === "editor" ? (
            <FlowButton onClick={() => submit(editing)} disabled={!named}>
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
                error={shortcutsError?.message ?? null}
                selected={selected}
                onSelect={setSelected}
                onEdit={openEditor}
                onNew={() => openEditor(null)}
                savingId={save.isPending ? (save.variables.id ?? SAVING_ID) : null}
                failed={failed && { name: failed.input.name, message: failed.message }}
                onRetry={() => failed && save.mutate(failed.input)}
                onDismiss={() => setFailed(null)}
              />
            )}
            {screen.kind === "editor" && (
              <>
                <PlanSetup
                  planning={planning}
                  editor={{
                    top: planning.sched.multiDay ? null : (
                      <ShortcutTimes
                        times={liveTimes}
                        durationMinutes={planning.sched.durationMinutes}
                        current={current}
                        onPick={(i) => showTime(liveTimes, i)}
                        onAdd={() =>
                          showTime([...liveTimes, timeOf(planning.sched)], liveTimes.length)
                        }
                        onRemove={(i) =>
                          showTime(
                            liveTimes.filter((_, j) => j !== i),
                            i - 1,
                          )
                        }
                      />
                    ),
                  }}
                />
                {!named && (
                  <p className="mt-3 px-1 text-[12px] text-muted-foreground">{words.nameFirst}</p>
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
