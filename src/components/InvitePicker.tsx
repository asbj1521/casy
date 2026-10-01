import { useId, useState, type KeyboardEvent } from "react";
import { Check, Mail, X } from "lucide-react";

import type { Invitees } from "@/api/groups";
import Avatar from "@/components/ui/Avatar";
import { useT } from "@/i18n/lang";
import { looksLikeEmail, MAX_EMAILS_PER_INVITE, type KnownPerson } from "@/lib/groups";
import { cn } from "@/lib/utils";

/** Past this many people, a search box keeps the list usable. */
const FILTER_FROM = 8;

/**
 * Who to invite: tick people you already share a group with, or add email
 * addresses. Controlled, so the dialog around it decides what happens with
 * the choice. Used for a new group and for inviting more to one you're in.
 *
 * An address still in the field when the field loses focus is added too, so
 * typing one and going straight for the button doesn't silently drop it.
 */
export default function InvitePicker({
  people,
  invited = [],
  allInWhenEmpty = false,
  value,
  onChange,
}: {
  people: KnownPerson[];
  /** Already invited to this group: shown, not pickable. */
  invited?: string[];
  /** With no one to list, say everyone's already in rather than "make a group first". */
  allInWhenEmpty?: boolean;
  value: Invitees;
  onChange: (value: Invitees) => void;
}) {
  const t = useT();
  const emailId = useId();
  const [filter, setFilter] = useState("");
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const invitedSet = new Set(invited);
  const needle = filter.trim().toLowerCase();
  const shown = needle ? people.filter((p) => p.name.toLowerCase().includes(needle)) : people;

  function toggle(profileId: string) {
    const picked = value.profileIds.includes(profileId);
    onChange({
      ...value,
      profileIds: picked
        ? value.profileIds.filter((id) => id !== profileId)
        : [...value.profileIds, profileId],
    });
  }

  /** Add what's in the field; false if it wasn't an address that could be added. */
  function addDraft(): boolean {
    const email = draft.trim().toLowerCase();
    if (!email) return true;
    if (!looksLikeEmail(email)) {
      setDraftError(t.invite.notAnEmail);
      return false;
    }
    if (!value.emails.includes(email)) {
      if (value.emails.length >= MAX_EMAILS_PER_INVITE) {
        setDraftError(t.invite.tooManyEmails(MAX_EMAILS_PER_INVITE));
        return false;
      }
      onChange({ ...value, emails: [...value.emails, email] });
    }
    setDraft("");
    setDraftError(null);
    return true;
  }

  // Enter adds the address instead of submitting the dialog's form.
  function onEmailKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addDraft();
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 text-sm font-medium text-foreground">{t.invite.people}</p>
        {people.length === 0 ? (
          <p className="rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
            {allInWhenEmpty ? t.invite.allIn : t.invite.peopleEmpty}
          </p>
        ) : (
          <>
            {people.length > FILTER_FROM && (
              <input
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                placeholder={t.invite.filter}
                aria-label={t.invite.filter}
                className="mb-2 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            )}
            <ul className="max-h-60 space-y-0.5 overflow-y-auto rounded-lg border p-1">
              {shown.map((p, i) => {
                const already = invitedSet.has(p.profileId);
                const picked = value.profileIds.includes(p.profileId);
                return (
                  <li key={p.profileId}>
                    <label
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm",
                        already ? "cursor-default" : "cursor-pointer hover:bg-secondary",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={picked}
                        disabled={already}
                        onChange={() => toggle(p.profileId)}
                        className="peer sr-only"
                      />
                      <span
                        aria-hidden
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40",
                          picked
                            ? "border-primary bg-primary text-primary-foreground"
                            : "bg-background",
                          already && "opacity-0",
                        )}
                      >
                        {picked && <Check className="h-3 w-3" />}
                      </span>
                      <Avatar name={p.name} index={i} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-foreground">{p.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {t.invite.from(p.groupNames.join(", "))}
                        </span>
                      </span>
                      {already && (
                        <span className="shrink-0 text-xs font-medium text-muted-foreground">
                          {t.invite.invited}
                        </span>
                      )}
                    </label>
                  </li>
                );
              })}
              {shown.length === 0 && (
                <li className="px-2 py-1.5 text-sm text-muted-foreground">{t.invite.noMatch}</li>
              )}
            </ul>
          </>
        )}
      </div>

      <div>
        <label htmlFor={emailId} className="mb-1.5 block text-sm font-medium text-foreground">
          {t.invite.email}
        </label>
        <div className="flex gap-2">
          <input
            id={emailId}
            type="email"
            inputMode="email"
            autoComplete="off"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setDraftError(null);
            }}
            onKeyDown={onEmailKey}
            onBlur={() => looksLikeEmail(draft) && addDraft()}
            placeholder={t.invite.emailPlaceholder}
            aria-invalid={!!draftError}
            className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            type="button"
            onClick={addDraft}
            disabled={!draft.trim()}
            className="shrink-0 rounded-lg border px-3 py-2 text-sm font-medium text-foreground transition hover:bg-secondary disabled:opacity-50"
          >
            {t.invite.addEmail}
          </button>
        </div>
        {draftError && <p className="mt-1.5 text-xs text-red-700">{draftError}</p>}
        {value.emails.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {value.emails.map((email) => (
              <li
                key={email}
                className="flex items-center gap-1.5 rounded-full border bg-secondary py-0.5 pl-2.5 pr-1 text-xs text-foreground"
              >
                <Mail className="h-3 w-3 text-muted-foreground" />
                {email}
                <button
                  type="button"
                  onClick={() =>
                    onChange({ ...value, emails: value.emails.filter((e) => e !== email) })
                  }
                  aria-label={t.invite.removeEmail(email)}
                  className="flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition hover:bg-background hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1.5 text-xs text-muted-foreground">{t.invite.emailHelp}</p>
      </div>
    </div>
  );
}
