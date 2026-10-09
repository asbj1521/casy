import type { ReactNode } from "react";

import PhoneSubHeader from "@/components/PhoneSubHeader";
import TopNav from "@/components/TopNav";
import { useT } from "@/i18n/lang";
import { flowSteps, previousStep, searchForStep, type FlowStep } from "@/lib/schedulerFlow";
import { cn } from "@/lib/utils";

/**
 * One screen of the phone's scheduling flow (#101), laid out like a phone
 * app's sheet for making something: how far along it is, the step's
 * content, and the way on in a bar pinned above the tab bar.
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
  fill = false,
  ai = false,
  children,
}: {
  step: FlowStep;
  /** Planning with AI (#100): its three steps rather than the four. */
  ai?: boolean;
  /** The page's own address ("/" or "/plan"), for the back link. */
  pathname: string;
  onBack: () => void;
  /** The way on: the button, with the live answer above it on some steps; none while swiping. */
  footer: ReactNode;
  /**
   * Exactly the screen's height, the content taking what is left (the dates
   * step's deck of cards), rather than at least it and scrolling.
   */
  fill?: boolean;
  children: ReactNode;
}) {
  const t = useT();
  const words = t.schedulerFlow;
  const steps = flowSteps(ai);
  const index = steps.indexOf(step);
  const previous = previousStep(step, ai);

  return (
    <div
      className={cn(
        "flex flex-col bg-background",
        fill
          ? "h-[calc(100dvh-var(--tab-bar-height)-env(safe-area-inset-top)-env(safe-area-inset-bottom))]"
          : "min-h-[calc(100dvh-var(--tab-bar-height)-env(safe-area-inset-top)-env(safe-area-inset-bottom))]",
      )}
    >
      {previous ? (
        <PhoneSubHeader
          title={words.steps[step]}
          back={pathname + searchForStep(previous, ai)}
          backLabel={words.steps[previous]}
          onBack={onBack}
        />
      ) : (
        <TopNav />
      )}

      <main className={cn("flex-1 px-4", fill ? "flex min-h-0 flex-col pb-2" : "pb-6")}>
        <div className="flex items-center gap-3 pt-1">
          <div aria-hidden className="flex flex-1 gap-1.5">
            {steps.map((s, i) => (
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
            {words.stepOf(index + 1, steps.length)}
          </span>
        </div>

        {/* The first step's question is its title; the others are named in
            the header bar above, so their content starts right away. */}
        {previous ? (
          <div className={cn("mt-4", fill && "flex min-h-0 flex-1 flex-col")}>{children}</div>
        ) : (
          <>
            <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-foreground">
              {words.groupTitle}
            </h2>
            <div className="mt-4">{children}</div>
          </>
        )}
      </main>

      {footer && (
        <div className="sticky bottom-[var(--tab-bar-height)] z-30 flex flex-col gap-2 border-t bg-card px-4 pb-2 pt-2 shadow-[0_-8px_24px_-16px_rgba(0,0,0,0.25)]">
          {footer}
        </div>
      )}
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
