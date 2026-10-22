import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** A text field typed straight into its row, its text on the right. */
export const ROW_INPUT =
  "min-w-0 flex-1 bg-transparent text-right text-[15px] text-foreground outline-none placeholder:text-muted-foreground";

/** A value on the right that opens a wheel (Dropdown's trigger). */
export const ROW_PICK =
  "flex items-center gap-1 whitespace-nowrap text-[15px] text-muted-foreground transition hover:text-foreground";

/**
 * A row like ListRow's (in a ListGroup), with a control on the right instead
 * of a value: the phone flow's settings (#101). A text field's row is its
 * label, so a tap anywhere on it starts typing; a button names itself, so
 * its row is plain (`labelled={false}`).
 */
export default function FieldRow({
  icon: Icon,
  label,
  labelled = true,
  children,
}: {
  icon: LucideIcon;
  label: string;
  labelled?: boolean;
  children: ReactNode;
}) {
  const Row = labelled ? "label" : "div";
  return (
    <li className="group/row">
      <Row className="flex w-full items-center gap-3 pl-4">
        <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
        <span className="flex min-h-[3.25rem] min-w-0 flex-1 items-center gap-3 border-t py-2.5 pr-4 group-first/row:border-t-0">
          <span className="shrink-0 text-[15px] font-medium text-foreground">{label}</span>
          <span className="flex min-w-0 flex-1 justify-end">{children}</span>
        </span>
      </Row>
    </li>
  );
}
