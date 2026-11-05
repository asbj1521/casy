import { useId, useState } from "react";
import { Mail, Plus, X } from "lucide-react";

import type { Invitees } from "@/api/groups";
import Avatar from "@/components/ui/Avatar";
import { FIELD } from "@/components/ui/field";
import GlassButton from "@/components/ui/GlassButton";
import { ListGroup, ListPickRow, ListRow } from "@/components/ui/ListGroup";
import { useEmailEntry, type EmailEntry } from "@/hooks/useEmailEntry";
import { useT } from "@/i18n/lang";
import { looksLikeEmail, type KnownPerson } from "@/lib/groups";

/** Past this many people, a search box keeps the list usable. */
const FILTER_FROM = 8;
/** Folded on a phone (#227): this many show, with the rest behind "Vis alle". */
const FOLDED_TO = 4;

/**
 * Who to invite: tick people you already share a group with, or add email
 * addresses. Controlled, so the sheet around it decides what happens with
 * the choice. Rows, as the phone's lists are (#153): a tick at the end of a
 * picked person, and email as one row that opens its field.
 *
 * An address still in the field when the field loses focus is added too, so
 * typing one and going straight for the button doesn't silently drop it.
 *
 * A phone's Invite sheet (InviteBody) puts the pieces in its own order.
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
  const email = useEmailEntry(value, onChange);
  return (
    <>
      <PeopleList
        people={people}
        invited={invited}
        allInWhenEmpty={allInWhenEmpty}
        value={value}
        onChange={onChange}
      />
      <ListGroup className={people.length === 0 ? "mt-3" : undefined}>
        <EmailRows email={email} value={value} onChange={onChange} />
      </ListGroup>
      <EmailField email={email} />
    </>
  );
}

/** The people to tick; `folded` shows the first few, and anyone picked, until asked for all. */
export function PeopleList({
  people,
  invited = [],
  allInWhenEmpty = false,
  folded = false,
  value,
  onChange,
}: {
  people: KnownPerson[];
  invited?: string[];
  allInWhenEmpty?: boolean;
  folded?: boolean;
  value: Invitees;
  onChange: (value: Invitees) => void;
}) {
  const t = useT();
  const [filter, setFilter] = useState("");
  const [all, setAll] = useState(false);
  const invitedSet = new Set(invited);
  const needle = filter.trim().toLowerCase();
  const matching = needle ? people.filter((p) => p.name.toLowerCase().includes(needle)) : people;
  const count = value.profileIds.length + value.emails.length;
  const canFold = folded && people.length > FOLDED_TO;
  const shut = canFold && !all;
  const shown = shut
    ? matching.filter((p, i) => i < FOLDED_TO || value.profileIds.includes(p.profileId))
    : matching;
  const searchable = people.length > FILTER_FROM && !shut;

  function toggle(profileId: string) {
    const picked = value.profileIds.includes(profileId);
    onChange({
      ...value,
      profileIds: picked
        ? value.profileIds.filter((id) => id !== profileId)
        : [...value.profileIds, profileId],
    });
  }

  if (people.length === 0) {
    return (
      <p className="mt-6 px-4 text-xs text-muted-foreground">
        {allInWhenEmpty ? t.invite.allIn : t.invite.peopleEmpty}
      </p>
    );
  }
  return (
    <>
      {searchable && (
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
        className={searchable ? "mt-3" : undefined}
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
              detail={
                p.groupNames.length > 0 ? t.invite.from(p.groupNames.join(", ")) : t.invite.fromPast
              }
              value={already ? t.invite.invited : undefined}
            />
          );
        })}
        {shown.length === 0 && <ListRow label={t.invite.noMatch} />}
        {canFold && (
          <ListRow
            tone="primary"
            label={all ? t.invite.showFewer : t.invite.showAll(people.length)}
            expanded={all}
            onClick={() => {
              setAll(!all);
              setFilter("");
            }}
          />
        )}
      </ListGroup>
    </>
  );
}

/** The row that opens the email field, and the addresses added, for inside a ListGroup. */
export function EmailRows({
  email,
  value,
  onChange,
}: {
  email: EmailEntry;
  value: Invitees;
  onChange: (value: Invitees) => void;
}) {
  const t = useT();
  return (
    <>
      <ListRow
        icon={Mail}
        label={t.invite.email}
        expanded={email.open}
        onClick={() => email.setOpen(!email.open)}
      />
      {value.emails.map((address) => (
        <ListRow
          key={address}
          icon={Mail}
          label={address}
          trailing={
            <button
              type="button"
              onClick={() =>
                onChange({ ...value, emails: value.emails.filter((e) => e !== address) })
              }
              aria-label={t.invite.removeEmail(address)}
              className="-mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          }
        />
      ))}
    </>
  );
}

/** The email field, once its row has opened it. */
export function EmailField({ email }: { email: EmailEntry }) {
  const t = useT();
  const emailId = useId();
  if (!email.open) return null;
  return (
    <div className="mt-3">
      <div className="flex items-center gap-2">
        <input
          id={emailId}
          type="email"
          inputMode="email"
          autoComplete="off"
          autoFocus
          value={email.draft}
          onChange={(e) => email.setDraft(e.target.value)}
          onKeyDown={email.onKey}
          onBlur={() => looksLikeEmail(email.draft) && email.add()}
          placeholder={t.invite.emailPlaceholder}
          aria-label={t.invite.email}
          aria-invalid={!!email.error}
          className={`${FIELD} min-w-0 flex-1`}
        />
        <GlassButton
          size="sm"
          icon={Plus}
          onClick={email.add}
          disabled={!email.draft.trim()}
          className="h-12 shrink-0"
        >
          {t.invite.addEmail}
        </GlassButton>
      </div>
      {email.error && <p className="mt-1.5 px-1 text-xs text-red-700">{email.error}</p>}
      <p className="mt-1.5 px-4 text-xs text-muted-foreground">{t.invite.emailHelp}</p>
    </div>
  );
}
