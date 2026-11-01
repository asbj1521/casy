import { useQuery } from "@tanstack/react-query";
import { CalendarHeart, Sparkles, Users } from "lucide-react";

import { groupsQuery } from "@/api/groups";
import { primeIdeasQuery } from "@/api/primeIdeas";
import Bone from "@/components/ui/Bone";
import FlowButton from "@/components/ui/FlowButton";
import GroupBubbles from "@/components/ui/GroupBubbles";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import Sheet from "@/components/ui/Sheet";
import { useSignedInUser } from "@/context/auth";
import { useAiAllowed } from "@/hooks/useAiAllowed";
import { useLang, useT } from "@/i18n/lang";
import { LOCALE } from "@/i18n/locale";
import { formatLongDate, formatTime } from "@/lib/format";
import { primeStretch, type PrimeDate } from "@/lib/primeDates";
import { APP_TIME_ZONE } from "@/lib/zone";

/**
 * A starred day on the home page, opened (#171): which group is free, when,
 * that everyone is, and one way on, Planlæg with the group and the day set.
 * The footnote is the promise: nobody hears of it until something is sent.
 * For people AI is on for, two or three ideas for the time (prime-ideas),
 * each a way into Planlæg named after it.
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
  /** Planlæg on the stretch, named after an idea when one was picked. */
  onPlan: (prime: PrimeDate, name?: string) => void;
}) {
  const t = useT();
  const { lang } = useLang();
  const aiAllowed = useAiAllowed();
  const { data: groups } = useQuery(groupsQuery(useSignedInUser().id));
  const group = groups?.find((g) => g.id === prime?.groupId);

  const stretch =
    prime && group
      ? primeStretch(prime, { size: group.members.length, about: group.description }, APP_TIME_ZONE)
      : null;
  // A placeholder stretch keeps the hook's call the same while there is none; never fetched.
  const ideas = useQuery(
    primeIdeasQuery(stretch ?? NO_STRETCH, lang, open && aiAllowed && stretch !== null),
  );

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
          <ListGroup className="mt-0" footnote={t.prime.footnote}>
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
          {/* Ideas only when they can come: none at all is quieter than an error. */}
          {aiAllowed && !ideas.isError && (
            <ListGroup title={t.prime.ideas}>
              {ideas.data
                ? ideas.data.map((idea) => (
                    <ListRow
                      key={idea.title}
                      icon={Sparkles}
                      label={idea.title}
                      detail={idea.why}
                      chevron
                      onClick={() => onPlan(prime, idea.title)}
                    />
                  ))
                : [16, 22].map((chars) => (
                    <ListRow key={chars} icon={Sparkles} label={<Bone chars={chars} />} />
                  ))}
            </ListGroup>
          )}
        </>
      )}
    </Sheet>
  );
}

const NO_STRETCH = {
  kind: "hours",
  startMinute: 0,
  minutes: 0,
  weekday: 0,
  month: 0,
  groupSize: 0,
  about: "",
} as const;
