import {
  defaultGroupSettings,
  type CourtSessionTimeline,
  type FinishedMatch,
  type GroupSettings,
  type MemberId,
  type TeamSide,
} from "@sacou/match-engine";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useReducer } from "react";

import { useServices } from "../../../services/services-context";
import { positionsOf } from "../../draw/hooks/use-pre-game";
import { groupMembersQuery } from "../../groups/queries/group-queries";
import { roundSettingsOf } from "../../rounds/model/round-detail";
import { roundQuery } from "../../rounds/queries/round-queries";
import { stateOfTimeline } from "../model/court-screen.selectors";
import { refusalText } from "../model/refusal-text";
import {
  INITIAL_MATCH_END,
  matchEndReducer,
  type MatchEndState,
} from "../next-match/match-end.reducer";
import { nextMatchModel, type NextMatchModel } from "../next-match/next-match-model";
import { startNextMatch } from "../next-match/start-next-match";
import type { CourtSessionOrigin } from "../ports/court-event-log";
import type { NextMatchDraft } from "../ports/next-match-draft-store";
import type { PlayCommand } from "../session/command-drafts";
import type { CommandResult } from "../session/court-session-controller";
import { useCourtRuntime } from "./court-runtime-context";

/** The sample sessions have no round: the defaults of the catalog stand in (D7). */
const DEFAULT_SETTINGS = defaultGroupSettings();
/** Never fetched: the query of a session without an origin is off. */
const NO_ID = "";

export interface MatchEndScreen {
  readonly state: MatchEndState;
  readonly model: NextMatchModel;
  readonly settings: GroupSettings;
  readonly toggle: (side: TeamSide, memberId: MemberId, required: number) => void;
  readonly start: () => void;
}

function finishedOf(timeline: CourtSessionTimeline): FinishedMatch | null {
  const state = stateOfTimeline(timeline);
  return state.currentMatch === null ? (state.finishedMatches.at(-1) ?? null) : null;
}

/** The round of the session, from the persisted cache, so screen 11 works offline (E4.7 D8). */
function useRoundOf(origin: CourtSessionOrigin | null) {
  const { sacouApi } = useServices();
  const groupId = origin?.groupId ?? NO_ID;
  const round = useQuery({
    ...roundQuery(sacouApi, groupId, origin?.roundId ?? NO_ID),
    enabled: origin !== null,
  });
  const members = useQuery({ ...groupMembersQuery(sacouApi, groupId), enabled: origin !== null });
  const settings =
    round.data === undefined
      ? DEFAULT_SETTINGS
      : (roundSettingsOf(round.data)?.values ?? DEFAULT_SETTINGS);
  return { settings, confirmed: round.data?.going ?? [], members: members.data ?? [] };
}

/**
 * Screen 11 (D6, D7): reads the origin of the session and the draft of the finished match once (a
 * new draft shuffles both teams for the criterion `draw`, once per match), keeps the draft persisted
 * as it changes, and starts the next match.
 */
export function useMatchEnd(
  courtSessionId: string,
  timeline: CourtSessionTimeline | null,
  dispatch: (command: PlayCommand) => Promise<CommandResult>,
): MatchEndScreen {
  const services = useServices();
  const { courtRoster, nextMatchDrafts, shuffler } = services;
  const runtime = useCourtRuntime();
  const [state, send] = useReducer(matchEndReducer, INITIAL_MATCH_END);
  const finished = useMemo(() => (timeline === null ? null : finishedOf(timeline)), [timeline]);
  const matchId = finished?.matchId ?? null;

  useEffect(() => {
    if (finished === null) return;
    let alive = true;
    const fresh = (): NextMatchDraft => ({
      drawOrder: {
        a: shuffler.shuffle(finished.teams.a.memberIds),
        b: shuffler.shuffle(finished.teams.b.memberIds),
      },
      chosen: { a: [], b: [] },
    });
    void Promise.all([
      runtime.log.findOrigin(courtSessionId),
      nextMatchDrafts.load(finished.matchId),
    ]).then(([origin, stored]) => {
      if (!alive) return;
      send({ type: "loaded", origin: origin.ok ? origin.value : null, draft: stored ?? fresh() });
    });
    return () => {
      alive = false;
    };
  }, [finished, courtSessionId, runtime, nextMatchDrafts, shuffler]);

  const origin = state.status === "ready" ? state.origin : null;
  const round = useRoundOf(origin);
  const draft = state.status === "ready" ? state.draft : null;

  // The draft on the phone follows the one of the screen, so closing the app keeps the draw and the
  // picks (pendência 22).
  useEffect(() => {
    if (matchId !== null && draft !== null) {
      void nextMatchDrafts.save(matchId, draft).catch(() => undefined);
    }
  }, [matchId, draft, nextMatchDrafts]);
  const model = useMemo<NextMatchModel>(
    () =>
      timeline === null || draft === null
        ? { kind: "none" }
        : nextMatchModel({
            state: stateOfTimeline(timeline),
            settings: round.settings,
            confirmed: round.confirmed,
            draft,
            roster: courtRoster,
          }),
    [timeline, draft, round.settings, round.confirmed, courtRoster],
  );

  return {
    state,
    model,
    settings: round.settings,
    toggle: (side, memberId, required) => {
      send({ type: "member-toggled", side, memberId, required });
    },
    start: () => {
      if (
        model.kind !== "planned" ||
        !model.canConfirm ||
        state.status !== "ready" ||
        state.starting
      ) {
        return;
      }
      send({ type: "start-requested" });
      void startNextMatch(
        { dispatch, drafts: nextMatchDrafts, ids: runtime.ids, coinFlip: services.coinFlip },
        {
          plan: model.plan,
          finished: model.match,
          settings: round.settings,
          positionOf: positionsOf(round.members),
        },
      ).then((result) => {
        if (!result.ok) send({ type: "start-failed", text: refusalText(result.error) });
      });
    },
  };
}
