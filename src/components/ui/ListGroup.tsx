import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A grouped list, as iPhone apps draw their settings: rows in one rounded
 * card, split by hairlines that start after the icon, with an optional small
 * heading above and a footnote below. The phone layout's screens are built
 * from these, with ListRow inside.
 */
export function ListGroup({
  title,
  footnote,
  className,
  children,
}: {
  title?: ReactNode;
  footnote?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    // min-w-0: in a grid or flex parent, long truncated lines would otherwise
    // stretch the list (and everything beside it) past the screen.
    <section className={cn("mt-6 min-w-0", className)}>
      {title && (
        <h2 className="mb-1.5 px-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
      )}
      <ul className="overflow-hidden rounded-2xl border bg-card">{children}</ul>
      {footnote && <p className="mt-1.5 px-4 text-xs text-muted-foreground">{footnote}</p>}
    </section>
  );
}

/**
 * One row: an icon (or anything else in front, like an avatar), a label with
 * an optional line under it, a value on the right, and a chevron when it
 * leads somewhere. A link with `to`, a button with `onClick`, plain text with
 * neither.
 */
export function ListRow({
  icon: Icon,
  leading,
  label,
  detail,
  value,
  to,
  onClick,
  tone = "default",
  chevron = !!to,
}: {
  icon?: LucideIcon;
  leading?: ReactNode;
  label: ReactNode;
  detail?: ReactNode;
  value?: ReactNode;
  to?: string;
  onClick?: () => void;
  /** "danger" for rows that delete or leave; "primary" for the row that adds. */
  tone?: "default" | "danger" | "primary";
  chevron?: boolean;
}) {
  const color = {
    default: "text-foreground",
    danger: "text-red-600",
    primary: "text-primary",
  }[tone];
  const inner = (
    <>
      {leading ??
        (Icon && (
          <Icon
            className={cn("h-5 w-5 shrink-0", tone === "default" ? "text-muted-foreground" : color)}
          />
        ))}
      {/* The hairline sits on this part, so it starts after the icon. */}
      <span className="flex min-h-[3.25rem] min-w-0 flex-1 items-center gap-3 border-t py-2.5 pr-4 group-first/row:border-t-0">
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate text-[15px] font-medium", color)}>{label}</span>
          {detail && (
            <span className="block truncate text-[13px] text-muted-foreground">{detail}</span>
          )}
        </span>
        {value != null && <span className="shrink-0 text-sm text-muted-foreground">{value}</span>}
        {chevron && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />}
      </span>
    </>
  );
  const row = "flex w-full items-center gap-3 pl-4 text-left";
  const pressable = cn(row, "transition-colors active:bg-secondary");

  return (
    <li className="group/row">
      {to ? (
        <Link to={to} className={pressable}>
          {inner}
        </Link>
      ) : onClick ? (
        <button type="button" onClick={onClick} className={pressable}>
          {inner}
        </button>
      ) : (
        <div className={row}>{inner}</div>
      )}
    </li>
  );
}
