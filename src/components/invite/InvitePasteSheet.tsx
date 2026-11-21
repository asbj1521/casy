import { useId, useRef, useState, type FormEvent, type RefObject } from "react";
import { useNavigate } from "react-router-dom";

import { FIELD, FIELD_LABEL } from "@/components/ui/field";
import FlowButton from "@/components/ui/FlowButton";
import Sheet from "@/components/ui/Sheet";
import { useNativeScreenKnown } from "@/hooks/useNativeScreen";
import { useNativeSheet } from "@/hooks/useNativeSheet";
import { useT } from "@/i18n/lang";
import { inviteInText } from "@/lib/appLinks";

/**
 * An invitation handed to the app by its link (#237), in the app only. iOS
 * carries nothing through the App Store, so a friend who installed Casy from
 * an invite opens it with the invite gone. The invite page copied its link
 * on the way ("Hent appen", GetTheApp), so the one button reads it back:
 * iOS asks the person before the app sees what is copied, and only then.
 * Nothing but an invite link is ever taken from it (inviteInText), and
 * nothing copied is shown or kept. Where that finds none (something else
 * copied since, or no clipboard), the link is pasted or typed into the
 * field, as from the chat it was sent in. The invite then opens as if its
 * link had been tapped: its page, which signs the person in first if need be.
 */
export default function InvitePasteSheet({
  open,
  onClose,
  origin,
  found = false,
}: {
  open: boolean;
  onClose: () => void;
  /** The button it grows out of. */
  origin?: RefObject<HTMLElement | null>;
  /**
   * Opened by itself for a link copied on the way through the App Store
   * (CopiedInvite, #277): it asks, and the invite is joined at once.
   */
  found?: boolean;
}) {
  // The app's own sheet (#282), when it has one: nothing of the page's shows meanwhile.
  const native = useNativeScreenKnown("invitePaste");
  if (native !== false) {
    return native ? <NativeInvitePaste open={open} onClose={onClose} found={found} /> : null;
  }
  return <PagePasteSheet open={open} onClose={onClose} origin={origin} found={found} />;
}

/**
 * The paste sheet when the app draws it (#282): it hands back the invite's
 * address (`next`), opened here as the page's own sheet opens it.
 */
function NativeInvitePaste({
  open,
  onClose,
  found,
}: {
  open: boolean;
  onClose: () => void;
  found: boolean;
}) {
  const navigate = useNavigate();
  useNativeSheet(
    "invitePaste",
    open,
    ({ next }) => {
      onClose();
      // Asked for by name ("Fik du en invitation?"): straight into the group.
      if (next) void navigate(found ? `${next}?join=1` : next);
    },
    onClose,
    () => ({ found }),
  );
  return null;
}

function PagePasteSheet({
  open,
  onClose,
  origin,
  found,
}: {
  open: boolean;
  onClose: () => void;
  origin?: RefObject<HTMLElement | null>;
  found: boolean;
}) {
  const t = useT();
  const words = t.invitePaste;
  const navigate = useNavigate();
  const fieldId = useId();
  const field = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  // The button found no invite among what was copied.
  const [missed, setMissed] = useState(false);
  const written = inviteInText(text);

  function close() {
    setText("");
    setMissed(false);
    onClose();
  }
  function go(path: string) {
    close();
    // Asked for by name ("Fik du en invitation?"): straight into the group.
    navigate(found ? `${path}?join=1` : path);
  }
  async function paste() {
    try {
      const invite = inviteInText(await navigator.clipboard.readText());
      if (invite) return go(invite);
    } catch {
      // No clipboard here, or the person said no: the field is the way.
    }
    setMissed(true);
    if (!found) field.current?.focus();
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (written) go(written);
    else void paste();
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      title={found ? words.ask : words.title}
      closeLabel={t.common.cancel}
      onSubmit={submit}
      origin={origin}
      footer={
        <FlowButton type="submit">
          {found ? words.toGroup : written ? words.open : words.paste}
        </FlowButton>
      }
    >
      {found ? (
        // Opened by itself (#277): they copied nothing themselves, so no link and no field
        // to fill in; one button, and where the invite is gone, what to do instead.
        missed ? (
          <p className="px-1 text-[0.9375rem] text-muted-foreground">{words.gone}</p>
        ) : (
          <p className="px-1 text-[0.9375rem] text-muted-foreground">{words.waiting}</p>
        )
      ) : (
        <>
          <label htmlFor={fieldId} className={FIELD_LABEL}>
            {words.label}
          </label>
          <input
            id={fieldId}
            ref={field}
            type="text"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setMissed(false);
            }}
            placeholder="https://casy.app/join/…"
            className={FIELD}
          />
          {(missed || (text.trim() !== "" && !written)) && (
            <p className="mt-2 px-1 text-xs text-muted-foreground">{words.none}</p>
          )}
        </>
      )}
    </Sheet>
  );
}
