import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";

import {
  primaryCalendarQuery,
  updatePrimaryCalendar,
  type CalendarConnectionStatus,
} from "@/api/calendars";
import PrimaryCalendarPicker from "@/components/PrimaryCalendarPicker";
import { ListGroup, ListRow, ListSwitchRow } from "@/components/ui/ListGroup";
import Notice from "@/components/ui/Notice";
import Switch from "@/components/ui/Switch";
import { useSignedInUser } from "@/context/auth";
import { usePhoneLayout } from "@/hooks/usePhoneLayout";
import { useT } from "@/i18n/lang";
import { primaryOptions } from "@/lib/primaryCalendar";

/**
 * The profile page's primary calendar setting: which calendar Casy adds
 * agreed events to (PrimaryCalendarPicker, as on My calendar), and whether
 * it does so automatically.
 */
export default function PrimaryCalendarCard({
  connections,
}: {
  /** The profile page's calendar status; undefined while it loads. */
  connections: CalendarConnectionStatus[] | undefined;
}) {
  const t = useT();
  const words = t.primaryCalendar;
  const phone = usePhoneLayout();
  const user = useSignedInUser();
  const queryClient = useQueryClient();
  const { data: primary } = useQuery(primaryCalendarQuery(user.id));

  const autoAdd = useMutation({
    mutationFn: (on: boolean) => updatePrimaryCalendar(queryClient, user.id, { autoAdd: on }),
  });

  const list = connections ?? [];
  const groups = primaryOptions(list, primary?.calendarId ?? null);
  const hasApple = list.some((c) => c.provider === "apple" && c.status === "connected");

  // A phone (#153): a grouped list like the rest of the screen, no star,
  // the explanation as its footnote. A computer's card is as it was.
  if (phone) {
    return (
      <>
        <ListGroup title={words.title} footnote={words.intro}>
          {connections && groups.length === 0 ? (
            <ListRow label={hasApple ? words.waitingForSync : words.noWritable} />
          ) : (
            <>
              <li className="px-4 py-3">
                <PrimaryCalendarPicker connections={connections} />
              </li>
              <ListSwitchRow
                label={words.autoAdd}
                detail={primary ? words.autoAddHelp : words.autoAddNeedsPrimary}
                checked={!!primary?.autoAdd}
                disabled={!primary || autoAdd.isPending}
                onChange={(on) => {
                  autoAdd.reset();
                  autoAdd.mutate(on);
                }}
              />
            </>
          )}
        </ListGroup>
        {autoAdd.error && (
          <Notice tone="error" bare className="mt-2">
            {autoAdd.error.message}
          </Notice>
        )}
      </>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-2">
        <Star className="h-4 w-4 text-amber-500" />
        <h3 className="font-semibold text-foreground">{words.title}</h3>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{words.intro}</p>

      {connections && groups.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {hasApple ? words.waitingForSync : words.noWritable}
        </p>
      ) : (
        <>
          <PrimaryCalendarPicker connections={connections} className="mt-4" />

          <div className="mt-4 flex items-start gap-3 border-t pt-4">
            <Switch
              checked={!!primary?.autoAdd}
              onChange={(on) => {
                autoAdd.reset();
                autoAdd.mutate(on);
              }}
              label={words.autoAdd}
              disabled={!primary || autoAdd.isPending}
              className="mt-0.5"
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{words.autoAdd}</p>
              <p className="text-xs text-muted-foreground">
                {primary ? words.autoAddHelp : words.autoAddNeedsPrimary}
              </p>
            </div>
          </div>

          {autoAdd.error && (
            <Notice tone="error" bare className="mt-3">
              {autoAdd.error.message}
            </Notice>
          )}
        </>
      )}
    </div>
  );
}
