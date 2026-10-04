import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";

import {
  addCalendarLink,
  calendarStatusQuery,
  connectApple,
  consentScreenUrl,
  syncMyCalendars,
  type AppleConnectResult,
} from "@/api/calendars";
import AppleCredentialsForm from "@/components/AppleCredentialsForm";
import { PROVIDER_BRANDS } from "@/components/calendarProviders";
import IcsLinkForm from "@/components/IcsLinkForm";
import PrimaryCalendarCard from "@/components/PrimaryCalendarCard";
import ProviderCard from "@/components/ProviderCard";
import Collapse from "@/components/ui/Collapse";
import Notice from "@/components/ui/Notice";
import { useSignedInUser } from "@/context/auth";
import { useT } from "@/i18n/lang";
import { CONNECT_PARAM, readyProvider } from "@/lib/calendarPrompt";
import type { CalendarProvider } from "@/types";

/**
 * Apple and the ICS link come first: they take a form to fill in, so putting
 * them ahead of the one-click Google/Outlook cards keeps the grid from
 * alternating between quick cards and ones that need typing.
 */
const PROVIDER_ORDER: CalendarProvider[] = ["apple", "ics", "google", "outlook"];

/**
 * The profile page's calendars: every linked account under its brand, the
 * ways to add another, "Sync now", and the primary calendar.
 *
 * Google and Outlook connect through their consent screens (the browser goes
 * there and comes back). An ICS link and iCloud have none, so their forms
 * send straight to an Edge Function and show the outcome here. Until a first
 * calendar is linked, the section opens with a note saying it is the next
 * step, and the cards take turns glowing; arriving with one picked
 * (?connect=apple, from ConnectCalendarPrompt), that card glows alone, its
 * form already open if it has one.
 */
export default function CalendarsSection({
  titled = true,
}: {
  /** False on the phone's calendars screen, whose header already says it. */
  titled?: boolean;
}) {
  const t = useT();
  const user = useSignedInUser();
  const queryClient = useQueryClient();
  const { data: connections, isPending } = useQuery(calendarStatusQuery(user.id));
  const hasConnected = connections?.some((c) => c.status === "connected") ?? false;

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
    document.getElementById(cardId(ready))?.scrollIntoView({ block: "nearest" });
  }, [ready, setSearchParams]);

  const [openForm, setOpenForm] = useState<"apple" | "ics" | null>(
    ready === "apple" || ready === "ics" ? ready : null,
  );
  // What the last link or iCloud account added was, for the line under its card.
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

      <section className={titled ? "mt-8" : "mt-2"}>
        <div
          className={
            titled ? "flex flex-wrap items-start justify-between gap-3" : "flex justify-end"
          }
        >
          {titled && (
            <h2 className="text-lg font-semibold text-foreground">
              {t.profile.connectedCalendars}
            </h2>
          )}
          {hasConnected && (
            <button
              type="button"
              onClick={() => sync.mutate()}
              disabled={sync.isPending}
              className="flex shrink-0 items-center gap-2 rounded-full border bg-background px-3.5 py-1.5 text-sm font-semibold text-foreground transition hover:bg-secondary disabled:opacity-60"
            >
              {sync.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {sync.isPending ? t.profile.syncing : t.profile.syncNow}
            </button>
          )}
        </div>
        {sync.isError && (
          <Notice tone="error" bare className="mt-2">
            {sync.error.message}
          </Notice>
        )}
        {synced && (
          <Notice tone={failedSyncs === 0 ? "success" : "error"} bare className="mt-2">
            {synced.length === 0
              ? t.profile.syncAllFresh
              : failedSyncs === 0
                ? t.profile.syncedAccounts(synced.length)
                : t.profile.syncSomeFailed(failedSyncs, synced.length)}
          </Notice>
        )}
        {consent.isError && (
          <Notice tone="error" className="mt-4">
            {consent.error.message}
          </Notice>
        )}

        {/* Where Casy adds agreed events, and whether it does so on its own. */}
        <PrimaryCalendarCard connections={connections} />

        <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
          {PROVIDER_ORDER.map((id, index) => {
            // Every attempt for this brand, newest first (calendar-status
            // orders them): the connected accounts, and the latest attempt,
            // which is what "Connecting" and an error describe.
            const attempts = connections?.filter((c) => c.provider === id) ?? [];
            const { helpTo, ...brand } = PROVIDER_BRANDS[id];
            const words = t.providers[id];
            return (
              <ProviderCard
                key={id}
                id={cardId(id)}
                meta={{ id, ...brand, label: words.label, help: { to: helpTo, label: words.help } }}
                accounts={attempts.filter((c) => c.status === "connected")}
                latest={attempts[0]}
                statusPending={isPending}
                formOpen={openForm === id}
                highlightDelayMs={hasConnected || ready ? null : index * 800}
                ready={!hasConnected && ready === id}
                onConnect={() => connect(id)}
              >
                {id === "ics" && (
                  <>
                    {linkAdded && (
                      <Notice tone="success" bare className="mt-3">
                        {t.profile.icsAdded(linkAdded.label, linkAdded.busyBlocks)}
                      </Notice>
                    )}
                    <Collapse open={openForm === "ics"}>
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
                    </Collapse>
                  </>
                )}
                {id === "apple" && (
                  <>
                    {appleAdded && (
                      <Notice tone="success" bare className="mt-3">
                        {t.profile.appleConnected(
                          appleAdded.label,
                          appleAdded.calendars,
                          appleAdded.busyBlocks,
                          appleAdded.skippedEvents,
                        )}
                      </Notice>
                    )}
                    <Collapse open={openForm === "apple"}>
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
                    </Collapse>
                  </>
                )}
              </ProviderCard>
            );
          })}
        </div>
      </section>
    </>
  );
}

/** The element id of a provider's card, for scrolling to it. */
const cardId = (provider: CalendarProvider) => `connect-${provider}`;
