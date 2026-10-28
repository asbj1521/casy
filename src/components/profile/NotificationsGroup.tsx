import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";

import { pushSettingsQuery, setPushKind } from "@/api/account";
import { ListGroup, ListRow, ListSwitchRow } from "@/components/ui/ListGroup";
import { useAuth } from "@/context/auth";
import { useLang, useT } from "@/i18n/lang";
import { isNativeApp } from "@/lib/nativeApp";
import { enablePush, pushPermission } from "@/lib/push";
import type { PushPermission } from "@/lib/pushAsk";

const KINDS = [
  "vote_invited",
  "vote_decided",
  "event_changed",
  "group_invitation",
  "deadline_near",
] as const;

/**
 * "Notifikationer" (#139), in the iPhone app's settings: one switch for each
 * kind of notification, kept on the account. Until iOS has allowed them the
 * group is a single row that asks; after a no in iOS it says where to undo it.
 * Nothing on the website, which sends none.
 */
export default function NotificationsGroup() {
  const t = useT();
  const { lang } = useLang();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? "";
  const [permission, setPermission] = useState<PushPermission | null>(null);
  const [error, setError] = useState<string | null>(null);
  const words = t.push;

  useEffect(() => {
    if (isNativeApp) void pushPermission().then(setPermission, () => setPermission("denied"));
  }, []);

  const settings = useQuery({
    ...pushSettingsQuery(userId),
    enabled: isNativeApp && !!userId && permission === "granted",
  });
  const change = useMutation({
    mutationFn: ({ kind, on }: { kind: string; on: boolean }) => setPushKind(kind, on),
    onSuccess: ({ off }) =>
      queryClient.setQueryData(pushSettingsQuery(userId).queryKey, (old: unknown) => ({
        ...(old as { devices: number }),
        off,
      })),
  });
  const enable = useMutation({
    mutationFn: () => enablePush(lang),
    onSuccess: (answer) => {
      setPermission(answer);
      setError(null);
    },
    onError: () => setError(words.failed),
  });

  if (!isNativeApp || permission === null) return null;

  if (permission === "granted") {
    const off = settings.data?.off ?? [];
    return (
      <ListGroup title={words.title}>
        {KINDS.map((kind) => (
          <ListSwitchRow
            key={kind}
            icon={Bell}
            label={words.kinds[kind]}
            checked={!off.includes(kind)}
            disabled={!settings.data || change.isPending}
            onChange={(on) => change.mutate({ kind, on })}
          />
        ))}
      </ListGroup>
    );
  }
  return (
    <ListGroup title={words.title}>
      {permission === "prompt" ? (
        <ListRow
          icon={Bell}
          label={words.turnOn}
          onClick={() => enable.mutate()}
          detail={error ?? undefined}
        />
      ) : (
        <ListRow icon={Bell} label={words.deniedTitle} detail={words.denied} />
      )}
    </ListGroup>
  );
}
