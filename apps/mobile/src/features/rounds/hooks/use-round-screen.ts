import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useReducer } from "react";

import { errorTextOf } from "../../../services/api/api-error-text";
import type { AttendanceResponse, Member, Round } from "../../../services/api/sacou-api";
import { wallClockNow } from "../../../services/api/wall-clock";
import { useServices } from "../../../services/services-context";
import { useGroup, useGroupMembers } from "../../groups/queries/use-group-queries";
import { useOfferPushPrompt } from "../../notifications/hooks/push-prompt-context";
import {
  initialRoundScreenState,
  roundScreenReducer,
  type RoundScreenAction,
  type RoundScreenState,
} from "../model/round-screen.reducer";
import { roundListText } from "../model/round-list-text";
import { roundLinkOffer, roundShareText } from "../model/round-link-offer";
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
  /** Opens the share sheet with the round and its link (screen 06, only while the link is on offer). */
  readonly shareLink: (groupName: string, round: Round) => void;
}

/** The queries, the sheets and the presence calls of screens 06 and 26; the screens only draw. */
export function useRoundScreen(groupId: string, roundId: string): RoundScreenModel {
  const { sacouApi, clipboard, shareSheet } = useServices();
  const client = useQueryClient();
  const group = useGroup(groupId);
  const round = useRound(groupId, roundId);
  const members = useGroupMembers(groupId);
  const [state, dispatch] = useReducer(roundScreenReducer, initialRoundScreenState);
  const respond = useMutation(respondAttendanceMutation(sacouApi, client, groupId, roundId));
  const remove = useMutation(setMemberAttendanceMutation(sacouApi, client, groupId, roundId));
  const offerPushPrompt = useOfferPushPrompt();
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
      if (respond.isPending) return;
      // A "VOU" that went through is when the waitlist pushes start to matter (R98, item 9).
      respond.mutate(response, {
        onSuccess: () => {
          if (response === "going") offerPushPrompt();
        },
      });
    },
    responding: respond.isPending,
    removeMember: (memberId) => {
      dispatch({ type: "sheet-closed" });
      remove.mutate({ memberId, response: "notGoing" });
    },
    removing: remove.isPending,
    errorText: failure === null ? null : errorTextOf(failure),
    copyList: (list) => {
      const offer = roundLinkOffer(list.round, wallClockNow());
      const link = offer.kind === "share" ? offer.url : null;
      const text = roundListText(
        list.groupName,
        list.round,
        list.members,
        list.waitlistEnabled,
        link,
      );
      const clearLater = () => {
        setTimeout(() => {
          dispatch({ type: "copy-note-cleared" });
        }, COPY_NOTE_MS);
      };
      void clipboard.setText(text).then(
        () => {
          dispatch({ type: link === null ? "list-copied" : "list-and-link-copied" });
          clearLater();
        },
        () => {
          dispatch({ type: "copy-failed" });
          clearLater();
        },
      );
    },
    shareLink: (groupName, shown) => {
      const offer = roundLinkOffer(shown, wallClockNow());
      if (offer.kind === "none") return;
      // The text carries the link: it is handed to the sheet and never logged (ADR 0070, D3).
      void shareSheet.share(roundShareText(groupName, shown, offer.url)).catch(() => {
        dispatch({ type: "share-failed" });
        setTimeout(() => {
          dispatch({ type: "share-note-cleared" });
        }, COPY_NOTE_MS);
      });
    },
  };
}
