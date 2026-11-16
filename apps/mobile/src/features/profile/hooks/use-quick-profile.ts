import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useReducer } from "react";

import { errorTextOf } from "../../../services/api/api-error-text";
import { useServices } from "../../../services/services-context";
import {
  profileFormReducer,
  type ProfileFormAction,
  type ProfileFormState,
} from "../model/profile-form.reducer";
import { canSubmit, profileRequest } from "../model/profile-form.selectors";
import { skipQuickProfile } from "../model/skip-quick-profile";
import { saveProfileMutation } from "../queries/profile-queries";

/** The first access (with "Pular" and "Pronto") or the edit from the account (with "Salvar"). */
export type QuickProfileMode = "onboarding" | "edit";

export interface QuickProfileModel {
  readonly state: ProfileFormState;
  readonly dispatch: (action: ProfileFormAction) => void;
  readonly saving: boolean;
  /** The refusal of the last save, or `null`. */
  readonly failure: string | null;
  readonly submit: () => void;
  readonly skip: () => void;
}

/**
 * Screen 27. The saved profile lands in the query cache; on the first access the session gate then
 * leaves the screen by itself, and in edit mode `onSaved` goes back.
 */
export function useQuickProfile(initial: ProfileFormState, onSaved: () => void): QuickProfileModel {
  const { sacouApi, onboardingSkip } = useServices();
  const client = useQueryClient();
  const [state, dispatch] = useReducer(profileFormReducer, initial);
  const save = useMutation(saveProfileMutation({ api: sacouApi, client }));

  return {
    state,
    dispatch,
    saving: save.isPending,
    failure: save.error === null ? null : errorTextOf(save.error),
    submit: () => {
      if (!canSubmit(state) || save.isPending) return;
      save.mutate(profileRequest(state), { onSuccess: onSaved });
    },
    skip: () => {
      skipQuickProfile(state, {
        onboardingSkip,
        save: (body) => {
          save.mutate(body);
        },
      });
    },
  };
}
