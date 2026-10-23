import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, UserX } from "lucide-react";

import { blockedQuery, blockedQueryKey, unblockPerson } from "@/api/safety";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import Notice from "@/components/ui/Notice";
import { useSignedInUser } from "@/context/auth";
import { LOCALE, useLang, useT } from "@/i18n/lang";

/**
 * Your data's list of people you blocked (#142), each with "Fjern blokering".
 * Nothing at all until someone is blocked, so the page stays short.
 */
export default function BlockedPeople() {
  const t = useT();
  const { lang } = useLang();
  const userId = useSignedInUser().id;
  const queryClient = useQueryClient();
  const { data: blocked } = useQuery(blockedQuery(userId));
  const unblock = useMutation({
    mutationFn: unblockPerson,
    onSuccess: (data) => queryClient.setQueryData(blockedQueryKey(userId), data.blocked),
  });
  if (!blocked || blocked.length === 0) return null;

  return (
    <>
      <ListGroup title={t.safety.blockedTitle} footnote={t.safety.blockedFootnote}>
        {blocked.map((b) => (
          <ListRow
            key={b.profileId}
            icon={UserX}
            label={b.name ?? t.safety.unknownName}
            detail={t.safety.blockedSince(
              new Date(b.blockedAt).toLocaleDateString(LOCALE[lang], {
                day: "numeric",
                month: "long",
                year: "numeric",
              }),
            )}
            value={
              unblock.isPending && unblock.variables === b.profileId ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <button
                  type="button"
                  onClick={() => unblock.mutate(b.profileId)}
                  className="text-sm font-medium text-primary"
                >
                  {t.safety.unblock}
                </button>
              )
            }
          />
        ))}
      </ListGroup>
      {unblock.isError && (
        <Notice tone="error" bare className="mt-2">
          {unblock.error.message}
        </Notice>
      )}
    </>
  );
}
