import type { GroupSettings } from "@sacou/match-engine";
import type { Result } from "@sacou/volley-rules";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import type { Member } from "../../../services/api/sacou-api";
import { wallClockNow } from "../../../services/api/wall-clock";
import { useServices } from "../../../services/services-context";
import { useCourtRuntime } from "../../court/hooks/court-runtime-context";
import { courtHref, takeOverHref } from "../../court/navigation";
import { useCourtSummaryLookup } from "../../court/hooks/use-court-summary-lookup";
import { useOnline } from "../../../services/api/use-online";
import { useRoundCourt, type RoundCourtRead } from "../../court/hooks/use-round-court";
import {
  useOtherRoundCourt,
  type OtherRoundCourtRead,
} from "../../court/hooks/use-other-round-court";
import type { RoundEndLookup } from "../../court/ports/round-end-lookup";
import type { DrawArrangement } from "../model/draw-arrangement";
import type { DrawFlowAction, DrawFlowState } from "../model/draw-flow.reducer";
import { positionsOf } from "../model/default-lineup";
import type { MatchStartInput } from "../model/match-start";
import { otherCourtView, type OtherCourtView } from "../model/other-court-view";
import {
  startFromDraw,
  startOrTakeOver,
  type CourtOpening,
  type StartFromDrawError,
} from "../session/start-from-draw";

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
  /** A match open in another round on this phone, and what the 08 does about it (R97, D2, D5). */
  readonly otherCourt: OtherCourtView;
  /** Still reading the log for that match: the start waits. */
  readonly readingOther: boolean;
  readonly starting: boolean;
  /** Why the last "Começar partida" did not start, `null` otherwise. */
  readonly startError: StartFromDrawError | null;
  /** "Sortear": the coin decides who serves first (D10). */
  readonly flip: () => void;
  /** "Começar partida": with a forgotten match it opens the sheet "Encerrar a partida antiga?" first. */
  readonly start: () => void;
  /** "Abrir a partida aberta" (R97, D2). */
  readonly openOther: () => void;
  /** "Encerrar e começar" of the sheet (R97, D5). */
  readonly confirmCloseOther: () => void;
  readonly cancelCloseOther: () => void;
}

interface StartVariables {
  readonly input: MatchStartInput;
  /** The forgotten match to end before starting, confirmed on the sheet, or `null`. */
  readonly closeFirst: string | null;
}

function otherOf(read: OtherRoundCourtRead, rounds: RoundEndLookup): OtherCourtView {
  if (read.status === "reading" || read.court === null) return { kind: "none" };
  const now = wallClockNow();
  const origin = read.court.origin;
  return otherCourtView(
    read.court,
    origin === null ? { kind: "unknown" } : rounds.endOf(origin, now),
    now,
  );
}

/**
 * Sheet 08 (D6, D7). Its choices live in the flow of screen 07; the start runs as a local mutation (no
 * network: `networkMode: "always"`), so its status is not a flag of the screen, and its answer holds
 * only a route or a code. On success the court replaces the draw, so "Voltar" never returns to it.
 */
export function usePreGame(deps: PreGameDeps): PreGameModel {
  const { coinFlip, roundEnds } = useServices();
  const runtime = useCourtRuntime();
  const router = useRouter();
  const court = useRoundCourt(deps.roundId);
  const otherRead = useOtherRoundCourt(deps.roundId);
  const otherCourt = otherOf(otherRead, roundEnds);
  const online = useOnline();
  const origin = { groupId: deps.groupId, roundId: deps.roundId };
  // Read only on the tap: the summary decides between the court and the 09a (E4.11, D5).
  const summary = useCourtSummaryLookup(origin, false);
  const input: MatchStartInput = {
    arrangement: deps.arrangement,
    settings: deps.settings,
    positionOf: positionsOf(deps.members),
    preGame: deps.state.preGame,
  };
  const start = useMutation({
    mutationFn: ({
      input: variables,
      closeFirst,
    }: StartVariables): Promise<Result<CourtOpening, StartFromDrawError>> =>
      startOrTakeOver({
        lookUp: () => (online ? summary.refresh() : Promise.resolve(undefined)),
        local: court.status === "read" ? court.court : null,
        start: () => startFromDraw(runtime, origin, variables, closeFirst),
      }),
    networkMode: "always",
    gcTime: 0,
    scope: { id: `court-start:${deps.roundId}` },
    onSuccess: (result) => {
      if (!result.ok) return;
      if (result.value.kind === "court") {
        router.replace(courtHref("court", { courtSessionId: result.value.courtSessionId }));
      } else {
        router.push(takeOverHref(origin));
      }
    },
  });
  const answer = start.data;
  const run = (closeFirst: string | null) => {
    if (!start.isPending) start.mutate({ input, closeFirst });
  };
  return {
    input,
    court,
    otherCourt,
    readingOther: otherRead.status === "reading",
    starting: start.isPending,
    startError:
      answer?.ok === false ? answer.error : start.error === null ? null : ("failed" as const),
    flip: () => {
      deps.dispatch({ type: "first-server-chosen", side: coinFlip.flip() });
    },
    start: () => {
      if (otherCourt.kind === "forgotten") deps.dispatch({ type: "close-other-asked" });
      else run(null);
    },
    openOther: () => {
      if (otherCourt.kind === "open") {
        router.push(courtHref("court", { courtSessionId: otherCourt.courtSessionId }));
      }
    },
    confirmCloseOther: () => {
      deps.dispatch({ type: "close-other-dismissed" });
      if (otherCourt.kind === "forgotten") run(otherCourt.courtSessionId);
    },
    cancelCloseOther: () => {
      deps.dispatch({ type: "close-other-dismissed" });
    },
  };
}
