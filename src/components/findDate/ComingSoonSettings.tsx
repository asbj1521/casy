import type { ReactNode } from "react";

import { useT } from "@/i18n/lang";
import { cn } from "@/lib/utils";

import type { ComingSoonSection } from "./comingSoon";

/**
 * Settings the scheduling page will get, shown where they will live and
 * marked "Kommer snart": a tab of the settings box on a computer, a section
 * of Flere indstillinger on a phone. Each is a picture of the controls to
 * come, greyed out and hidden from screen readers; the sentence above it
 * says what it will do. Kept short, so no tab is taller than Tidspunkt (the
 * settings box is as tall as its tallest tab).
 */
export function ComingSoonBadge({ className }: { className?: string }) {
  const t = useT();
  return (
    <span
      className={cn(
        "shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800",
        className,
      )}
    >
      {t.settingsPanel.comingSoon}
    </span>
  );
}

export default function ComingSoonSettings({ section }: { section: ComingSoonSection }) {
  const t = useT();
  const words = t.settingsPanel;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">{words[section].intro}</p>
        <ComingSoonBadge />
      </div>
      <div aria-hidden="true" className="pointer-events-none flex flex-wrap gap-4 opacity-50">
        {section === "repeat" && (
          <Fake label={words.repeat.label}>
            <Choice options={words.repeat.options} />
          </Fake>
        )}
        {section === "prefs" && (
          <>
            <Fake label={words.prefs.travel}>
              <Box>{words.prefs.travelValue}</Box>
            </Fake>
            <div className="flex flex-col justify-end gap-2">
              <Toggle>{words.prefs.lateEarly}</Toggle>
              <Toggle>{words.prefs.own}</Toggle>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** A label over a control, like the real settings' fields. */
function Fake({ label, grow, children }: { label: string; grow?: boolean; children: ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-2", grow && "min-w-[10rem] flex-1")}>
      <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

function Box({ placeholder, children }: { placeholder?: boolean; children: ReactNode }) {
  return (
    <span
      className={cn(
        "flex h-11 items-center rounded-xl border bg-card px-3.5 text-base",
        placeholder ? "font-medium text-muted-foreground" : "font-bold text-foreground",
      )}
    >
      {children}
    </span>
  );
}

/** A row of choices, the first picked. */
function Choice({ options }: { options: readonly string[] }) {
  return (
    <span className="flex min-h-11 flex-wrap items-center gap-1 rounded-xl border bg-secondary/60 p-1">
      {options.map((o, i) => (
        <span
          key={o}
          className={cn(
            "flex h-9 items-center rounded-lg px-3 text-sm font-bold",
            i === 0 ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
          )}
        >
          {o}
        </span>
      ))}
    </span>
  );
}

function Toggle({ children }: { children: ReactNode }) {
  return (
    <span className="flex items-center gap-2 text-sm font-medium text-foreground">
      <span className="flex h-5 w-9 shrink-0 items-center rounded-full bg-zinc-300 p-0.5">
        <span className="h-4 w-4 rounded-full bg-white shadow" />
      </span>
      {children}
    </span>
  );
}
