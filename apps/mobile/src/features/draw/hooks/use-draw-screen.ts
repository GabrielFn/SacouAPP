import type { GroupSettings, MemberId } from "@sacou/match-engine";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useReducer, useRef } from "react";

import type { Member } from "../../../services/api/sacou-api";
import { useOnline } from "../../../services/api/use-online";
import { useServices } from "../../../services/services-context";
import { useGroup, useGroupMembers } from "../../groups/queries/use-group-queries";
import { roundSettingsOf } from "../../rounds/model/round-detail";
import { useRound } from "../../rounds/queries/use-round-queries";
import {
  drawFlowReducer,
  initialDrawFlowState,
  type DrawFlowAction,
  type DrawFlowState,
} from "../model/draw-flow.reducer";
import { drawNamesOf, type DrawNameOf } from "../model/draw-names";
import {
  drawScreenState,
  shouldDrawFirst,
  type DrawScreenInput,
  type DrawScreenState,
} from "../model/draw-screen-state";
import { confirmTeamsBody } from "../model/confirm-teams-body";
import { drawShareText } from "../model/draw-share-text";
import { confirmTeamsMutation } from "../queries/confirm-teams-mutation";
import { drawMutation } from "../queries/draw-mutation";
import { redraw, runDraw, tapPlayer, type DrawActionDeps } from "./draw-actions";

export interface DrawScreenModel {
  readonly group: ReturnType<typeof useGroup>;
  readonly round: ReturnType<typeof useRound>;
  readonly state: DrawFlowState;
  readonly screen: DrawScreenState;
  readonly nameOf: DrawNameOf;
  /** The members of the group, for the positions of the default lineup (D6). */
  readonly members: readonly Member[];
  /** The resolved settings of the round: the base of sheet 08, `null` until they parse. */
  readonly settings: GroupSettings | null;
  readonly online: boolean;
  /** A draw is on its way (the first one or "Sortear de novo"). */
  readonly pending: boolean;
  /** The refusal of the last draw, `null` when it went through. */
  readonly error: unknown;
  /** The last "Confirmar e compartilhar" did not publish the teams (R100, question 182): the flow went on. */
  readonly publishFailed: boolean;
  readonly dispatch: (action: DrawFlowAction) => void;
  readonly tap: (memberId: MemberId) => void;
  /** "Sortear de novo"; with the draw off, "Montar de novo" (back to the order of arrival). */
  readonly redraw: () => void;
  /** "Tentar de novo" of the first draw. */
  readonly retry: () => void;
  /**
   * "Confirmar e compartilhar": publishes the teams to the players (R100, without waiting), the text of the
   * teams to the share sheet, then sheet 08 (D11), shared or not; with the score off in the round there is
   * no court, so the 08 does not open (D6).
   */
  readonly share: () => void;
}

function inputOf(
  queries: Pick<DrawScreenModel, "group" | "round"> & {
    readonly members: ReturnType<typeof useGroupMembers>;
  },
  rest: Omit<DrawScreenInput, "loaded">,
): DrawScreenInput {
  const role = queries.group.data?.role;
  const round = queries.round.data;
  const membersReady = queries.members.data !== undefined || queries.members.error !== null;
  const loaded =
    role === undefined || round === undefined || !membersReady
      ? null
      : { role, round, settings: roundSettingsOf(round)?.values ?? null };
  return { ...rest, loaded };
}

/** The queries, the flow and the draw of screen 07; the screen only draws (frontend.md, rules 1 and 4). */
export function useDrawScreen(groupId: string, roundId: string): DrawScreenModel {
  const { sacouApi, shareSheet } = useServices();
  const client = useQueryClient();
  const group = useGroup(groupId);
  const round = useRound(groupId, roundId);
  const members = useGroupMembers(groupId);
  const online = useOnline();
  const [state, dispatch] = useReducer(drawFlowReducer, initialDrawFlowState);
  const draw = useMutation(drawMutation(sacouApi, client, groupId, roundId));
  const confirmTeams = useMutation(confirmTeamsMutation(sacouApi, client, groupId, roundId));
  const inFlight = useRef(false);
  const askedFirst = useRef(false);
  const input = inputOf(
    { group, round, members },
    { arrangement: state.arrangement, pending: draw.isPending, error: draw.error, online },
  );
  const drawFirst = shouldDrawFirst(input);
  const { mutate } = draw;

  const deps: DrawActionDeps = {
    state,
    round: round.data ?? { going: [] },
    dispatch,
    mutate,
    online,
    claim: () => {
      if (inFlight.current) return false;
      inFlight.current = true;
      return true;
    },
    release: () => {
      inFlight.current = false;
    },
  };

  useEffect(() => {
    // The first draw goes once per opening: a re-render or a refetch of the round never asks again.
    if (!drawFirst || askedFirst.current) return;
    askedFirst.current = true;
    inFlight.current = true;
    mutate(
      {
        body: {},
        deliver: (answer) => {
          dispatch({ type: "drawn", answer });
        },
      },
      {
        onSettled: () => {
          inFlight.current = false;
        },
      },
    );
  }, [drawFirst, mutate]);

  const nameOf = drawNamesOf(members.data ?? []);
  const settings = input.loaded?.settings ?? null;
  const screen = drawScreenState(input);
  const manual = screen.kind === "drawn" && screen.manual;
  const shown = screen.kind === "drawn" ? screen.arrangement : null;
  /** By hand, the teams by arrival are derived until the first edit; from it on the reducer keeps them. */
  const keepBuilt = () => {
    if (manual && state.arrangement === null && shown !== null) {
      dispatch({ type: "teams-built", arrangement: shown });
    }
  };
  return {
    group,
    round,
    state,
    screen,
    nameOf,
    members: members.data ?? [],
    settings,
    online,
    pending: draw.isPending,
    error: draw.error,
    publishFailed: confirmTeams.isError,
    dispatch,
    tap: (memberId) => {
      if (!manual) {
        tapPlayer(deps, memberId);
        return;
      }
      keepBuilt();
      dispatch({ type: "player-tapped", memberId });
    },
    redraw: () => {
      if (manual) dispatch({ type: "teams-reset" });
      else redraw(deps);
    },
    retry: () => {
      runDraw(deps, state);
    },
    share: () => {
      const groupName = group.data?.name;
      if (shown === null || groupName === undefined || round.data === undefined) return;
      if (!deps.claim()) return;
      keepBuilt();
      // Before the sheet, never after (A of R100): closing it without sharing keeps the teams published.
      confirmTeams.mutate(confirmTeamsBody(shown));
      void shareSheet
        .share(drawShareText(groupName, round.data, shown, nameOf))
        .catch(() => undefined)
        .finally(() => {
          deps.release();
          if (settings?.scoring.enabled === true) dispatch({ type: "pre-game-opened" });
        });
    },
  };
}
