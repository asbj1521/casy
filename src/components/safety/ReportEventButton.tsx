import { useState } from "react";
import { Flag } from "lucide-react";

import type { SuggestedEvent } from "@/api/events";
import ReportDialog from "@/components/safety/ReportDialog";
import { ListRow } from "@/components/ui/ListGroup";
import { eventTitle } from "@/i18n/eventTitle";
import { useT } from "@/i18n/lang";
import { cn } from "@/lib/utils";

/**
 * "Rapportér aftalen" on someone else's event (#142): a quiet link beside
 * Leave, or a row of a list, opening the report dialog for it. Nothing on
 * your own events.
 */
export default function ReportEventButton({
  event,
  as = "link",
  className,
}: {
  event: SuggestedEvent;
  as?: "link" | "row";
  className?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  if (event.createdBy.isYou) return null;

  const dialog = (
    <ReportDialog
      open={open}
      onClose={() => setOpen(false)}
      choices={[
        {
          label: t.safety.targetEvent(eventTitle(event.title, t)),
          target: { kind: "event", groupId: event.group.id, eventId: event.id },
        },
      ]}
    />
  );
  if (as === "row") {
    return (
      <>
        <ListRow icon={Flag} label={t.safety.reportEvent} onClick={() => setOpen(true)} />
        {dialog}
      </>
    );
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-1 text-sm font-medium text-muted-foreground transition hover:text-foreground",
          className,
        )}
      >
        <Flag className="h-3.5 w-3.5" />
        {t.safety.report}
      </button>
      {dialog}
    </>
  );
}
