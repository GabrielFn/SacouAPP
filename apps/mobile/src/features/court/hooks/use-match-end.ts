import {
  defaultGroupSettings,
  type CourtSessionTimeline,
  type FinishedMatch,
  type GroupSettings,
  type MemberId,
  type TeamSide,
} from "@sacou/match-engine";
import { useEffect, useMemo, useReducer } from "react";

import type { Shuffler } from "../../../services/random/shuffler";
import { useServices } from "../../../services/services-context";
import type { PositionOf } from "../../draw/model/default-lineup";
import { stateOfTimeline } from "../model/court-screen.selectors";
import { refusalText } from "../model/refusal-text";
import {
  INITIAL_MATCH_END,
  matchEndReducer,
  type MatchEndState,
} from "../next-match/match-end.reducer";
import type { ArrivalEntry } from "../next-match/next-match-input";
import { nextMatchModel, type NextMatchModel } from "../next-match/next-match-model";
import { startNextMatch } from "../next-match/start-next-match";
import type { CourtSessionOrigin } from "../ports/court-event-log";
import type { CourtRoundSource } from "../ports/court-round-source";
import type { NextMatchDraft, NextMatchDraftStore } from "../ports/next-match-draft-store";
import type { PlayCommand } from "../session/command-drafts";
import type { CommandResult } from "../session/court-session-controller";
import { useCourtRuntime } from "./court-runtime-context";

/** The sample sessions have no round: the defaults of the catalog stand in (D7). */
const DEFAULT_SETTINGS = defaultGroupSettings();
const NO_POSITION: PositionOf = () => null;
const ROUND_UNAVAILABLE = "round-unavailable";

export interface MatchEndScreen {
  readonly state: MatchEndState;
  readonly model: NextMatchModel;
  readonly settings: GroupSettings;
  /** The session has a round the phone does not have: no plan, the screen points to the round. */
  readonly roundUnavailable: boolean;
  readonly toggle: (side: TeamSide, memberId: MemberId, required: number) => void;
  readonly start: () => void;
}

export interface RoundOfSession {
  readonly settings: GroupSettings;
  readonly confirmed: readonly ArrivalEntry[];
  readonly positionOf: PositionOf;
}

function finishedOf(timeline: CourtSessionTimeline): FinishedMatch | null {
  const state = stateOfTimeline(timeline);
  return state.currentMatch === null ? (state.finishedMatches.at(-1) ?? null) : null;
}

/**
 * The round of the session from the phone. A sample session (no origin) plays by the defaults; a
 * session with an origin whose round is not on the phone has no plan: `null`, never the defaults.
 */
export function roundOf(
  source: CourtRoundSource,
  origin: CourtSessionOrigin | null,
): RoundOfSession | null {
  if (origin === null) {
    return { settings: DEFAULT_SETTINGS, confirmed: [], positionOf: NO_POSITION };
  }
  const round = source.read(origin);
  return round.settings === null
    ? null
    : { settings: round.settings, confirmed: round.confirmed, positionOf: round.positionOf };
}

/** The draft kept for the finished match, or a new one saved before it is shown (once per match). */
export async function loadOrCreateDraft(
  drafts: NextMatchDraftStore,
  shuffler: Shuffler,
  finished: FinishedMatch,
): Promise<NextMatchDraft> {
  const stored = await drafts.load(finished.matchId);
  if (stored !== null) return stored;
  const fresh: NextMatchDraft = {
    drawOrder: {
      a: shuffler.shuffle(finished.teams.a.memberIds),
      b: shuffler.shuffle(finished.teams.b.memberIds),
    },
    chosen: { a: [], b: [] },
  };
  await drafts.save(finished.matchId, fresh).catch(() => undefined);
  return fresh;
}

/**
 * Screen 11 (D6, D7): reads the origin of the session and the draft of the finished match once (a
 * new draft shuffles both teams for the criterion `draw`, once per match), keeps the draft persisted
 * as the picks change, and starts the next match.
 */
export function useMatchEnd(
  courtSessionId: string,
  timeline: CourtSessionTimeline | null,
  dispatch: (command: PlayCommand) => Promise<CommandResult>,
): MatchEndScreen {
  const services = useServices();
  const { courtRoster, nextMatchDrafts, shuffler, courtRounds } = services;
  const runtime = useCourtRuntime();
  const [state, send] = useReducer(matchEndReducer, INITIAL_MATCH_END);
  const finished = useMemo(() => (timeline === null ? null : finishedOf(timeline)), [timeline]);
  const matchId = finished?.matchId ?? null;

  useEffect(() => {
    if (finished === null) return;
    const alive = { current: true };
    void Promise.all([
      runtime.log.findOrigin(courtSessionId),
      loadOrCreateDraft(nextMatchDrafts, shuffler, finished),
    ]).then(([origin, draft]) => {
      if (!alive.current) return;
      send({ type: "loaded", origin: origin.ok ? origin.value : null, draft });
    });
    return () => {
      alive.current = false;
    };
  }, [finished, courtSessionId, runtime, nextMatchDrafts, shuffler]);

  const origin = state.status === "ready" ? state.origin : null;
  const round = useMemo(() => roundOf(courtRounds, origin), [courtRounds, origin]);
  const draft = state.status === "ready" ? state.draft : null;

  // The draft on the phone follows the picks of the screen, so closing the app keeps them
  // (pendência 22).
  useEffect(() => {
    if (matchId !== null && draft !== null) {
      void nextMatchDrafts.save(matchId, draft).catch(() => undefined);
    }
  }, [matchId, draft, nextMatchDrafts]);
  const model = useMemo<NextMatchModel>(() => {
    if (timeline === null || draft === null) return { kind: "none" };
    if (round === null) {
      return finished === null
        ? { kind: "none" }
        : { kind: "refused", match: finished, code: ROUND_UNAVAILABLE };
    }
    return nextMatchModel({
      state: stateOfTimeline(timeline),
      settings: round.settings,
      confirmed: round.confirmed,
      draft,
      roster: courtRoster,
    });
  }, [timeline, draft, round, finished, courtRoster]);

  return {
    state,
    model,
    settings: round?.settings ?? DEFAULT_SETTINGS,
    roundUnavailable: round === null,
    toggle: (side, memberId, required) => {
      send({ type: "member-toggled", side, memberId, required });
    },
    start: () => {
      if (
        round === null ||
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
          positionOf: round.positionOf,
        },
      ).then((result) => {
        if (!result.ok) send({ type: "start-failed", text: refusalText(result.error) });
      });
    },
  };
}
