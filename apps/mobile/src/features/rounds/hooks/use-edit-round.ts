import type { GroupSettings } from "@sacou/match-engine";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { errorTextOf } from "../../../services/api/api-error-text";
import type { Round } from "../../../services/api/sacou-api";
import { useServices } from "../../../services/services-context";
import { editRoundState, updateRoundRequest } from "../model/edit-round";
import type { RoundSettingsView } from "../model/round-detail";
import { updateRoundMutation } from "../queries/round-mutations";
import { useRoundForm, type CreateRoundModel } from "./use-create-round";

export interface EditRoundInput {
  readonly groupId: string;
  readonly settings: GroupSettings;
  readonly round: Round;
  readonly view: RoundSettingsView;
}

/** "Editar rodada": the same form as screen 20, started from the round, and "Salvar" sends a `PATCH`. */
export function useEditRound(input: EditRoundInput, onSaved: () => void): CreateRoundModel {
  const { sacouApi } = useServices();
  const client = useQueryClient();
  const { settings, round, view } = input;
  const form = useRoundForm(settings, () => editRoundState(settings, round, view));
  const mutation = useMutation(updateRoundMutation(sacouApi, client, input.groupId, round.roundId));
  return {
    ...form,
    publishDisabled: mutation.isPending || !form.canPublish,
    pending: mutation.isPending,
    errorText: mutation.isError ? errorTextOf(mutation.error) : null,
    publish: () => {
      if (!form.canPublish || mutation.isPending) return;
      mutation.mutate(updateRoundRequest(settings, view, form.state), { onSuccess: onSaved });
    },
  };
}
