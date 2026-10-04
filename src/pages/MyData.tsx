import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, Loader2 } from "lucide-react";

import { downloadMyData, myDataQuery, type MyData } from "@/api/account";
import { PROVIDER_BRANDS } from "@/components/calendarProviders";
import PhoneSubHeader from "@/components/PhoneSubHeader";
import TopNav from "@/components/TopNav";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import Notice from "@/components/ui/Notice";
import { useSignedInUser } from "@/context/auth";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { LOCALE, useLang, useT, type Lang } from "@/i18n/lang";
import { formatDate, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/** "1 Sept 2026" / "1. sep. 2026". */
function day(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleDateString(LOCALE[lang], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** A stored busy time as it is: "Fri 9 Oct · 18:00-20:00", or across days, both ends in full. */
function storedSpan(start: string, end: string, lang: Lang): string {
  const sameDay = new Date(start).toDateString() === new Date(Date.parse(end) - 1).toDateString();
  return sameDay
    ? `${formatDate(start, lang)} · ${formatTime(start)}-${formatTime(end)}`
    : `${formatDate(start, lang)} ${formatTime(start)} ${lang === "da" ? "til" : "to"} ${formatDate(end, lang)} ${formatTime(end)}`;
}

/**
 * Your data (/profile/data): everything Casy holds about you, in the order
 * and words of the privacy policy's "What Casy stores", read fresh from the
 * server each time, and a copy to download. A phone shows it as a screen
 * off the profile; a computer as a page under the header.
 */
export default function MyData() {
  const t = useT();
  const phone = usePhoneLayout();
  const intro = (
    <p className="mt-1 text-sm text-muted-foreground">
      {t.myData.intro(
        <Link to="/privacy" className="font-medium text-foreground underline underline-offset-2">
          {t.myData.privacyLink}
        </Link>,
      )}
    </p>
  );

  if (phone) {
    return (
      <div className="min-h-screen bg-background">
        <PhoneSubHeader title={t.myData.title} back="/profile" backLabel={t.nav.profileShort} />
        <main className="px-4 pb-8">
          {intro}
          <DataLists />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="px-4 pb-20 pt-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <Link
            to="/profile"
            className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {t.nav.profile}
          </Link>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground">
            {t.myData.title}
          </h1>
          {intro}
          <DataLists />
        </div>
      </main>
    </div>
  );
}

function DataLists() {
  const t = useT();
  const userId = useSignedInUser().id;
  const { data, isPending, isError } = useQuery(myDataQuery(userId));
  const download = useMutation({ mutationFn: downloadMyData });

  if (isPending) {
    return (
      <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t.myData.loading}
      </p>
    );
  }
  if (isError) {
    return (
      <Notice tone="error" className="mt-6">
        {t.api.loadMyData}
      </Notice>
    );
  }

  return (
    <>
      <AccountPart data={data} />
      <CalendarsPart data={data} />
      <BusyPart data={data} />
      <GroupsPart data={data} />
      <EventsPart data={data} />
      <CredentialsPart data={data} />

      <ListGroup>
        <ListRow
          leading={
            download.isPending ? (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
            ) : (
              <Download className="h-5 w-5 shrink-0 text-primary" />
            )
          }
          tone="primary"
          label={download.isPending ? t.myData.downloading : t.myData.download}
          detail={t.myData.downloadDetail}
          onClick={download.isPending ? undefined : () => download.mutate()}
        />
      </ListGroup>
      {download.isError && (
        <Notice tone="error" bare className="mt-2">
          {download.error.message}
        </Notice>
      )}
    </>
  );
}

/** A row with a value on the right that may be long (an email): it wraps rather than hiding. */
function Fact({ label, value, detail }: { label: string; value: ReactNode; detail?: string }) {
  return (
    <ListRow
      label={label}
      detail={detail}
      value={<span className="block max-w-[14rem] truncate text-right sm:max-w-xs">{value}</span>}
    />
  );
}

function AccountPart({ data }: { data: MyData }) {
  const t = useT();
  const { lang } = useLang();
  const { account } = data;
  const w = t.myData;
  return (
    <ListGroup title={w.account}>
      <Fact label={w.email} value={account.email ?? "-"} />
      <Fact
        label={w.name}
        value={account.name ?? w.nameNotYet}
        detail={account.name ? (account.nameIsCustom ? w.nameCustom : w.nameFromLogin) : undefined}
      />
      <Fact
        label={w.signIn}
        value={account.signIn.map((m) => w.signInMethods[m] ?? m).join(", ") || "-"}
      />
      {account.createdAt && <Fact label={w.created} value={day(account.createdAt, lang)} />}
    </ListGroup>
  );
}

function CalendarsPart({ data }: { data: MyData }) {
  const t = useT();
  const { lang } = useLang();
  const w = t.myData;
  if (data.calendars.length === 0) {
    return (
      <ListGroup title={w.calendars}>
        <ListRow label={w.noCalendars} />
      </ListGroup>
    );
  }
  return (
    <>
      {data.calendars.map((account, i) => {
        const brand = PROVIDER_BRANDS[account.provider];
        return (
          <ListGroup
            key={i}
            title={i === 0 ? w.calendars : undefined}
            className={i === 0 ? undefined : "mt-3"}
          >
            <ListRow
              leading={
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                    brand.badgeClass,
                  )}
                >
                  {brand.icon}
                </span>
              }
              label={account.label ?? t.providers[account.provider].label}
              detail={`${t.providers[account.provider].label} · ${w.connectedOn(day(account.connectedAt, lang))}`}
            />
            {account.calendars.map((c, j) => (
              <ListRow
                key={j}
                label={c.customName ? `${c.customName} (${c.name ?? ""})` : (c.name ?? "-")}
                detail={[
                  c.purpose ? t.categories[c.purpose] : null,
                  t.calendarView.priorities[c.priority],
                  c.included ? null : w.notCounted,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                value={t.counts.busyBlocks(c.busyCount)}
              />
            ))}
          </ListGroup>
        );
      })}
      <ListGroup className="mt-3">
        <Fact label={w.primary} value={data.primary?.calendar ?? w.primaryNone} />
        <Fact label={w.autoAdd} value={data.primary?.autoAdd ? w.on : w.off} />
      </ListGroup>
    </>
  );
}

function BusyPart({ data }: { data: MyData }) {
  const t = useT();
  const { lang } = useLang();
  const w = t.myData;
  const { busy } = data;
  return (
    <>
      <ListGroup title={w.busy}>
        <Fact label={w.busyCount} value={busy.count} />
        {busy.first && <Fact label={w.busyFrom} value={day(busy.first, lang)} />}
        {busy.last && <Fact label={w.busyTo} value={day(busy.last, lang)} />}
      </ListGroup>
      {busy.next.length > 0 && (
        <ListGroup title={w.busyNext} footnote={w.busyNote} className="mt-3">
          {busy.next.map((b, i) => (
            <ListRow key={i} label={storedSpan(b.start, b.end, lang)} />
          ))}
        </ListGroup>
      )}
    </>
  );
}

function GroupsPart({ data }: { data: MyData }) {
  const t = useT();
  const w = t.myData;
  return (
    <ListGroup title={w.groups}>
      {data.groups.length === 0 && <ListRow label={w.noGroups} />}
      {data.groups.map((g, i) => (
        <ListRow
          key={i}
          label={g.name}
          detail={w.groupDetail(t.counts.members(g.members), g.createdByYou)}
        />
      ))}
      <Fact
        label={w.inviteLinks}
        value={w.inviteLinksValue(data.inviteLinks.made, data.inviteLinks.active)}
      />
      <Fact
        label={w.invitationsToYou}
        value={w.invitationsToYouValue(data.invitations.pending, data.invitations.declined)}
      />
      <Fact label={w.invitationsSent} value={data.invitations.sent} />
      <Fact label={w.emailLookups} value={data.emailLookups} detail={w.emailLookupsDetail} />
    </ListGroup>
  );
}

function EventsPart({ data }: { data: MyData }) {
  const w = useT().myData;
  return (
    <>
      <ListGroup title={w.events}>
        <Fact label={w.invitedTo} value={data.events.invitedTo} />
        <Fact label={w.suggested} value={data.events.suggested} />
        <Fact label={w.answers} value={data.events.answers} />
        <Fact label={w.declined} value={data.events.declined} />
      </ListGroup>
      <ListGroup title={w.entries}>
        <Fact label={w.entriesAdded} value={data.calendarEntries.added} />
        <Fact label={w.entriesDeleted} value={data.calendarEntries.deletedByYou} />
      </ListGroup>
    </>
  );
}

function CredentialsPart({ data }: { data: MyData }) {
  const t = useT();
  const w = t.myData;
  if (data.calendars.length === 0) return null;
  return (
    <ListGroup title={w.credentials} footnote={w.credentialsNote}>
      {data.calendars.map((account, i) => (
        <ListRow
          key={i}
          label={account.label ?? t.providers[account.provider].label}
          detail={account.credential ? w.credentialKinds[account.credential] : w.credentialNone}
        />
      ))}
    </ListGroup>
  );
}
