import type { ReactNode } from "react";

import PhoneSubHeader from "@/components/PhoneSubHeader";
import TopNav from "@/components/TopNav";
import { useT } from "@/i18n/lang";
import { FLOW_STEPS, previousStep, searchForStep, type FlowStep } from "@/lib/schedulerFlow";
import { cn } from "@/lib/utils";

/**
 * One screen of the phone's scheduling flow (#101), laid out like a phone
 * app's sheet for making something: the step's title and a line on what it
 * is for, its content, and the way on in a bar pinned above the tab bar.
 * The first step is a main screen (the app's header with the language
 * switch); the others open from it, with a back button to the step before.
 * The screen is at least as tall as the phone's, so the bar sits at the
 * bottom even when a step is short.
 */
export default function FlowShell({
  step,
  pathname,
  onBack,
  footer,
  children,
}: {
  step: FlowStep;
  /** The page's own address ("/" or "/plan"), for the back link. */
  pathname: string;
  onBack: () => void;
  /** The way on: the button, with the live answer above it on some steps. */
  footer: ReactNode;
  children: ReactNode;
}) {
  const t = useT();
  const words = t.schedulerFlow;
  const index = FLOW_STEPS.indexOf(step);
  const previous = previousStep(step);

  return (
    <div className="flex min-h-[calc(100dvh-var(--tab-bar-height)-env(safe-area-inset-top)-env(safe-area-inset-bottom))] flex-col bg-background">
      {previous ? (
        <PhoneSubHeader
          title={words.steps[step]}
          back={pathname + searchForStep(previous)}
          backLabel={words.steps[previous]}
          onBack={onBack}
        />
      ) : (
        <TopNav />
      )}

      <main className="flex-1 px-4 pb-6">
        <div className="flex items-center gap-3 pt-1">
          <div aria-hidden className="flex flex-1 gap-1.5">
            {FLOW_STEPS.map((s, i) => (
              <span
                key={s}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  i <= index ? "bg-primary" : "bg-secondary",
                )}
              />
            ))}
          </div>
          <span className="shrink-0 text-xs font-medium text-muted-foreground">
            {words.stepOf(index + 1, FLOW_STEPS.length)}
          </span>
        </div>

        <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-foreground">
          {words.titles[step]}
        </h2>
        <p className="mt-1 text-[15px] text-muted-foreground">{words.intros[step]}</p>

        <div className="mt-5">{children}</div>
      </main>

      <div className="sticky bottom-[var(--tab-bar-height)] z-30 flex flex-col gap-2 border-t bg-card px-4 pb-2 pt-2 shadow-[0_-8px_24px_-16px_rgba(0,0,0,0.25)]">
        {footer}
      </div>
    </div>
  );
}

/** The flow's main button: on to the next step (or past an optional one). */
export function FlowButton({
  onClick,
  disabled = false,
  quiet = false,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  /** A step left as it was: a plain button rather than the coloured one. */
  quiet?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-12 w-full rounded-xl text-[15px] font-bold transition disabled:opacity-50",
        quiet
          ? "border bg-card text-foreground hover:bg-secondary"
          : "bg-orange-700 text-white hover:bg-orange-800",
      )}
    >
      {children}
    </button>
  );
}
