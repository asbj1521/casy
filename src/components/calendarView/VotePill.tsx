import { Vote } from "lucide-react";

import HomePill from "@/components/calendarView/HomePill";
import { useT } from "@/i18n/lang";

/**
 * Votes waiting for your answer, on the home page (#172): a glass capsule
 * just above the bottom buttons that starts answering over the month. One
 * vote is named; several say how many, and it opens the soonest.
 */
export default function VotePill({
  title,
  count,
  hidden,
  zoomingOut,
  onOpen,
}: {
  /** The soonest waiting vote's title. */
  title: string;
  count: number;
  hidden: boolean;
  /** A day is zooming back into the month: the fade-in takes as long as the zoom. */
  zoomingOut?: boolean;
  onOpen: () => void;
}) {
  const t = useT();
  return (
    <HomePill icon={Vote} hidden={hidden} zoomingOut={zoomingOut} onClick={onOpen}>
      {count > 1 ? t.homeVote.waiting(count) : t.homeVote.answer(title)}
    </HomePill>
  );
}
