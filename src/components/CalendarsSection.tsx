import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  addCalendarLink,
  calendarStatusQuery,
  connectApple,
  consentScreenUrl,
  syncMyCalendars,
  type AppleConnectResult,
} from "@/api/calendars";
import AppleCredentialsForm from "@/components/AppleCredentialsForm";
import AccountList from "@/components/calendars/AccountList";
import AddCalendar from "@/components/calendars/AddCalendar";
import { ADD_ORDER, addTargetId, PROVIDER_BRANDS } from "@/components/calendarProviders";
import IcsLinkForm from "@/components/IcsLinkForm";
import PrimaryCalendarCard from "@/components/PrimaryCalendarCard";
import Collapse from "@/components/ui/Collapse";
import Notice from "@/components/ui/Notice";
import { useSignedInUser } from "@/context/auth";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { useT } from "@/i18n/lang";
import { CONNECT_PARAM, readyProvider } from "@/lib/calendarPrompt";
import { cn } from "@/lib/utils";
import type { CalendarProvider } from "@/types";

/**
 * The calendars page (CalendarAccounts): what you have connected, then
 * adding another, then the primary calendar, in that order of how often
 * each is needed.
 *
 * - Your accounts: one list of every connected account, whatever the
 *   provider, ending in "Sync now" (AccountList). Absent until there is one.
 * - Add a calendar: the four providers (AddCalendar). Google and Outlook
 *   connect through their consent screens (the browser goes there and comes
 *   back); iCloud and an ICS link have none, so their forms open under the
 *   providers, send straight to an Edge Function and show the outcome here.
 * - The primary calendar, once there is anything to choose it from.
 *
 * Until a first calendar is linked, the page opens with a note saying it is
 * the next step, and the providers take turns glowing; arriving with one
 * picked (?connect=apple, from ConnectCalendarPrompt), that one is marked
 * instead, its form already open if it has one.
 */
export default function CalendarsSection() {
  const t = useT();
  const user = useSignedInUser();
  const phone = usePhoneLayout();
  const queryClient = useQueryClient();
  const { data: connections, isPending } = useQuery(calendarStatusQuery(user.id));
  const accounts = (connections ?? [])
    .filter((c) => c.status === "connected")
    // Grouped by provider, in the order they are offered; newest first within one.
    .sort((a, b) => ADD_ORDER.indexOf(a.provider) - ADD_ORDER.indexOf(b.provider));
  const hasConnected = accounts.length > 0;

  // The provider picked before arriving, read once; the address is then
  // cleaned so a refresh doesn't open its form again.
  const [searchParams, setSearchParams] = useSearchParams();
  const [ready] = useState(() => readyProvider(searchParams));
  useEffect(() => {
    if (!ready) return;
    setSearchParams(
      (params) => {
        params.delete(CONNECT_PARAM);
        return params;
      },
      { replace: true },
    );
    document.getElementById(addTargetId(ready))?.scrollIntoView({ block: "nearest" });
  }, [ready, setSearchParams]);

  const [openForm, setOpenForm] = useState<"apple" | "ics" | null>(
    ready === "apple" || ready === "ics" ? ready : null,
  );
  // What the last link or iCloud account added was, for the line above the forms.
  const [linkAdded, setLinkAdded] = useState<{ label: string; busyBlocks: number } | null>(null);
  const [appleAdded, setAppleAdded] = useState<AppleConnectResult | null>(null);
  const sync = useMutation({ mutationFn: () => syncMyCalendars(queryClient) });
  const consent = useMutation({
    mutationFn: consentScreenUrl,
    onSuccess: (url) => window.location.assign(url),
  });
  // A link and an app-specific password are both secrets. Once one has done
  // its job, the form closes (unmounting what was typed) and the mutation is
  // reset, so neither lingers in the page; only the outcome is kept.
  const addLink = useMutation({
    mutationFn: ({ url, name }: { url: string; name: string }) =>
      addCalendarLink(queryClient, url, name),
  });
  const addApple = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      connectApple(queryClient, email, password),
  });

  function connect(provider: CalendarProvider) {
    if (provider === "google" || provider === "outlook") return consent.mutate(provider);
    addLink.reset();
    addApple.reset();
    setLinkAdded(null);
    setAppleAdded(null);
    setOpenForm(provider);
  }

  const synced = sync.data;
  const failedSyncs = synced?.filter((r) => !r.ok).length ?? 0;
  const syncNote = sync.isError
    ? { tone: "error" as const, text: sync.error.message }
    : synced
      ? {
          tone: failedSyncs === 0 ? ("success" as const) : ("error" as const),
          text:
            synced.length === 0
              ? t.profile.syncAllFresh
              : failedSyncs === 0
                ? t.profile.syncedAccounts(synced.length)
                : t.profile.syncSomeFailed(failedSyncs, synced.length),
        }
      : null;

  return (
    <>
      {!isPending && !hasConnected && (
        <div className="mt-6 rounded-2xl border-2 border-primary/40 bg-primary/5 p-4 text-center sm:p-5">
          <h2 className="text-xl font-bold text-foreground sm:text-2xl">
            {t.profile.onboardingTitle}
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground sm:text-base">
            {t.profile.onboardingIntro}
          </p>
        </div>
      )}

      {consent.isError && (
        <Notice tone="error" className="mt-4">
          {consent.error.message}
        </Notice>
      )}

      {hasConnected && (
        <AccountList
          accounts={accounts}
          onReconnect={connect}
          syncing={sync.isPending}
          syncNote={syncNote}
          onSync={() => sync.mutate()}
        />
      )}

      <AddCalendar
        connections={connections ?? []}
        statusPending={isPending}
        chosen={openForm ?? (hasConnected ? null : ready)}
        glow={!isPending && !hasConnected && !ready && !openForm}
        phone={phone}
        onConnect={connect}
      />

      {linkAdded && (
        <Notice tone="success" className="mt-3">
          {t.profile.icsAdded(linkAdded.label, linkAdded.busyBlocks)}
        </Notice>
      )}
      {appleAdded && (
        <Notice tone="success" className="mt-3">
          {t.profile.appleConnected(
            appleAdded.label,
            appleAdded.calendars,
            appleAdded.busyBlocks,
            appleAdded.skippedEvents,
          )}
        </Notice>
      )}

      <Collapse open={openForm === "ics"}>
        <FormCard provider="ics">
          <IcsLinkForm
            submitting={addLink.isPending}
            error={addLink.error?.message ?? null}
            onSubmit={(url, name) =>
              addLink.mutate(
                { url, name },
                {
                  onSuccess: (added) => {
                    setLinkAdded(added);
                    setOpenForm(null);
                    addLink.reset();
                  },
                },
              )
            }
            onCancel={() => {
              setOpenForm(null);
              addLink.reset();
            }}
          />
        </FormCard>
      </Collapse>
      <Collapse open={openForm === "apple"}>
        <FormCard provider="apple">
          <AppleCredentialsForm
            submitting={addApple.isPending}
            error={addApple.error?.message ?? null}
            onSubmit={(email, password) =>
              addApple.mutate(
                { email, password },
                {
                  onSuccess: (added) => {
                    setAppleAdded(added);
                    setOpenForm(null);
                    addApple.reset();
                  },
                },
              )
            }
            onCancel={() => {
              setOpenForm(null);
              addApple.reset();
            }}
          />
        </FormCard>
      </Collapse>

      {/* Where Casy adds agreed events, and whether it does so on its own. */}
      {hasConnected && <PrimaryCalendarCard connections={connections} />}
    </>
  );
}

/** The open form for iCloud or a link, under its provider's mark and name. */
function FormCard({ provider, children }: { provider: CalendarProvider; children: ReactNode }) {
  const t = useT();
  const brand = PROVIDER_BRANDS[provider];
  return (
    <div className="mt-4 rounded-2xl border border-primary/40 bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
            brand.badgeClass,
          )}
        >
          {brand.icon}
        </span>
        <h3 className="font-semibold text-foreground">{t.providers[provider].label}</h3>
      </div>
      {children}
    </div>
  );
}
