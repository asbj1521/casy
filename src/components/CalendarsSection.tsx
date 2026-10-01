import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, Loader2, RefreshCw } from "lucide-react";
import { FaMicrosoft } from "react-icons/fa6";
import { SiApple, SiGoogle } from "react-icons/si";

import {
  addCalendarLink,
  calendarStatusQuery,
  connectApple,
  consentScreenUrl,
  syncMyCalendars,
  type AppleConnectResult,
} from "@/api/calendars";
import AppleCredentialsForm from "@/components/AppleCredentialsForm";
import IcsLinkForm from "@/components/IcsLinkForm";
import PrimaryCalendarCard from "@/components/PrimaryCalendarCard";
import ProviderCard, { type ProviderMeta } from "@/components/ProviderCard";
import Collapse from "@/components/ui/Collapse";
import Notice from "@/components/ui/Notice";
import { useSignedInUser } from "@/context/auth";
import { useT } from "@/i18n/lang";
import type { CalendarProvider } from "@/types";

/**
 * Apple and the ICS link come first: they take a form to fill in, so putting
 * them ahead of the one-click Google/Outlook cards keeps the grid from
 * alternating between quick cards and ones that need typing.
 */
const PROVIDERS: (Omit<ProviderMeta, "label" | "help"> & { helpTo: string })[] = [
  {
    id: "apple",
    icon: <SiApple className="h-4 w-4 text-neutral-800" />,
    badgeClass: "bg-neutral-200",
    helpTo: "/help/connect-icloud",
  },
  {
    id: "ics",
    // Not a company, so a generic link icon rather than a brand mark.
    icon: <Link2 className="h-4 w-4 text-violet-700" />,
    badgeClass: "bg-violet-100",
    helpTo: "/help/connect-ics",
  },
  {
    id: "google",
    icon: <SiGoogle className="h-4 w-4" style={{ color: "#4285F4" }} />,
    badgeClass: "bg-blue-100",
    helpTo: "/help/connect-google",
  },
  {
    id: "outlook",
    // Simple Icons carries no Outlook-specific mark, so this is Microsoft's
    // own logo (the closest real brand mark available) rather than a letter.
    icon: <FaMicrosoft className="h-4 w-4" style={{ color: "#0078D4" }} />,
    badgeClass: "bg-sky-100",
    helpTo: "/help/connect-outlook",
  },
];

/**
 * The profile page's calendars: every linked account under its brand, the
 * ways to add another, "Sync now", and the primary calendar.
 *
 * Google and Outlook connect through their consent screens (the browser goes
 * there and comes back). An ICS link and iCloud have none, so their forms
 * send straight to an Edge Function and show the outcome here. Until a first
 * calendar is linked, the section opens with a note saying it is the next
 * step, and the cards take turns glowing.
 */
export default function CalendarsSection() {
  const t = useT();
  const user = useSignedInUser();
  const queryClient = useQueryClient();
  const { data: connections, isPending } = useQuery(calendarStatusQuery(user.id));
  const hasConnected = connections?.some((c) => c.status === "connected") ?? false;

  const [openForm, setOpenForm] = useState<"apple" | "ics" | null>(null);
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

      <section className="mt-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">{t.profile.connectedCalendars}</h2>
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
          {PROVIDERS.map(({ helpTo, ...provider }, index) => {
            // Every attempt for this brand, newest first (calendar-status
            // orders them): the connected accounts, and the latest attempt,
            // which is what "Connecting" and an error describe.
            const attempts = connections?.filter((c) => c.provider === provider.id) ?? [];
            const words = t.providers[provider.id];
            return (
              <ProviderCard
                key={provider.id}
                meta={{ ...provider, label: words.label, help: { to: helpTo, label: words.help } }}
                accounts={attempts.filter((c) => c.status === "connected")}
                latest={attempts[0]}
                statusPending={isPending}
                formOpen={openForm === provider.id}
                highlightDelayMs={hasConnected ? null : index * 800}
                onConnect={() => connect(provider.id)}
              >
                {provider.id === "ics" && (
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
                {provider.id === "apple" && (
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
