import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Sparkles } from "lucide-react";

import { calendarsChanged, updateCalendar, type CalendarChange } from "@/api/calendars";
import NewCategorySheet from "@/components/calendars/NewCategorySheet";
import BottomSheet from "@/components/ui/BottomSheet";
import FlowButton from "@/components/ui/FlowButton";
import { ListGroup, ListPickRow, ListRow } from "@/components/ui/ListGroup";
import { useT } from "@/i18n/lang";
import { CATEGORIES, ownCategories, type OverviewCalendar } from "@/lib/calendarOverview";
import { changesFrom, choiceOf, tourCalendars, type TourChoice } from "@/lib/calendarTour";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import TourCard from "./TourCard";
import TourDone from "./TourDone";
import TourSlider from "./TourSlider";

/** The card leaving for the next, as a vote's card does; going back, it just gives way. */
const CARD = {
  enter: { scale: 0.96, y: 10, opacity: 1 },
  center: { scale: 1, y: 0, x: 0, opacity: 1, rotate: 0 },
  exit: (forward: boolean) =>
    forward
      ? {
          x: 640,
          rotate: 18,
          opacity: 0,
          transition: { duration: 0.38, ease: [0.3, 0, 0.8, 0.6] as const },
        }
      : { opacity: 0, scale: 0.96, transition: { duration: 0.15 } },
};

/**
 * The guided calendar setup (#221): your calendars one at a time, in their own
 * colours, what kind each is and how much it matters, then a small reward. Casy's
 * guess is already ticked, so "Næste" alone takes care of a good one. It moves on
 * at once and saves behind it: a card waiting on the network would spoil what
 * makes this quick, and anything that failed is said at the end. What it saves
 * is what the calendar list's pickers save.
 */
export default function CalendarTour({
  open,
  onClose,
  calendars,
  colorOf,
}: {
  open: boolean;
  onClose: () => void;
  calendars: OverviewCalendar[];
  colorOf: (calendarId: string) => string;
}) {
  const t = useT();
  const words = t.calendarTour;
  const queryClient = useQueryClient();

  // The calendars it set out with, in the same order however saving changes them.
  const [ids] = useState(() => tourCalendars(calendars).map((c) => c.id));
  const steps = useMemo(
    () =>
      ids.flatMap((id) => {
        const found = calendars.find((c) => c.id === id);
        return found ? [found] : [];
      }),
    [ids, calendars],
  );

  const [index, setIndex] = useState(0);
  const [forward, setForward] = useState(true);
  const [choices, setChoices] = useState<Record<string, TourChoice>>({});
  const [creating, setCreating] = useState(false);
  const [failed, setFailed] = useState<{ id: string; changes: CalendarChange[] }[]>([]);
  const saving = useRef<Promise<unknown>[]>([]);

  const done = index >= steps.length;
  const current = done ? null : steps[index];
  const next = done ? null : (steps[index + 1] ?? null);
  const choice = current ? (choices[current.id] ?? choiceOf(current)) : null;

  // The person's own categories, with one just made on an earlier card.
  const own = useMemo(() => {
    const list = ownCategories(calendars);
    for (const c of Object.values(choices)) {
      if (c.categoryName && c.purpose && !list.some((o) => o.name === c.categoryName)) {
        list.push({ name: c.categoryName, purpose: c.purpose });
      }
    }
    return list;
  }, [calendars, choices]);

  const setChoice = (patch: Partial<TourChoice>) => {
    if (current && choice) setChoices((all) => ({ ...all, [current.id]: { ...choice, ...patch } }));
  };

  const save = (id: string, changes: CalendarChange[]) => {
    if (changes.length === 0) return;
    const sent = Promise.all(changes.map((change) => updateCalendar(id, change))).catch(() =>
      setFailed((list) => [...list.filter((f) => f.id !== id), { id, changes }]),
    );
    saving.current.push(sent);
  };

  const goOn = () => {
    if (!current || !choice) return;
    save(current.id, changesFrom(current, choice));
    setForward(true);
    setIndex(index + 1);
    haptic(index + 1 >= steps.length ? "success" : "answer");
  };

  const goBackTo = (to: number) => {
    setForward(false);
    setIndex(to);
  };

  const retry = () => {
    const again = failed;
    setFailed([]);
    for (const { id, changes } of again) save(id, changes);
  };

  // The list and the month pick it all up as it closes, once everything is saved.
  const close = () => {
    const pending = saving.current;
    saving.current = [];
    if (pending.length > 0) void Promise.all(pending).then(() => calendarsChanged(queryClient));
    onClose();
  };

  return (
    <BottomSheet
      open={open}
      onClose={close}
      title={done ? "" : words.title}
      doneLabel={done ? t.common.done : t.common.cancel}
      footer={
        done ? (
          <FlowButton onClick={close}>{words.see}</FlowButton>
        ) : (
          <FlowButton onClick={goOn}>
            {index + 1 >= steps.length ? words.finish : words.next}
          </FlowButton>
        )
      }
    >
      {done || !current || !choice ? (
        <TourDone
          calendars={steps.filter((c) => (choices[c.id] ?? choiceOf(c)).stop !== "off")}
          colorOf={colorOf}
          failed={failed.length}
          onRetry={retry}
        />
      ) : (
        <div>
          {/* One bar per calendar: tap back to one already done. */}
          <div className="flex gap-1">
            {steps.map((c, i) => (
              <button
                key={c.id}
                type="button"
                disabled={i >= index}
                onClick={() => goBackTo(i)}
                aria-label={words.step(i + 1, steps.length)}
                aria-current={i === index ? "step" : undefined}
                className={cn(
                  "hit h-1.5 flex-1 rounded-full transition-colors duration-300",
                  i === index ? "bg-foreground" : i < index ? "bg-primary" : "bg-secondary",
                )}
              />
            ))}
          </div>

          {/* The card, the next one waiting behind it, so it reads as a stack. */}
          <div className="relative mt-3 h-[6.25rem] short:h-[4.5rem]">
            {next && (
              <div aria-hidden className="absolute inset-0 translate-y-2 scale-[0.96] opacity-60">
                <TourCard calendar={next} color={colorOf(next.id)} />
              </div>
            )}
            <AnimatePresence initial={false} custom={forward}>
              <motion.div
                key={current.id}
                className="absolute inset-0 z-10"
                custom={forward}
                variants={CARD}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", damping: 26, stiffness: 300 }}
              >
                <TourCard calendar={current} color={colorOf(current.id)} />
              </motion.div>
            </AnimatePresence>
          </div>

          <ListGroup title={words.category} className="mt-4">
            {CATEGORIES.map((category) => (
              <ListPickRow
                key={category}
                type="radio"
                name={`tour-${current.id}`}
                checked={choice.purpose === category && !choice.categoryName}
                onChange={() => setChoice({ purpose: category, categoryName: null })}
                label={
                  current.purposeGuessed &&
                  current.purpose === category &&
                  !current.categoryName ? (
                    <span className="flex items-center gap-1.5">
                      {t.categories[category]}
                      <Sparkles aria-hidden className="h-3 w-3 text-amber-500" />
                      <span className="text-[0.75rem] text-muted-foreground">
                        {t.aiPlan.guessed}
                      </span>
                    </span>
                  ) : (
                    t.categories[category]
                  )
                }
              />
            ))}
            {own.map((category) => (
              <ListPickRow
                key={category.name}
                type="radio"
                name={`tour-${current.id}`}
                checked={choice.categoryName === category.name}
                onChange={() =>
                  setChoice({ purpose: category.purpose, categoryName: category.name })
                }
                label={category.name}
              />
            ))}
            <ListRow
              icon={Plus}
              tone="primary"
              label={t.calendarView.newCategory}
              onClick={() => setCreating(true)}
            />
          </ListGroup>

          <p className="mt-4 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {words.importance}
          </p>
          <TourSlider
            stop={choice.stop}
            label={words.importance}
            onChange={(stop) => setChoice({ stop })}
          />

          <NewCategorySheet
            open={creating}
            onClose={() => setCreating(false)}
            onSave={(category) => {
              setChoice(category);
              setCreating(false);
            }}
          />
        </div>
      )}
    </BottomSheet>
  );
}
