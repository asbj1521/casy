import { useState } from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";

import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { useT } from "@/i18n/lang";
import { isNativeApp } from "@/lib/nativeApp";
import { chooseTheme, storedTheme, type ThemeChoice } from "@/lib/theme";

const CHOICES = [
  { choice: "system", icon: Monitor },
  { choice: "light", icon: Sun },
  { choice: "dark", icon: Moon },
] as const;

/**
 * "Udseende" (#93): follow the system, or always light or dark, on this
 * device, as the iPhone's own settings list it: a check by the one chosen.
 * The same on a phone's website and a computer; the app has none, since it
 * always follows the phone.
 */
export default function AppearanceGroup() {
  const t = useT();
  const words = t.appearance;
  const [current, setCurrent] = useState<ThemeChoice>(() => storedTheme(isNativeApp));
  if (isNativeApp) return null;

  return (
    <ListGroup title={words.title}>
      {CHOICES.map(({ choice, icon }) => (
        <ListRow
          key={choice}
          icon={icon}
          label={words[choice]}
          value={
            current === choice ? (
              <Check className="h-4 w-4 text-primary" aria-label={words.chosen} />
            ) : null
          }
          onClick={() => {
            chooseTheme(choice);
            setCurrent(choice);
          }}
        />
      ))}
    </ListGroup>
  );
}
