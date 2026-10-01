import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { useT } from "@/i18n/lang";
import { cn } from "@/lib/utils";

/**
 * The second step before anything that needs a "yes": what will happen, then
 * the button that does it beside a way back. Red (`danger`) when something
 * is lost for good, neutral when nothing is (choosing another primary
 * calendar). `children` sits between the message and the buttons, for a
 * word to type before a deletion; `confirmDisabled` holds the button until
 * it is typed.
 */
export default function ConfirmPanel({
  tone = "danger",
  message,
  confirmLabel,
  cancelLabel,
  busy,
  error,
  confirmDisabled = false,
  onConfirm,
  onCancel,
  className,
  children,
}: {
  tone?: "danger" | "neutral";
  message: ReactNode;
  confirmLabel: ReactNode;
  /** Defaults to "Cancel". */
  cancelLabel?: string;
  busy: boolean;
  error?: string | null;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  className?: string;
  children?: ReactNode;
}) {
  const t = useT();
  const danger = tone === "danger";
  return (
    <div
      className={cn(
        "rounded-lg border p-3 text-sm",
        danger ? "border-red-200 bg-red-50 text-red-900" : "bg-secondary/40 text-foreground",
        className,
      )}
    >
      <div>{message}</div>
      {children}
      {error && <p className={cn("mt-2 font-medium", !danger && "text-red-700")}>{error}</p>}
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy || confirmDisabled}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-4 py-1.5 font-semibold transition disabled:opacity-60",
            danger
              ? "bg-red-600 text-white hover:bg-red-700"
              : "bg-primary text-primary-foreground hover:opacity-90",
          )}
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className={cn(
            "transition",
            danger
              ? "text-red-900/80 hover:text-red-900"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {cancelLabel ?? t.common.cancel}
        </button>
      </div>
    </div>
  );
}
