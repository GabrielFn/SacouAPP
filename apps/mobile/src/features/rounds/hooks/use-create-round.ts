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
  /** The dates that already have a round: the first date suggested skips them (R97 part 2, D4). */
  readonly takenDates: readonly string[];
}

export interface CreateRoundModel {
  readonly state: CreateRoundState;
  readonly dispatch: (action: CreateRoundAction) => void;
  readonly errors: CreateRoundErrors;
  /** The error of a time still in the draft of its sheet, before it reaches the state. */
  readonly timeErrorOf: (localTime: string) => string | null;
  readonly canPublish: boolean;
  readonly publishDisabled: boolean;
  readonly resolved: ReturnType<typeof resolvedPreview>;
  readonly repeatText: string;
  /** True while the call is on the way: the button is off, against a double tap. */
  readonly pending: boolean;
  readonly errorText: string | null;
  /** "Publicar" of a new round, "Salvar" of an edited one. */
  readonly publish: () => void;
  /** A value equal to the group's drops the leaf from the layer: the layer holds only differences. */
  readonly setLeaf: (path: PersonalizePath, value: SettingsValue) => void;
}

type FormModel = Omit<CreateRoundModel, "publishDisabled" | "pending" | "errorText" | "publish">;

/** The reducer and what derives from it, the same for a new round and an edited one (D4). */
export function useRoundForm(settings: GroupSettings, initial: () => CreateRoundState): FormModel {
  const [state, dispatch] = useReducer(createRoundReducer, undefined, initial);
  const now = new Date(wallClockNow());
  return {
    state,
    dispatch,
    errors: createRoundErrors(settings, state, now),
    timeErrorOf: (localTime) => createRoundErrors(settings, { ...state, localTime }, now).time,
    canPublish: canPublish(settings, state, now),
    resolved: resolvedPreview(settings, state),
    repeatText: repeatSummary(settings, state, formatTime),
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

/** Runs the reducer of screen 20 and the call of "Publicar"; the screen only draws (D4). */
export function useCreateRound(
  input: CreateRoundInput,
  onPublished: (roundId: string) => void,
): CreateRoundModel {
  const { sacouApi, shareSheet } = useServices();
  const client = useQueryClient();
  const { settings } = input;
  const form = useRoundForm(settings, () =>
    initialCreateRoundState(settings, new Date(wallClockNow()), input.hasSeries, input.takenDates),
  );
  const mutation = useMutation(createRoundMutation(sacouApi, client, input.groupId));
  return {
    ...form,
    publishDisabled: isPublishDisabled(
      settings,
      form.state,
      new Date(wallClockNow()),
      mutation.isPending,
    ),
    pending: mutation.isPending,
    errorText: mutation.isError ? errorTextOf(mutation.error) : null,
    publish: () => {
      if (!form.canPublish || mutation.isPending) return;
      const body = createRoundRequest(settings, form.state);
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
              round.shareUrl ?? null,
            ),
          );
        },
      });
    },
  };
}
