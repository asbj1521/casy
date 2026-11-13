import { APP_NAME } from "@/i18n/brand";

/**
 * The name in the icon's letters (#269): Anton, in capitals, as the icon is.
 * Live text rather than a picture, so it follows the theme's colour and reads
 * as the name to a screen reader. Size it with a text class.
 */
export default function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display uppercase leading-none tracking-normal ${className}`}>
      {APP_NAME}
    </span>
  );
}
