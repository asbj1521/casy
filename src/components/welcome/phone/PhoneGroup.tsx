import { memo } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, Plus } from "lucide-react";

import { useT } from "@/i18n/lang";
import { FRIENDS, GROUP_NAME, PEOPLE } from "./demo";
import { GROUP_ROWS, SCREEN } from "./geometry";

/** A person's round face in their own colour: the colour their pen and bars have later. */
export function Face({ name, color, size }: { name: string; color: string; size: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: `rgb(${color})`,
      }}
    >
      {name.charAt(0)}
    </span>
  );
}

const CARD_RECT = {
  left: GROUP_ROWS.left,
  top: GROUP_ROWS.top,
  width: SCREEN.width - GROUP_ROWS.left * 2,
  height: GROUP_ROWS.height * (PEOPLE.length + 1),
  borderRadius: 16,
};
const WHOLE_SCREEN = {
  left: 0,
  top: 0,
  width: SCREEN.width,
  height: SCREEN.height,
  borderRadius: SCREEN.radius,
};
const GROW = { type: "spring", stiffness: 170, damping: 26 } as const;

/**
 * A group on the phone (#228), as the app's group screen draws it: its name,
 * how many are in it, and the members as rows. Friends come in as they join
 * (`joined`, the row a face flies to, PeopleJoining), and the count follows.
 * The members' card is what moves on to the next step: `leaving`, it grows to
 * the whole screen, which is the page the month appears on; `arriving` (every
 * round after the first), it comes out of the whole screen the same way, so the
 * loop has no cut in it.
 */
const PhoneGroup = memo(function PhoneGroup({
  joined,
  leaving,
  arriving,
}: {
  joined: number;
  leaving: boolean;
  arriving: boolean;
}) {
  const t = useT();
  const you = t.welcome.you;
  const shown = { opacity: leaving ? 0 : 1 };
  const fade = { duration: 0.22, delay: !leaving && arriving ? 0.3 : 0 };
  return (
    <div className="absolute inset-0 bg-background">
      <motion.div
        className="absolute inset-x-4 flex items-center justify-between"
        style={{ top: 62 }}
        initial={arriving ? { opacity: 0 } : false}
        animate={shown}
        transition={fade}
      >
        <span className="flex items-center text-[17px] text-primary">
          <ChevronLeft className="h-6 w-6" />
          {t.nav.groupsShort}
        </span>
        <span className="text-[17px] font-semibold text-primary">{t.common.done}</span>
      </motion.div>
      <motion.div
        className="absolute inset-x-0 flex flex-col items-center"
        style={{ top: 112 }}
        initial={arriving ? { opacity: 0 } : false}
        animate={shown}
        transition={fade}
      >
        <span
          className="flex h-[96px] w-[96px] items-center justify-center rounded-full bg-orange-100 text-[40px] font-bold text-orange-700"
          aria-hidden
        >
          {GROUP_NAME.charAt(0)}
        </span>
        <span className="mt-3 text-[24px] font-bold tracking-tight text-foreground">
          {GROUP_NAME}
        </span>
        <span className="text-[15px] tabular-nums text-muted-foreground">
          {t.groupPanel.members(1 + joined)}
        </span>
      </motion.div>
      {/* The members, each in the place its face flies to. */}
      <motion.div
        className="absolute overflow-hidden bg-card"
        initial={arriving ? WHOLE_SCREEN : CARD_RECT}
        animate={leaving ? WHOLE_SCREEN : CARD_RECT}
        transition={GROW}
      >
        <motion.div
          className="absolute left-0 top-0"
          style={{ width: CARD_RECT.width, height: CARD_RECT.height }}
          initial={arriving ? { opacity: 0 } : false}
          animate={shown}
          transition={fade}
        >
          <Row top={0} name={you} color={PEOPLE[0].color} />
          {FRIENDS.map(
            (f, i) =>
              i < joined && (
                <Row
                  key={f.id}
                  top={(i + 1) * GROUP_ROWS.height}
                  name={f.name}
                  color={f.color}
                  pop
                />
              ),
          )}
          <div
            className="absolute inset-x-0 flex items-center gap-3 px-4 text-[17px] font-medium text-primary"
            style={{ top: PEOPLE.length * GROUP_ROWS.height, height: GROUP_ROWS.height }}
          >
            <Plus className="h-6 w-6" />
            {t.groupPanel.invite}
          </div>
        </motion.div>
        {/* Grown, it is the page itself. */}
        <motion.div
          className="absolute inset-0 bg-background"
          initial={{ opacity: arriving ? 1 : 0 }}
          animate={{ opacity: leaving ? 1 : 0 }}
          transition={{ duration: 0.35 }}
        />
      </motion.div>
    </div>
  );
});

function Row({
  top,
  name,
  color,
  pop = false,
}: {
  top: number;
  name: string;
  color: string;
  pop?: boolean;
}) {
  return (
    <motion.div
      className="absolute inset-x-0 flex items-center gap-3 px-3"
      style={{ top, height: GROUP_ROWS.height }}
      initial={pop ? { opacity: 0, scale: 0.94 } : false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 26 }}
    >
      <Face name={name} color={color} size={GROUP_ROWS.face} />
      <span className="text-[17px] text-foreground">{name}</span>
    </motion.div>
  );
}

export default PhoneGroup;
