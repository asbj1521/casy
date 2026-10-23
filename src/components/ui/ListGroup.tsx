import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronRight, type LucideIcon } from "lucide-react";

import Switch from "@/components/ui/Switch";
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
  id,
  icon: Icon,
  leading,
  label,
  detail,
  value,
  to,
  onClick,
  tone = "default",
  trailing,
  expanded,
  chevron = !!to || expanded !== undefined,
  selected = false,
}: {
  /** The row's element id, so a page can scroll to it. */
  id?: string;
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
  /** The row whose content is open beside the list (a computer's groups page). */
  selected?: boolean;
  /** A row that opens and closes more rows: whether they are open (the chevron turns down). */
  expanded?: boolean;
  /** A button at the end of a plain row (one with neither `to` nor `onClick`), such as a delete. */
  trailing?: ReactNode;
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
        {trailing}
        {chevron && (
          <ChevronRight
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform",
              expanded && "rotate-90",
            )}
          />
        )}
      </span>
    </>
  );
  const row = cn("flex w-full items-center gap-3 pl-4 text-left", selected && "bg-secondary");
  const pressable = cn(row, "transition-colors active:bg-secondary");

  return (
    <li id={id} className="group/row">
      {to ? (
        <Link to={to} aria-current={selected ? "page" : undefined} className={pressable}>
          {inner}
        </Link>
      ) : onClick ? (
        <button type="button" onClick={onClick} aria-expanded={expanded} className={pressable}>
          {inner}
        </button>
      ) : (
        <div className={row}>{inner}</div>
      )}
    </li>
  );
}

/** ListRow's hairline part: a label, a line under it, and what goes at the end. */
function RowText({
  label,
  detail,
  end,
  wrap = false,
}: {
  label: ReactNode;
  detail?: ReactNode;
  end?: ReactNode;
  /** The line under may run over several lines rather than being cut. */
  wrap?: boolean;
}) {
  return (
    <span className="flex min-h-[3.25rem] min-w-0 flex-1 items-center gap-3 border-t py-2.5 pr-4 group-first/row:border-t-0">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium text-foreground">{label}</span>
        {detail && (
          <span className={cn("block text-[13px] text-muted-foreground", !wrap && "truncate")}>
            {detail}
          </span>
        )}
      </span>
      {end}
    </span>
  );
}

/**
 * A row that is a choice (CLAUDE.md, Design language): picked, it gets an
 * orange tick at the end. A real checkbox or radio sits inside, out of
 * sight, so screen readers (and tests) find it by the row's label. Disabled,
 * `value` takes the tick's place ("Inviteret").
 */
export function ListPickRow({
  type,
  name,
  checked,
  disabled = false,
  onChange,
  icon: Icon,
  leading,
  label,
  detail,
  value,
}: {
  type: "checkbox" | "radio";
  /** A radio group's name. */
  name?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  icon?: LucideIcon;
  leading?: ReactNode;
  label: ReactNode;
  detail?: ReactNode;
  value?: ReactNode;
}) {
  return (
    <li className="group/row">
      <label
        className={cn(
          // relative: the hidden input is placed inside its own row, not somewhere off screen.
          "relative flex w-full items-center gap-3 pl-4 text-left transition-colors has-[:focus-visible]:bg-secondary",
          disabled ? "cursor-default" : "cursor-pointer active:bg-secondary",
        )}
      >
        <input
          type={type}
          name={name}
          checked={checked}
          disabled={disabled}
          onChange={onChange}
          className="sr-only"
        />
        {leading ?? (Icon && <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />)}
        <RowText
          label={label}
          detail={detail}
          end={
            disabled ? (
              value != null && (
                <span className="shrink-0 text-sm text-muted-foreground">{value}</span>
              )
            ) : (
              <Check
                aria-hidden
                className={cn("h-5 w-5 shrink-0 text-primary", !checked && "invisible")}
              />
            )
          }
        />
      </label>
    </li>
  );
}

/** A row with a switch at its end, for something on or off. */
export function ListSwitchRow({
  icon: Icon,
  label,
  detail,
  checked,
  disabled = false,
  onChange,
}: {
  icon?: LucideIcon;
  label: string;
  detail?: ReactNode;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <li className="group/row">
      <div className="flex w-full items-center gap-3 pl-4">
        {Icon && <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />}
        <RowText
          label={label}
          detail={detail}
          wrap
          end={
            <Switch
              checked={checked}
              onChange={onChange}
              label={label}
              disabled={disabled}
              className="shrink-0"
            />
          }
        />
      </div>
    </li>
  );
}
