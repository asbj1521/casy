import { useT } from "@/i18n/lang";

/** Says a group is made up, wherever one is named. */
export default function ExampleBadge() {
  const t = useT();
  return (
    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
      {t.common.example}
    </span>
  );
}
