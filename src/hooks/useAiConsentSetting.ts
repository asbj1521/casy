import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { setAiConsent } from "@/api/account";
import { whoAmIQueryKey, type WhoAmI } from "@/api/groups";
import { useAuth } from "@/context/auth";
import { useAiConsent } from "@/hooks/useAiAllowed";
import { forgetAskedTitles, labelBookQuery } from "@/hooks/useEventLabels";
import { forgetAskedTrips, legBookQuery, tripAnswersQuery } from "@/hooks/useTrips";
import { clearLabelsFor } from "@/lib/eventLabels";
import { NO_ANSWERS } from "@/lib/trips";

/**
 * Saying yes, or no again, to Casy's AI using content from your calendar
 * (#120). Taking the yes back also deletes the labels and trips (#115) kept on
 * this phone, at once, since they were made from titles the AI is no longer
 * allowed to read.
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
        old ? { ...old, aiConsent: on, aiShare: on ? old.aiShare : false } : old,
      );
      // Whether corrections are shared comes with the yes (on unless the
      // person switched it off before): the server knows.
      if (on) void queryClient.invalidateQueries({ queryKey: whoAmIQueryKey(userId) });
      if (!on) {
        clearLabelsFor(userId);
        forgetAskedTitles();
        forgetAskedTrips();
        queryClient.setQueryData(labelBookQuery(userId).queryKey, {});
        queryClient.setQueryData(legBookQuery(userId).queryKey, {});
        queryClient.setQueryData(tripAnswersQuery(userId).queryKey, NO_ANSWERS);
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
