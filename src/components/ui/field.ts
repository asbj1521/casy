/**
 * Text fields as the Planlæg sheet has them (CLAUDE.md, Design language):
 * tall, 17px, rounded, with a small uppercase label above.
 */
export const FIELD =
  "h-12 w-full rounded-xl border bg-card px-3.5 text-[17px] text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20";

/** FIELD for several lines. */
export const TEXTAREA =
  "w-full rounded-xl border bg-card px-3.5 py-2.5 text-[17px] leading-6 text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20";

/** The label above a field, in ListGroup's heading style. */
export const FIELD_LABEL =
  "mb-1.5 block px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground";
