import { Check, Languages } from "lucide-react";

import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { useLang, useT, type Lang } from "@/i18n/lang";

/** Each language by its own name, whatever the page is in. */
const CHOICES: { lang: Lang; name: string }[] = [
  { lang: "da", name: "Dansk" },
  { lang: "en", name: "English" },
];

/**
 * "Sprog" (#129): the language Casy is shown in, chosen from a list with a
 * check by the one in use, like Appearance beside it. Signed in, this is the
 * only place to change it; the switch in the header is for someone signed out.
 */
export default function LanguageGroup() {
  const t = useT();
  const { lang, setLang } = useLang();
  return (
    <ListGroup title={t.language.title}>
      {CHOICES.map((choice) => (
        <ListRow
          key={choice.lang}
          icon={Languages}
          label={<span lang={choice.lang}>{choice.name}</span>}
          value={
            lang === choice.lang ? (
              <Check className="h-4 w-4 text-primary" aria-label={t.appearance.chosen} />
            ) : null
          }
          onClick={() => setLang(choice.lang)}
        />
      ))}
    </ListGroup>
  );
}
