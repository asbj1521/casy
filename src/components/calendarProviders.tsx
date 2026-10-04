import type { ReactNode } from "react";
import { Link2 } from "lucide-react";
import { FaMicrosoft } from "react-icons/fa6";
import { SiApple, SiGoogle } from "react-icons/si";

import type { CalendarProvider } from "@/types";

/**
 * How each calendar provider is drawn wherever one is offered (the calendars
 * page's cards, the connect pop-up): its mark, the round badge behind it, and
 * its step-by-step guide. Names come from the language files (t.providers).
 */
export const PROVIDER_BRANDS: Record<
  CalendarProvider,
  { icon: ReactNode; badgeClass: string; helpTo: string }
> = {
  apple: {
    icon: <SiApple className="h-4 w-4 text-neutral-800" />,
    badgeClass: "bg-neutral-200",
    helpTo: "/help/connect-icloud",
  },
  ics: {
    // Not a company, so a generic link icon rather than a brand mark.
    icon: <Link2 className="h-4 w-4 text-violet-700" />,
    badgeClass: "bg-violet-100",
    helpTo: "/help/connect-ics",
  },
  google: {
    icon: <SiGoogle className="h-4 w-4" style={{ color: "#4285F4" }} />,
    badgeClass: "bg-blue-100",
    helpTo: "/help/connect-google",
  },
  outlook: {
    // Simple Icons carries no Outlook-specific mark, so this is Microsoft's
    // own logo (the closest real brand mark available) rather than a letter.
    icon: <FaMicrosoft className="h-4 w-4" style={{ color: "#0078D4" }} />,
    badgeClass: "bg-sky-100",
    helpTo: "/help/connect-outlook",
  },
};
