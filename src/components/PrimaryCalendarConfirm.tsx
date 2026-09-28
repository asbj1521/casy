import { Loader2 } from "lucide-react";

import { useT } from "@/i18n/lang";

/**
 * "Make X your primary calendar?" with a yes and a cancel: the second step
 * every change of primary calendar goes through, on the profile page and on
 * My calendar alike. Neutral rather than red, since nothing is lost: events
 * already added stay where they are.
 */
export default function PrimaryCalendarConfirm({
  message,
  confirmLabel,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  message: string;
  confirmLabel: string;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  return (
    <div className="mt-3 rounded-lg border bg-secondary/40 p-3 text-sm text-foreground">
      <p>{message}</p>
      {error && <p className="mt-2 font-medium text-red-700">{error}</p>}
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="text-sm text-muted-foreground transition hover:text-foreground"
        >
          {t.common.cancel}
        </button>
      </div>
    </div>
  );
}
