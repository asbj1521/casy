import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

/**
 * The top of a screen opened from another one on a phone (a group, the
 * profile's password): back to where it was opened from on the left, its
 * title in the middle, kept in place while the screen scrolls, as on an
 * iPhone. Main screens have PhoneHeader instead.
 */
export default function PhoneSubHeader({
  title,
  back,
  backLabel,
  onBack,
}: {
  title: string;
  back: string;
  backLabel: string;
  /**
   * Going back some other way than following the link, such as a step back
   * in the browser's history (the scheduling flow, #101). The link stays,
   * for opening it in a new tab.
   */
  onBack?: () => void;
}) {
  return (
    <header className="sticky top-[env(safe-area-inset-top)] z-30 grid h-12 grid-cols-[1fr_auto_1fr] items-center gap-2 bg-background px-2">
      <Link
        to={back}
        onClick={
          onBack &&
          ((e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey) return;
            e.preventDefault();
            onBack();
          })
        }
        className="flex min-w-0 items-center justify-self-start rounded-lg py-1 pr-2 text-[15px] text-primary"
      >
        <ChevronLeft className="h-6 w-6 shrink-0" />
        <span className="truncate">{backLabel}</span>
      </Link>
      <h1 className="max-w-[55vw] truncate text-[15px] font-semibold text-foreground">{title}</h1>
      <span />
    </header>
  );
}
