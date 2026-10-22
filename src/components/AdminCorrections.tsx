import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronRight, Loader2 } from "lucide-react";

import {
  adminCorrectionHandled,
  adminCorrectionsKey,
  adminCorrectionsQuery,
  type AdminCorrection,
  type LabelCorrectionView,
} from "@/api/admin";
import type { EventLabel } from "@/api/eventLabels";
import type { PlanFeedback } from "@/lib/aiPlan";
import Notice from "@/components/ui/Notice";
import { LOCALE, useLang, useT } from "@/i18n/lang";
import { cn } from "@/lib/utils";

/**
 * The corrections of the AI people sent for review (#122), in admin mode: what
 * they say and never whose they are, newest first. A mistake the AI makes
 * for everyone is turned into a sharper rule in its prompt and a new, made-up
 * test case in supabase/evals/ (the real titles never go in the public repo);
 * marking a correction handled deletes it. Folded away until opened.
 */
export default function AdminCorrections({ youId }: { youId: string }) {
  const t = useT();
  const { lang } = useLang();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: all, isPending, isError, error } = useQuery(adminCorrectionsQuery(youId));
  // Where the AI was wrong first: corrected plans and label corrections, then
  // plans that were sent as they were (right), each newest first.
  const data = all && [...all].sort((a, b) => Number(isRight(a)) - Number(isRight(b)));

  const handled = useMutation({
    mutationFn: adminCorrectionHandled,
    onSuccess: (_done, id) => {
      queryClient.setQueryData<AdminCorrection[]>(adminCorrectionsKey(youId), (old) =>
        old?.filter((c) => c.id !== id),
      );
      void queryClient.invalidateQueries({ queryKey: adminCorrectionsKey(youId) });
    },
  });

  return (
    <div className="mt-4 rounded-2xl border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <ChevronRight
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-90",
          )}
        />
        <span className="text-sm font-semibold text-foreground">{t.admin.correctionsTitle}</span>
        {data && <span className="text-xs tabular-nums text-muted-foreground">{data.length}</span>}
      </button>
      {open && (
        <div className="border-t px-4 pb-4 pt-3">
          <p className="text-xs text-muted-foreground">{t.admin.correctionsIntro}</p>
          {isPending && (
            <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t.admin.loading}
            </p>
          )}
          {isError && (
            <Notice tone="error" className="mt-3">
              {error.message}
            </Notice>
          )}
          {data && data.length === 0 && (
            <p className="mt-3 text-sm text-muted-foreground">{t.admin.correctionsNone}</p>
          )}
          {data && data.length > 0 && (
            <ul className="mt-3 divide-y border-t">
              {data.map((c) => (
                <li key={c.id} className="flex items-start gap-3 py-3">
                  <div className="min-w-0 flex-1 text-sm">
                    <Correction correction={c} />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {new Date(c.createdAt).toLocaleDateString(LOCALE[lang], {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handled.mutate(c.id)}
                    disabled={handled.isPending && handled.variables === c.id}
                    title={t.admin.correctionHandled}
                    className="flex shrink-0 items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-xs font-medium text-foreground transition hover:bg-secondary disabled:opacity-60"
                  >
                    <Check className="h-3.5 w-3.5" />
                    {t.admin.correctionHandled}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** One correction in words: what the AI said, what the person wrote, what came of it. */
function Correction({ correction }: { correction: AdminCorrection }) {
  const t = useT();
  const words = t.eventLabel;
  const label = (l: EventLabel) => `${words.kinds[l.kind]} · ${words.importance[l.importance]}`;

  if (correction.kind === "label") {
    const d = correction.data as LabelCorrectionView;
    return (
      <>
        <p className="font-medium text-foreground">
          {d.title} <span className="font-normal text-muted-foreground">· {d.calendar}</span>
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t.admin.correctionBefore}: {label(d.previous)}. {t.admin.correctionAfter}:{" "}
          {label(d.label)}.
        </p>
        <p className="mt-0.5 text-xs text-foreground">
          {t.admin.correctionNote}: &ldquo;{d.note}&rdquo;
        </p>
      </>
    );
  }
  const d = correction.data as PlanFeedback;
  const show = (v: unknown) => (v === null || v === undefined ? "-" : JSON.stringify(v));
  return (
    <>
      <p className="font-medium text-foreground">{t.admin.correctionPlan}</p>
      {d.texts.map((text, i) => (
        <p key={i} className="mt-0.5 text-xs text-foreground">
          {t.admin.correctionNote}: &ldquo;{text}&rdquo;
        </p>
      ))}
      {d.overridden.length === 0 ? (
        <p className="mt-0.5 text-xs text-muted-foreground">{t.admin.correctionPlanUnchanged}</p>
      ) : (
        <>
          <p className="mt-0.5 text-xs text-muted-foreground">{t.admin.correctionPlanChanged}:</p>
          <ul className="text-xs text-muted-foreground">
            {d.overridden.map((field) => (
              <li key={field}>
                {field}: {show(d.plan[field])} &rarr; {show(d.final[field])}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

/** A plan sent as the AI made it counts as right: it has no lesson in it, only a case that works. */
function isRight(c: AdminCorrection): boolean {
  return c.kind === "plan" && (c.data as PlanFeedback).overridden.length === 0;
}
