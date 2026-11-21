import { useRouter } from "expo-router";
import { useCallback, useReducer } from "react";

import { useServices } from "../../../services/services-context";
import { summaryHref } from "../../rounds/navigation";
import { useCourtRuntime } from "../hooks/court-runtime-context";
import { endRoundReducer, INITIAL_END_ROUND, type EndRoundState } from "./end-round.reducer";
import type { CourtSessionOrigin } from "../ports/court-event-log";
import { runEndRound } from "./run-end-round";

export interface EndRoundFlow {
  readonly state: EndRoundState;
  /** With `openMatchScore` ("12 × 10") a match is in play: the user confirms first (question 151). */
  readonly request: (openMatchScore: string | null) => void;
  readonly confirm: () => void;
  readonly cancel: () => void;
}

/**
 * "Encerrar rodada" of screens 11 and 23. The reducer holds the phases; this hook runs the effects
 * (server, log, upload) and then opens the summary with `replace`, so "Voltar" never lands on a closed
 * court. The round of the session comes from its origin in the log, never from a copy.
 */
export function useEndRound(
  courtSessionId: string,
  /** The server marked the end: the routes read the round (its `endsAt`) again; the court slice has no cache. */
  onServerClosed: (round: CourtSessionOrigin) => void,
): EndRoundFlow {
  const router = useRouter();
  const { sacouApi } = useServices();
  const runtime = useCourtRuntime();
  const [state, send] = useReducer(endRoundReducer, INITIAL_END_ROUND);

  const run = useCallback(async () => {
    const origin = await runtime.log.findOrigin(courtSessionId);
    if (!origin.ok || origin.value === null) {
      send({ type: "failed", failure: "storage" });
      return;
    }
    const { groupId, roundId } = origin.value;
    const ended = await runEndRound(
      { log: runtime.log, sync: runtime.sync, api: sacouApi },
      { courtSessionId, groupId, roundId },
      () => {
        onServerClosed({ groupId, roundId });
      },
    );
    if (!ended.ok) {
      send({ type: "failed", failure: ended.error });
      return;
    }
    send({ type: "closed" });
    router.replace(summaryHref(groupId, roundId));
  }, [runtime, sacouApi, onServerClosed, router, courtSessionId]);

  return {
    state,
    request: (openMatchScore) => {
      if (state.phase === "closing" || state.phase === "confirming") return;
      send({ type: "requested", openMatchScore });
      if (openMatchScore === null) void run();
    },
    confirm: () => {
      if (state.phase !== "confirming") return;
      send({ type: "confirmed" });
      void run();
    },
    cancel: () => {
      send({ type: "cancelled" });
    },
  };
}
