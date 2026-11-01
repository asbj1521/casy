import { useQuery } from "@tanstack/react-query";
import { CalendarHeart, Users } from "lucide-react";

import { groupsQuery } from "@/api/groups";
import FlowButton from "@/components/ui/FlowButton";
import GroupBubbles from "@/components/ui/GroupBubbles";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import Sheet from "@/components/ui/Sheet";
import { useSignedInUser } from "@/context/auth";
import { useLang, useT } from "@/i18n/lang";
import { LOCALE } from "@/i18n/locale";
import { formatLongDate, formatTime } from "@/lib/format";
import type { PrimeDate } from "@/lib/primeDates";

/**
 * A starred day on the home page, opened (#171): which group is free, when,
 * that everyone is, and one way on, Planlæg with the group and the day set.
 * The footnote is the promise: nobody hears of it until something is sent.
 */
export default function PrimeDateSheet({
  open,
  prime,
  onClose,
  onPlan,
}: {
  open: boolean;
  /** Kept by the page after closing, so the sheet slides away still showing it. */
  prime: PrimeDate | null;
  onClose: () => void;
  onPlan: (prime: PrimeDate) => void;
}) {
  const t = useT();
  const { lang } = useLang();
  const { data: groups } = useQuery(groupsQuery(useSignedInUser().id));
  const group = groups?.find((g) => g.id === prime?.groupId);

  // "Ana, Bo og dig": you last, as everyone says it.
  const names = group
    ? new Intl.ListFormat(LOCALE[lang], { type: "conjunction" }).format([
        ...group.members.filter((m) => !m.isYou).map((m) => m.name),
        ...(group.members.some((m) => m.isYou) ? [t.prime.you] : []),
      ])
    : "";
  const iso = (ms: number) => new Date(ms).toISOString();

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t.prime.title}
      closeLabel={t.common.done}
      footer={
        prime && (
          <FlowButton onClick={() => onPlan(prime)} disabled={!group}>
            {t.prime.plan}
          </FlowButton>
        )
      }
    >
      {prime && group && (
        <>
          <ListGroup>
            <ListRow
              leading={
                <GroupBubbles members={group.members} picture={group.pictureUrl} size="md" />
              }
              label={group.name}
            />
            <ListRow
              icon={CalendarHeart}
              label={formatLongDate(iso(prime.day), lang)}
              value={
                prime.kind === "weekend"
                  ? t.prime.weekend
                  : t.prime.until(formatTime(iso(prime.start)), formatTime(iso(prime.end)))
              }
            />
            <ListRow icon={Users} label={t.prime.allFree(group.members.length)} detail={names} />
          </ListGroup>
          <p className="mt-2 px-4 text-[12px] text-muted-foreground">{t.prime.footnote}</p>
        </>
      )}
    </Sheet>
  );
}
