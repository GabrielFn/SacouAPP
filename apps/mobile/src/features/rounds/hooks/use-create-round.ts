import type { GroupSettings, SettingsValue } from "@sacou/match-engine";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useReducer } from "react";

import { errorTextOf } from "../../../services/api/api-error-text";
import { wallClockNow } from "../../../services/api/wall-clock";
import { useServices } from "../../../services/services-context";
import { formatTime } from "../../groups/model/schedule-text";
import {
  createRoundReducer,
  type CreateRoundAction,
  type CreateRoundState,
  type PersonalizePath,
} from "../model/create-round.reducer";
import {
  canPublish,
  isPublishDisabled,
  createRoundErrors,
  createRoundRequest,
  groupValueOf,
  initialCreateRoundState,
  repeatSummary,
  resolvedPreview,
  shareTextOf,
  type CreateRoundErrors,
} from "../model/create-round.selectors";
import { dateLabel } from "../model/round-dates";
import { createRoundMutation } from "../queries/round-mutations";

export interface CreateRoundInput {
  readonly groupId: string;
  readonly groupName: string;
  readonly settings: GroupSettings;
  readonly hasSeries: boolean;
}

export interface CreateRoundModel {
  readonly state: CreateRoundState;
  readonly dispatch: (action: CreateRoundAction) => void;
  readonly errors: CreateRoundErrors;
  readonly canPublish: boolean;
  readonly publishDisabled: boolean;
  readonly resolved: ReturnType<typeof resolvedPreview>;
  readonly repeatText: string;
  /** True while the call is on the way: the button is off, against a double tap. */
  readonly pending: boolean;
  readonly errorText: string | null;
  readonly publish: () => void;
  /** A value equal to the group's drops the leaf from the layer: the layer holds only differences. */
  readonly setLeaf: (path: PersonalizePath, value: SettingsValue) => void;
}

/** Runs the reducer of screen 20 and the call of "Publicar"; the screen only draws (D4). */
export function useCreateRound(
  input: CreateRoundInput,
  onPublished: (roundId: string) => void,
): CreateRoundModel {
  const { sacouApi, shareSheet } = useServices();
  const client = useQueryClient();
  const { settings } = input;
  const [state, dispatch] = useReducer(createRoundReducer, undefined, () =>
    initialCreateRoundState(settings, new Date(wallClockNow()), input.hasSeries),
  );
  const mutation = useMutation(createRoundMutation(sacouApi, client, input.groupId));
  const now = new Date(wallClockNow());
  const errors = createRoundErrors(settings, state, now);
  const ready = canPublish(settings, state, now);
  return {
    state,
    dispatch,
    errors,
    canPublish: ready,
    publishDisabled: isPublishDisabled(settings, state, now, mutation.isPending),
    resolved: resolvedPreview(settings, state),
    repeatText: repeatSummary(settings, state, formatTime),
    pending: mutation.isPending,
    errorText: mutation.isError ? errorTextOf(mutation.error) : null,
    publish: () => {
      if (!ready || mutation.isPending) return;
      const body = createRoundRequest(settings, state);
      mutation.mutate(body, {
        onSuccess: (round) => {
          onPublished(round.roundId);
          const capacity = round.capacity;
          void shareSheet.share(
            shareTextOf(
              input.groupName,
              dateLabel(round.localDate),
              formatTime(round.localTime),
              round.venue,
              capacity,
            ),
          );
        },
      });
    },
    setLeaf: (path, value) => {
      dispatch(
        groupValueOf(settings, path) === value
          ? { type: "layer-reset", path }
          : { type: "layer-set", path, value },
      );
      dispatch({ type: "sheet-closed" });
    },
  };
}
