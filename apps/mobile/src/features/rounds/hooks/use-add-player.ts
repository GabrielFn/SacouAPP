import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useReducer, useState } from "react";

import { errorTextOf } from "../../../services/api/api-error-text";
import { useServices } from "../../../services/services-context";
import { useGroup, useGroupMembers } from "../../groups/queries/use-group-queries";
import {
  addPlayerReducer,
  initialAddPlayerState,
  type AddPlayerAction,
  type AddPlayerState,
} from "../model/add-player.reducer";
import { addedText } from "../model/addable-members";
import { addGuestBody, guestNameError } from "../model/guest-form";
import { addGuestMutation } from "../queries/guest-mutations";
import { setMemberAttendanceMutation } from "../queries/round-mutations";
import { useRound } from "../queries/use-round-queries";

export interface AddPlayerModel {
  readonly group: ReturnType<typeof useGroup>;
  readonly round: ReturnType<typeof useRound>;
  readonly members: ReturnType<typeof useGroupMembers>;
  /** The text of the search (one field, `useState`). */
  readonly search: string;
  readonly setSearch: (text: string) => void;
  readonly add: (memberId: string) => void;
  /** The member whose "Adicionar" is on the way, `null` when none. */
  readonly addingId: string | null;
  /** "Davi entrou na espera (2º)." after the last one; the error text when it was refused. */
  readonly feedback: string | null;
  readonly failed: boolean;
  /** The guest's name and the sheet 21a, in the screen's reducer: never in a route nor in the cache. */
  readonly state: AddPlayerState;
  readonly dispatch: (action: AddPlayerAction) => void;
  /** Opens the sheet 21a with a new `requestId`, kept until it closes (ADR 0053, D5). */
  readonly openGuest: () => void;
  /** Closing throws away the draft, the level and the error of the call (nothing of it stays). */
  readonly closeGuest: () => void;
  readonly guestNameError: string | null;
  readonly addGuest: () => void;
  readonly addingGuest: boolean;
  readonly guestErrorText: string | null;
}

/** The queries and the calls of screen 21 and its sheet 21a; the screen only draws. */
export function useAddPlayer(groupId: string, roundId: string): AddPlayerModel {
  const { sacouApi, idGenerator } = useServices();
  const client = useQueryClient();
  const group = useGroup(groupId);
  const round = useRound(groupId, roundId);
  const members = useGroupMembers(groupId);
  const [search, setSearch] = useState("");
  const [state, dispatch] = useReducer(addPlayerReducer, initialAddPlayerState);
  const mutation = useMutation(setMemberAttendanceMutation(sacouApi, client, groupId, roundId));
  const guest = useMutation(addGuestMutation(sacouApi, client, groupId, roundId));
  const memberList = members.data ?? [];
  const lastGuest = state.lastGuest;
  const memberFeedback = mutation.isError
    ? errorTextOf(mutation.error)
    : mutation.data === undefined
      ? null
      : addedText(mutation.data, memberList);
  const nameError = guestNameError(state.guestName);
  const sheet = state.guestSheet;
  return {
    group,
    round,
    members,
    search,
    setSearch,
    add: (memberId) => {
      if (mutation.isPending) return;
      dispatch({ type: "member-add-started" });
      mutation.mutate({ memberId, response: "going" });
    },
    addingId: mutation.isPending ? mutation.variables.memberId : null,
    feedback:
      lastGuest === null
        ? memberFeedback
        : addedText({ ...lastGuest, response: "going" }, memberList),
    failed: lastGuest === null && mutation.isError,
    state,
    dispatch,
    openGuest: () => {
      dispatch({ type: "guest-opened", requestId: idGenerator.newId() });
    },
    closeGuest: () => {
      guest.reset();
      dispatch({ type: "guest-closed" });
    },
    guestNameError: nameError,
    addGuest: () => {
      if (sheet.kind !== "open" || nameError !== null || guest.isPending) return;
      guest.mutate(addGuestBody(state.guestName, sheet), {
        onSuccess: (added) => {
          // Only IDs stay: the call with the name and the level leaves the mutation cache.
          guest.reset();
          mutation.reset();
          dispatch({ type: "guest-added", guest: added });
        },
      });
    },
    addingGuest: guest.isPending,
    guestErrorText: guest.isError ? errorTextOf(guest.error) : null,
  };
}
