import type { GroupSettings } from "@sacou/match-engine";
import type { Result } from "@sacou/volley-rules";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import type { Member } from "../../../services/api/sacou-api";
import { useServices } from "../../../services/services-context";
import { useCourtRuntime } from "../../court/hooks/court-runtime-context";
import { courtHref } from "../../court/navigation";
import { useRoundCourt, type RoundCourtRead } from "../../court/hooks/use-round-court";
import type { DrawArrangement } from "../model/draw-arrangement";
import type { DrawFlowAction, DrawFlowState } from "../model/draw-flow.reducer";
import type { PositionOf } from "../model/default-lineup";
import type { MatchStartInput } from "../model/match-start";
import { startFromDraw, type StartFromDrawError } from "../session/start-from-draw";

export interface PreGameDeps {
  readonly groupId: string;
  readonly roundId: string;
  readonly state: DrawFlowState;
  readonly dispatch: (action: DrawFlowAction) => void;
  readonly arrangement: DrawArrangement;
  readonly settings: GroupSettings;
  readonly members: readonly Member[];
}

export interface PreGameModel {
  /** Base, choices, teams and positions: what every selector of the 08 reads. */
  readonly input: MatchStartInput;
  readonly court: RoundCourtRead;
  readonly starting: boolean;
  /** Why the last "Começar partida" did not start, `null` otherwise. */
  readonly startError: StartFromDrawError | null;
  /** "Sortear": the coin decides who serves first (D10). */
  readonly flip: () => void;
  readonly start: () => void;
}

/** The position of each member, from the members query: joined here, never copied (D2). */
export function positionsOf(members: readonly Member[]): PositionOf {
  const positions = new Map(members.map((member) => [member.memberId, member.primaryPosition]));
  return (memberId) => positions.get(memberId) ?? null;
}

/**
 * Sheet 08 (D6, D7). Its choices live in the flow of screen 07; the start runs as a local mutation (no
 * network: `networkMode: "always"`), so its status is not a flag of the screen, and its answer holds
 * only a route or a code. On success the court replaces the draw, so "Voltar" never returns to it.
 */
export function usePreGame(deps: PreGameDeps): PreGameModel {
  const { coinFlip } = useServices();
  const runtime = useCourtRuntime();
  const router = useRouter();
  const court = useRoundCourt(deps.roundId);
  const input: MatchStartInput = {
    arrangement: deps.arrangement,
    settings: deps.settings,
    positionOf: positionsOf(deps.members),
    preGame: deps.state.preGame,
  };
  const start = useMutation({
    mutationFn: (variables: MatchStartInput): Promise<Result<string, StartFromDrawError>> =>
      startFromDraw(runtime, { groupId: deps.groupId, roundId: deps.roundId }, variables),
    networkMode: "always",
    gcTime: 0,
    scope: { id: `court-start:${deps.roundId}` },
    onSuccess: (result) => {
      if (result.ok)
        router.replace(courtHref("court", { courtSessionId: result.value }));
    },
  });
  const answer = start.data;
  return {
    input,
    court,
    starting: start.isPending,
    startError:
      answer?.ok === false ? answer.error : start.error === null ? null : ("failed" as const),
    flip: () => {
      deps.dispatch({ type: "first-server-chosen", side: coinFlip.flip() });
    },
    start: () => {
      if (!start.isPending) start.mutate(input);
    },
  };
}
