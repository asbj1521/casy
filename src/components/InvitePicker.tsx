import { useId, useState, type KeyboardEvent } from "react";
import { Mail, Plus, X } from "lucide-react";

import type { Invitees } from "@/api/groups";
import Avatar from "@/components/ui/Avatar";
import { FIELD } from "@/components/ui/field";
import GlassButton from "@/components/ui/GlassButton";
import { ListGroup, ListPickRow, ListRow } from "@/components/ui/ListGroup";
import { useT } from "@/i18n/lang";
import { looksLikeEmail, MAX_EMAILS_PER_INVITE, type KnownPerson } from "@/lib/groups";

/** Past this many people, a search box keeps the list usable. */
const FILTER_FROM = 8;

/**
 * Who to invite: tick people you already share a group with, or add email
 * addresses. Controlled, so the sheet around it decides what happens with
 * the choice. Rows, as the phone's lists are (#153): a tick at the end of a
 * picked person, and email as one row that opens its field.
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
  const [emailOpen, setEmailOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const invitedSet = new Set(invited);
  const needle = filter.trim().toLowerCase();
  const shown = needle ? people.filter((p) => p.name.toLowerCase().includes(needle)) : people;
  const count = value.profileIds.length + value.emails.length;

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

  // Enter adds the address instead of submitting the sheet's form.
  function onEmailKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addDraft();
    }
  }

  return (
    <>
      {people.length === 0 ? (
        <p className="mt-6 px-4 text-xs text-muted-foreground">
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
              className={`${FIELD} mt-6`}
            />
          )}
          <ListGroup
            title={t.invite.people}
            footnote={count > 0 ? t.invite.consent : undefined}
            className={people.length > FILTER_FROM ? "mt-3" : undefined}
          >
            {shown.map((p, i) => {
              const already = invitedSet.has(p.profileId);
              return (
                <ListPickRow
                  key={p.profileId}
                  type="checkbox"
                  checked={value.profileIds.includes(p.profileId)}
                  disabled={already}
                  onChange={() => toggle(p.profileId)}
                  leading={<Avatar name={p.name} index={i} size="row" src={p.avatarUrl} />}
                  label={p.name}
                  detail={t.invite.from(p.groupNames.join(", "))}
                  value={already ? t.invite.invited : undefined}
                />
              );
            })}
            {shown.length === 0 && <ListRow label={t.invite.noMatch} />}
          </ListGroup>
        </>
      )}

      <ListGroup className={people.length === 0 ? "mt-3" : undefined}>
        <ListRow
          icon={Mail}
          label={t.invite.email}
          expanded={emailOpen}
          onClick={() => setEmailOpen(!emailOpen)}
        />
        {value.emails.map((email) => (
          <ListRow
            key={email}
            icon={Mail}
            label={email}
            trailing={
              <button
                type="button"
                onClick={() =>
                  onChange({ ...value, emails: value.emails.filter((e) => e !== email) })
                }
                aria-label={t.invite.removeEmail(email)}
                className="-mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            }
          />
        ))}
      </ListGroup>
      {emailOpen && (
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <input
              id={emailId}
              type="email"
              inputMode="email"
              autoComplete="off"
              autoFocus
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setDraftError(null);
              }}
              onKeyDown={onEmailKey}
              onBlur={() => looksLikeEmail(draft) && addDraft()}
              placeholder={t.invite.emailPlaceholder}
              aria-label={t.invite.email}
              aria-invalid={!!draftError}
              className={`${FIELD} min-w-0 flex-1`}
            />
            <GlassButton
              size="sm"
              icon={Plus}
              onClick={addDraft}
              disabled={!draft.trim()}
              className="h-12 shrink-0"
            >
              {t.invite.addEmail}
            </GlassButton>
          </div>
          {draftError && <p className="mt-1.5 px-1 text-xs text-red-700">{draftError}</p>}
          <p className="mt-1.5 px-4 text-xs text-muted-foreground">{t.invite.emailHelp}</p>
        </div>
      )}
    </>
  );
}
