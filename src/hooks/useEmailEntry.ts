import { useState, type KeyboardEvent } from "react";

import type { Invitees } from "@/api/groups";
import { useT } from "@/i18n/lang";
import { looksLikeEmail, MAX_EMAILS_PER_INVITE } from "@/lib/groups";

/** The field for inviting by email: what is being typed, and adding it to the picks. */
export function useEmailEntry(value: Invitees, onChange: (value: Invitees) => void) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [draft, setDraftText] = useState("");
  const [error, setError] = useState<string | null>(null);

  /** Add what's in the field; false if it wasn't an address that could be added. */
  function add(): boolean {
    const email = draft.trim().toLowerCase();
    if (!email) return true;
    if (!looksLikeEmail(email)) {
      setError(t.invite.notAnEmail);
      return false;
    }
    if (!value.emails.includes(email)) {
      if (value.emails.length >= MAX_EMAILS_PER_INVITE) {
        setError(t.invite.tooManyEmails(MAX_EMAILS_PER_INVITE));
        return false;
      }
      onChange({ ...value, emails: [...value.emails, email] });
    }
    setDraftText("");
    setError(null);
    return true;
  }

  return {
    open,
    setOpen,
    draft,
    setDraft: (text: string) => {
      setDraftText(text);
      setError(null);
    },
    error,
    add,
    // Enter adds the address instead of submitting the sheet's form.
    onKey: (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        add();
      }
    },
  };
}

export type EmailEntry = ReturnType<typeof useEmailEntry>;
