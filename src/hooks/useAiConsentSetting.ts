import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { setAiConsent } from "@/api/account";
import { whoAmIQueryKey, type WhoAmI } from "@/api/groups";
import { useAuth } from "@/context/auth";
import { useAiConsent } from "@/hooks/useAiAllowed";
import { forgetAskedTitles, labelBookQuery } from "@/hooks/useEventLabels";
import { clearLabelsFor } from "@/lib/eventLabels";

/**
 * Saying yes, or no again, to Casy's AI using content from your calendar
 * (#120). Taking the yes back also deletes the labels kept on this phone, at
 * once, since they were made from titles the AI is no longer allowed to read.
 * Shared by the box asked on My calendar and the profile's row.
 */
export function useAiConsentSetting() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const queryClient = useQueryClient();
  const consented = useAiConsent();

  const mutation = useMutation({
    mutationFn: setAiConsent,
    onSuccess: (_done, on) => {
      queryClient.setQueryData<WhoAmI>(whoAmIQueryKey(userId), (old) =>
        old ? { ...old, aiConsent: on } : old,
      );
      if (!on) {
        clearLabelsFor(userId);
        forgetAskedTitles();
        queryClient.setQueryData(labelBookQuery(userId).queryKey, {});
      }
      void queryClient.invalidateQueries({ queryKey: ["my-data", userId] });
    },
  });

  return {
    consented,
    set: (on: boolean) => mutation.mutate(on),
    saving: mutation.isPending,
    error: mutation.error?.message ?? null,
    reset: mutation.reset,
  };
}

/**
 * The setting plus whether turning it off is being confirmed, kept by the
 * page so a question half answered survives the row moving (Your data draws
 * the switch at the top while it is off, in the AI list once on).
 */
export function useAiConsentControl() {
  const setting = useAiConsentSetting();
  const [confirming, setConfirming] = useState(false);
  return { ...setting, confirming, setConfirming };
}

export type AiConsentControl = ReturnType<typeof useAiConsentControl>;
