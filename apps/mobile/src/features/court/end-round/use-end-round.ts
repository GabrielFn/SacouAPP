import { useRouter } from "expo-router";
import { useCallback, useReducer } from "react";

import { wallClockNow } from "../../../services/api/wall-clock";
import { useServices } from "../../../services/services-context";
import { summaryHref } from "../../rounds/navigation";
import { useCourtRuntime } from "../hooks/court-runtime-context";
import { endRoundAvailability } from "./end-round-availability";
import {
  endRoundReducer,
  INITIAL_END_ROUND,
  type EndRoundRequest,
  type EndRoundState,
} from "./end-round.reducer";
import type { CourtSessionOrigin } from "../ports/court-event-log";
import { runEndRound } from "./run-end-round";

/** What the screen knows of the court when the user asks; the voting switch the hook reads itself. */
export type EndRoundAbout = Pick<EndRoundRequest, "openMatchScore" | "finishedMatches">;

/** What the hook reads of the round on the phone; without it the server decides. */
interface RoundFacts {
  readonly votingEnabled: boolean;
  readonly startsAt: string | null;
}

const NO_ROUND_FACTS: RoundFacts = { votingEnabled: false, startsAt: null };

export interface EndRoundFlow {
  readonly state: EndRoundState;
  /** Always opens the confirmation (R101): only `confirm` closes the round. */
  readonly request: (about: EndRoundAbout) => void;
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
  const { sacouApi, courtRounds } = useServices();
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

  /** The MVP voting opens with the end of the round; without the round on the phone the sentence is left out. */
  const roundFactsOf = useCallback(async (): Promise<RoundFacts> => {
    const origin = await runtime.log.findOrigin(courtSessionId);
    if (!origin.ok || origin.value === null) return NO_ROUND_FACTS;
    const round = courtRounds.read(origin.value);
    return { votingEnabled: round.settings?.mvp.voting ?? false, startsAt: round.startsAt };
  }, [runtime, courtRounds, courtSessionId]);

  return {
    state,
    request: (about) => {
      if (state.phase === "closing" || state.phase === "confirming") return;
      void roundFactsOf()
        .catch(() => NO_ROUND_FACTS)
        .then(({ votingEnabled, startsAt }) => {
          const availability = endRoundAvailability({
            startsAt,
            nowMs: wallClockNow(),
            finishedMatches: about.finishedMatches,
          });
          send({ type: "requested", ...about, votingEnabled, availability });
        });
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
