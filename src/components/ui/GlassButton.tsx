import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Loader2, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const SIZES = {
  md: { button: "h-11 pl-4 pr-5 text-[17px]", icon: "h-5 w-5" },
  sm: { button: "h-9 px-3.5 text-[15px] font-semibold", icon: "h-4 w-4" },
};

/**
 * A button on its own: a glass capsule with orange text and icon, as My
 * calendar's Planlæg button (CLAUDE.md, Design language). A link with `to`.
 */
export default function GlassButton({
  icon: Icon,
  size = "md",
  to,
  onClick,
  type = "button",
  disabled = false,
  busy = false,
  className,
  children,
}: {
  icon?: LucideIcon;
  size?: keyof typeof SIZES;
  to?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  /** A spinner in place of the icon, and no second press. */
  busy?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const sizes = SIZES[size];
  const classes = cn(
    "glass-pill inline-flex items-center justify-center gap-2 rounded-full text-primary transition active:scale-95 disabled:opacity-50",
    sizes.button,
    className,
  );
  const inner = (
    <>
      {busy ? (
        <Loader2 className={cn(sizes.icon, "animate-spin")} />
      ) : (
        Icon && <Icon className={sizes.icon} />
      )}
      {children}
    </>
  );
  return to ? (
    <Link to={to} className={classes}>
      {inner}
    </Link>
  ) : (
    <button type={type} onClick={onClick} disabled={disabled || busy} className={classes}>
      {inner}
    </button>
  );
}
