import type { ReactNode } from "react";

/**
 * An event's screen in the Aftaler sheet (#177): what it holds scrolling,
 * its one main action pinned under it, so the action slides in and out
 * with the screen rather than staying behind on the sheet.
 */
export default function EventScreen({
  action,
  children,
}: {
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">{children}</div>
      {action && (
        <div className="shrink-0 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
          {action}
        </div>
      )}
    </>
  );
}
