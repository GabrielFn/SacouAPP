import type { CoinFlip } from "../../../services/random/coin-flip";
import type { IdGenerator } from "../../../services/id/id-generator";
import type { NextMatchDraftStore } from "../ports/next-match-draft-store";
import type { PlayCommand } from "../session/command-drafts";
import type { CommandResult } from "../session/court-session-controller";
import { buildNextMatchStart, type NextMatchStartInput } from "./next-match-start";

export interface StartNextMatchDeps {
  readonly dispatch: (command: PlayCommand) => Promise<CommandResult>;
  readonly drafts: NextMatchDraftStore;
  readonly ids: IdGenerator;
  readonly coinFlip: CoinFlip;
}

/**
 * "Confirmar e ir para a próxima partida": a new `matchId`, the coin for who serves first (question
 * 81: "Trocar sacador" at 0–0 corrects it), the `MatchStarted` of the plan, and the draft of the
 * finished match is forgotten once the new match is stored.
 */
export async function startNextMatch(
  deps: StartNextMatchDeps,
  input: Omit<NextMatchStartInput, "matchId" | "firstServer">,
): Promise<CommandResult> {
  const payload = buildNextMatchStart({
    ...input,
    matchId: deps.ids.newId(),
    firstServer: deps.coinFlip.flip(),
  });
  const result = await deps.dispatch({ type: "start-next-match", input: payload });
  if (result.ok) {
    await deps.drafts.clear(input.finished.matchId).catch(() => undefined);
  }
  return result;
}
