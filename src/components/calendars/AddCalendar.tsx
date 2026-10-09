import { Fragment } from "react";
import { Link } from "react-router-dom";
import { CalendarPlus, HelpCircle, Loader2 } from "lucide-react";

import type { CalendarConnectionStatus } from "@/api/calendars";
import { ADD_ORDER, addTargetId, PROVIDER_BRANDS } from "@/components/calendarProviders";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import Notice from "@/components/ui/Notice";
import type { Messages } from "@/i18n/da";
import { useT } from "@/i18n/lang";
import { cn } from "@/lib/utils";
import type { CalendarProvider } from "@/types";

/** Where one provider stands, for its tile or row. */
interface ProviderState {
  id: CalendarProvider;
  /** How many of its accounts are connected. */
  connected: number;
  /** Its newest attempt is still connecting (back from Google or Outlook). */
  pending: boolean;
  /** Why its newest attempt failed, if it did. */
  failed: string | null;
  /** Its form is open, or it was picked before arriving (?connect=). */
  chosen: boolean;
}

function providerStates(
  offer: CalendarProvider[],
  connections: CalendarConnectionStatus[],
  busy: CalendarProvider | null,
  chosen: CalendarProvider | null,
  t: Messages,
): ProviderState[] {
  return offer.map((id) => {
    // Newest first, as calendar-status orders them: the first is the latest attempt.
    const attempts = connections.filter((c) => c.provider === id);
    const latest = attempts[0];
    return {
      id,
      connected: attempts.filter((c) => c.status === "connected").length,
      pending: latest?.status === "pending" || busy === id,
      failed:
        latest?.status === "error" ? (latest.error_message ?? t.providerCard.unknownError) : null,
      chosen: chosen === id,
    };
  });
}

/** What a provider's button says: connect, add another, try again. */
function connectLabel(state: ProviderState, t: Messages): string {
  if (state.id === "device") return t.providerCard.connect;
  if (state.connected > 0) return t.providerCard.addAnother;
  if (state.id === "ics") return t.providerCard.addLink;
  return state.failed ? t.providerCard.tryAgain : t.providerCard.connect;
}

/**
 * "Add a calendar": the providers on offer (the four, and the phone itself
 * in the iPhone app) with what each one covers, as tiles on a computer and as
 * list rows on a phone. Choosing Google or Outlook leaves for its consent
 * screen; Apple and the link open their form under this section (the page
 * draws it); the phone asks iOS and sends its calendars.
 */
export default function AddCalendar({
  offer,
  connections,
  statusPending,
  busy,
  chosen,
  glow,
  phone,
  onConnect,
}: {
  /** The providers to offer, in order (ADD_HERE, less this phone once connected). */
  offer: CalendarProvider[];
  connections: CalendarConnectionStatus[];
  /** calendar-status hasn't answered yet, so nobody knows what is linked. */
  statusPending: boolean;
  /** Connecting right now, without leaving the page (the phone). */
  busy: CalendarProvider | null;
  chosen: CalendarProvider | null;
  /** Nothing connected and nothing picked: the tiles take turns glowing. */
  glow: boolean;
  phone: boolean;
  onConnect: (provider: CalendarProvider) => void;
}) {
  const t = useT();
  const states = providerStates(offer, connections, busy, chosen, t);
  const failures = states.filter((s) => s.failed);

  if (phone) {
    return (
      <>
        <ListGroup
          title={t.calendarAccounts.add}
          footnote={
            <>
              {t.calendarAccounts.help}{" "}
              {ADD_ORDER.map((id, i) => (
                <Fragment key={id}>
                  {i > 0 && ", "}
                  <Link
                    to={PROVIDER_BRANDS[id].helpTo ?? "/"}
                    className="underline underline-offset-2"
                  >
                    {t.calendarView.providerNames[id]}
                  </Link>
                </Fragment>
              ))}
            </>
          }
        >
          {states.map((state) => {
            const brand = PROVIDER_BRANDS[state.id];
            const waiting = statusPending || state.pending;
            return (
              <ListRow
                key={state.id}
                id={addTargetId(state.id)}
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
                label={t.providers[state.id].label}
                detail={t.connectPrompt.hints[state.id]}
                value={waiting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                selected={state.chosen}
                onClick={waiting ? undefined : () => onConnect(state.id)}
                chevron
              />
            );
          })}
        </ListGroup>
        <Failures failures={failures} />
      </>
    );
  }

  return (
    <section className="mt-6 min-w-0">
      <h2 className="mb-1.5 px-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t.calendarAccounts.add}
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {states.map((state, index) => {
          const brand = PROVIDER_BRANDS[state.id];
          return (
            <li
              key={state.id}
              id={addTargetId(state.id)}
              className={cn(
                "flex flex-col rounded-2xl border bg-card p-4 shadow-sm",
                glow && "animate-connect-highlight",
                state.chosen && "border-primary/70 ring-4 ring-primary/25",
              )}
              // Each tile peaks as the one before it fades (connect-highlight).
              style={glow ? { animationDelay: `${index * 800}ms` } : undefined}
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                    brand.badgeClass,
                  )}
                >
                  {brand.icon}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold leading-tight text-foreground">
                    {t.providers[state.id].label}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t.connectPrompt.hints[state.id]}
                  </p>
                </div>
              </div>
              {state.failed && (
                <p className="mt-3 text-xs text-red-700">
                  {t.providerCard.lastFailed(state.failed)}
                </p>
              )}
              {/* Pinned to the bottom, the help link on a line of its own, so
                  all four tiles end alike whatever their button says. */}
              <div className="mt-auto flex flex-col items-start gap-3 pt-4">
                {statusPending || state.pending ? (
                  <span className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm font-medium text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {statusPending ? t.providerCard.checking : t.providerCard.connecting}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onConnect(state.id)}
                    className="flex items-center gap-2 rounded-full border bg-background px-3.5 py-1.5 text-sm font-semibold text-foreground transition hover:bg-secondary"
                  >
                    <CalendarPlus className="h-4 w-4" />
                    {connectLabel(state, t)}
                  </button>
                )}
                {brand.helpTo && (
                  <Link
                    to={brand.helpTo}
                    className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                    {t.providers[state.id].help}
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** A phone's failed attempts, under the list, with the real reason. */
function Failures({ failures }: { failures: ProviderState[] }) {
  const t = useT();
  return failures.map((state) => (
    <Notice key={state.id} tone="error" className="mt-3">
      {t.providers[state.id].label}: {t.providerCard.lastFailed(state.failed ?? "")}
    </Notice>
  ));
}
