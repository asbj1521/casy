import { Users } from "lucide-react";

import Avatar from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";

/** Bubbles shown at full strength; a group with more fades the rest away. */
const SOLID = 3;
/** How far the fade goes: the next bubbles, each paler and smaller. */
const FADED = [
  { opacity: 0.5, scale: 0.88 },
  { opacity: 0.22, scale: 0.76 },
];

/**
 * A group as its members: their first letters in coloured, overlapping
 * circles (Avatar), the first three full and any more fading out into the
 * distance, paler and smaller. An example group has no members to show, so
 * it gets the group icon. Silent for screen readers: the group's name is
 * written beside it.
 */
export default function GroupBubbles({
  members,
  size = "sm",
  className,
}: {
  members: { profileId: string; name: string; avatarUrl?: string | null }[];
  size?: "sm" | "md";
  className?: string;
}) {
  if (members.length === 0) {
    return (
      <span
        aria-hidden
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-orange-50 text-primary",
          size === "md" ? "h-8 w-8" : "h-10 w-10",
          className,
        )}
      >
        <Users className={size === "md" ? "h-4 w-4" : "h-5 w-5"} />
      </span>
    );
  }
  const shown = members.slice(0, members.length > SOLID ? SOLID + FADED.length : SOLID);
  return (
    <span aria-hidden className={cn("flex shrink-0 items-center -space-x-2", className)}>
      {shown.map((m, i) => {
        const fade = FADED[i - SOLID];
        return (
          <Avatar
            key={m.profileId}
            name={m.name}
            src={m.avatarUrl}
            index={i}
            size={size}
            className="ring-2 ring-card"
            style={fade ? { opacity: fade.opacity, transform: `scale(${fade.scale})` } : undefined}
          />
        );
      })}
    </span>
  );
}
