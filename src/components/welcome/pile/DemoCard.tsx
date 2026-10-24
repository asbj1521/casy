import { motion } from "framer-motion";
import { Check, Meh, X } from "lucide-react";

import { AnswerIcon } from "@/components/swipe/SwipeCard";
import Avatar from "@/components/ui/Avatar";
import { useT } from "@/i18n/lang";
import { cn } from "@/lib/utils";
import { SWIPE_TIME } from "./demo";

/**
 * A suggested date on Sara's phone, drawn as the swipe screen's card
 * (DateDeck's CardFace and SwipeCard's stamps): "Dato 1 af 3", the date, the
 * time, how soon, and the others' answers so far. Stacked under the one being
 * answered (`depth`); answered, it is stamped and
 * thrown off the screen in one go, right for can and left for can't.
 */
export function DemoCard({
  depth,
  answer,
  position,
  total,
  date,
  time,
  inDays,
  others,
}: {
  depth: number;
  answer: "accepted" | "declined" | null;
  position: number;
  total: number;
  date: string;
  time: string;
  inDays: string;
  others: { name: string; answer: "accepted" | "declined" | undefined }[];
}) {
  const t = useT();
  const right = answer === "accepted";
  const dir = right ? 1 : -1;
  return (
    <motion.div
      className="absolute inset-0"
      style={{ zIndex: 10 - depth }}
      initial={false}
      animate={
        answer
          ? { x: dir * 640, rotate: dir * 18, opacity: 0 }
          : { x: 0, rotate: 0, y: depth * 10, scale: 1 - depth * 0.04, opacity: depth > 1 ? 0 : 1 }
      }
      transition={
        answer
          ? { duration: SWIPE_TIME, ease: [0.3, 0, 0.8, 0.6] }
          : { type: "spring", stiffness: 300, damping: 26 }
      }
    >
      <div className="flex h-full flex-col rounded-3xl border bg-card p-5 shadow-xl shadow-black/10">
        <p className="text-xs font-bold uppercase tracking-wide text-primary">
          {t.swipe.dateOf(position, total)}
        </p>
        <p className="mt-2 text-[26px] font-extrabold leading-[1.1] tracking-tight text-foreground">
          {date}
        </p>
        <p className="mt-1 text-lg text-foreground">{time}</p>
        <p className="text-sm text-muted-foreground">{inDays}</p>
        <ul className="mt-auto flex flex-wrap gap-1.5 pt-3">
          {others.map((p, i) => (
            <li
              key={p.name}
              className={cn(
                "flex items-center gap-1 rounded-full border py-0.5 pl-0.5 pr-2 text-xs",
                p.answer === "accepted" && "border-emerald-200 bg-emerald-50 text-emerald-800",
                p.answer === "declined" && "border-rose-200 bg-rose-50 text-rose-800",
                !p.answer && "bg-background text-muted-foreground",
              )}
            >
              <Avatar name={p.name} index={i + 1} size="xs" />
              {p.name}
              <AnswerIcon answer={p.answer} />
            </li>
          ))}
        </ul>
      </div>
      {/* The answer it is heading for, stamped on as the real card does. */}
      {answer && (
        <motion.span
          className={cn(
            "absolute top-6 rounded-lg border-[3px] px-2 py-0.5 text-2xl font-extrabold uppercase tracking-wide",
            right
              ? "left-5 -rotate-12 border-emerald-500 text-emerald-600"
              : "right-5 rotate-12 border-rose-500 text-rose-600",
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.1 }}
        >
          {right ? t.swipe.can : t.swipe.cant}
        </motion.span>
      )}
    </motion.div>
  );
}

/**
 * The swipe screen's three answer buttons (SwipeCard's AnswerButtons, drawn
 * here without their handlers), as Sara's screen shows them while she swipes.
 */
export function DemoButtons({ hidden }: { hidden: boolean }) {
  const t = useT();
  const base = "flex items-center justify-center rounded-full border-2 bg-card shadow-md";
  const buttons = [
    ["declined", X, "h-14 w-14 border-rose-200 text-rose-600", "h-7 w-7", t.swipe.cant],
    ["maybe", Meh, "mt-2 h-11 w-11 border-amber-200 text-amber-600", "h-5 w-5", t.swipe.rather],
    ["accepted", Check, "h-14 w-14 border-emerald-200 text-emerald-600", "h-7 w-7", t.swipe.can],
  ] as const;
  return (
    <motion.div
      className="absolute inset-x-0 top-0 flex items-start justify-center gap-6"
      animate={{ opacity: hidden ? 0 : 1 }}
    >
      {buttons.map(([response, Icon, size, iconSize, label]) => (
        <div key={response} className="flex flex-col items-center gap-1">
          <span className={cn(base, size)}>
            <Icon className={iconSize} strokeWidth={2.5} />
          </span>
          <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
        </div>
      ))}
    </motion.div>
  );
}
