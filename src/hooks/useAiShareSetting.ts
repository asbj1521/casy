import { useMutation, useQueryClient } from "@tanstack/react-query";

import { deleteMyCorrections, setAiShare } from "@/api/account";
import { whoAmIQueryKey, type WhoAmI } from "@/api/groups";
import { useAuth } from "@/context/auth";

/**
 * Whether the corrections you write to the AI are sent to Casy for review
 * (#122), and deleting the ones already sent. The switch is Your data's own
 * row, apart from the yes to the AI using your calendar: turning it off keeps
 * the AI on. Both refresh Your data and what the page knows (`whoami`).
 */
export function useAiShareSetting() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["my-data", userId] });

  const share = useMutation({
    mutationFn: setAiShare,
    onSuccess: (_done, on) => {
      queryClient.setQueryData<WhoAmI>(whoAmIQueryKey(userId), (old) =>
        old ? { ...old, aiShare: on } : old,
      );
      void refresh();
    },
  });
  const remove = useMutation({
    mutationFn: deleteMyCorrections,
    onSuccess: () => void refresh(),
  });

  return {
    setSharing: (on: boolean) => share.mutate(on),
    removeSent: () => remove.mutate(),
    saving: share.isPending,
    removing: remove.isPending,
    error: share.error?.message ?? remove.error?.message ?? null,
  };
}
