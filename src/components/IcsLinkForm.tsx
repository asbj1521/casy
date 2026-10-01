import { useId, useState, type FormEvent } from "react";
import { Loader2, Lock } from "lucide-react";

import InfoTip from "@/components/InfoTip";
import Collapse from "@/components/ui/Collapse";
import Notice from "@/components/ui/Notice";
import { useT } from "@/i18n/lang";

/**
 * The "add a calendar by link" form: a feed URL and an optional name.
 *
 * It keeps its own field state, because nothing outside cares what is half
 * typed into it — the page only needs to know when a link was submitted. The
 * submitting/error state does come from the page, since it belongs to the
 * request rather than the form.
 */
export default function IcsLinkForm({
  open,
  submitting,
  error,
  onSubmit,
  onCancel,
}: {
  open: boolean;
  submitting: boolean;
  error: string | null;
  onSubmit: (url: string, name: string) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const urlId = useId();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onSubmit(url, name);
  }

  return (
    <Collapse open={open}>
      <form onSubmit={handleSubmit}>
        <div className="mt-4 flex flex-col gap-3 border-t pt-4">
          <div className="text-sm">
            {/* The (i) sits beside the label, not inside it: a button inside a
                  <label> would take over the label from its input. */}
            <div className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
              <Lock className="h-3.5 w-3.5" />
              <label htmlFor={urlId}>{t.icsForm.link}</label>
              <InfoTip label={t.icsForm.about}>{t.icsForm.aboutBody}</InfoTip>
            </div>
            <input
              id={urlId}
              type="text"
              required
              autoComplete="off"
              spellCheck={false}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://... or webcal://..."
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
            <span className="mt-1 block text-xs text-muted-foreground">
              {t.icsForm.likePassword}
            </span>
          </div>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-foreground">{t.icsForm.name}</span>
            <input
              type="text"
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.icsForm.namePlaceholder}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          {error && <Notice tone="error">{error}</Notice>}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? t.icsForm.reading : t.providerCard.addLink}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={onCancel}
              className="text-sm text-muted-foreground transition hover:text-foreground"
            >
              {t.common.cancel}
            </button>
          </div>
        </div>
      </form>
    </Collapse>
  );
}
