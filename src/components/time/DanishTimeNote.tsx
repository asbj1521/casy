import { Globe } from "lucide-react";

import { useT } from "@/i18n/lang";
import { VIEWER_ELSEWHERE } from "@/lib/viewerTime";
import { cn } from "@/lib/utils";

/**
 * "All times are Danish time", for someone whose clock is another: nothing at
 * all in Denmark, or anywhere that keeps the same clock (lib/viewerTime.ts).
 */
export default function DanishTimeNote({ className }: { className?: string }) {
  const t = useT();
  if (!VIEWER_ELSEWHERE) return null;
  return (
    <p className={cn("flex items-center gap-1.5 text-sm text-muted-foreground", className)}>
      <Globe className="h-4 w-4 shrink-0" />
      {t.timeZone.note}
    </p>
  );
}
