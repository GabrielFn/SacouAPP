import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useReducer } from "react";

import { errorTextOf } from "../../../services/api/api-error-text";
import type { AttendanceResponse, Member, Round } from "../../../services/api/sacou-api";
import { wallClockNow } from "../../../services/api/wall-clock";
import { useServices } from "../../../services/services-context";
import { useGroup, useGroupMembers } from "../../groups/queries/use-group-queries";
import {
  initialRoundScreenState,
  roundScreenReducer,
  type RoundScreenAction,
  type RoundScreenState,
} from "../model/round-screen.reducer";
import { roundListText } from "../model/round-list-text";
import { respondAttendanceMutation, setMemberAttendanceMutation } from "../queries/round-mutations";
import { useRound } from "../queries/use-round-queries";

/** How long "Lista copiada." (or its failure) stays under the button. */
export const COPY_NOTE_MS = 4_000;

export interface RoundListInput {
  readonly groupName: string;
  readonly round: Round;
  readonly members: readonly Member[];
  readonly waitlistEnabled: boolean;
}

export interface RoundScreenModel {
  readonly group: ReturnType<typeof useGroup>;
  readonly round: ReturnType<typeof useRound>;
  readonly members: ReturnType<typeof useGroupMembers>;
  readonly state: RoundScreenState;
  readonly dispatch: (action: RoundScreenAction) => void;
  /** The wall clock of this render, for the window of the drop-ins and "já começou". */
  readonly now: number;
  /** The answer of who looks (screen 26). */
  readonly respond: (response: AttendanceResponse) => void;
  readonly responding: boolean;
  /** "Tirar" of the list (screen 06, question 47). */
  readonly removeMember: (memberId: string) => void;
  readonly removing: boolean;
  /** The text of the last refused answer or removal, `null` when the last one went through. */
  readonly errorText: string | null;
  /** Puts the list on the clipboard: the only way the names get there (ADR 0054). */
  readonly copyList: (list: RoundListInput) => void;
}

/** The queries, the sheets and the presence calls of screens 06 and 26; the screens only draw. */
export function useRoundScreen(groupId: string, roundId: string): RoundScreenModel {
  const { sacouApi, clipboard } = useServices();
  const client = useQueryClient();
  const group = useGroup(groupId);
  const round = useRound(groupId, roundId);
  const members = useGroupMembers(groupId);
  const [state, dispatch] = useReducer(roundScreenReducer, initialRoundScreenState);
  const respond = useMutation(respondAttendanceMutation(sacouApi, client, groupId, roundId));
  const remove = useMutation(setMemberAttendanceMutation(sacouApi, client, groupId, roundId));
  const failure = respond.error ?? remove.error;
  return {
    group,
    round,
    members,
    state,
    dispatch,
    now: wallClockNow(),
    respond: (response) => {
      dispatch({ type: "sheet-closed" });
      if (!respond.isPending) respond.mutate(response);
    },
    responding: respond.isPending,
    removeMember: (memberId) => {
      dispatch({ type: "sheet-closed" });
      remove.mutate({ memberId, response: "notGoing" });
    },
    removing: remove.isPending,
    errorText: failure === null ? null : errorTextOf(failure),
    copyList: (list) => {
      const text = roundListText(list.groupName, list.round, list.members, list.waitlistEnabled);
      const clearLater = () => {
        setTimeout(() => {
          dispatch({ type: "copy-note-cleared" });
        }, COPY_NOTE_MS);
      };
      void clipboard.setText(text).then(
        () => {
          dispatch({ type: "list-copied" });
          clearLater();
        },
        () => {
          dispatch({ type: "copy-failed" });
          clearLater();
        },
      );
    },
  };
}
