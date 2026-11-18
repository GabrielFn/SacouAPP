import type { TeamSide } from "@sacou/match-engine";
import { ok } from "@sacou/volley-rules";

import type { PlayCommand } from "../../court/session/command-drafts";
import type { CommandResult } from "../../court/session/court-session-controller";
import { LINEUP_SIDES } from "./lineup-source";
import type { LineupDraft } from "./lineup-moves";
import { toAllocation } from "./to-allocation";

export type LineupDispatch = (command: PlayCommand) => Promise<CommandResult>;

export type MatchDrafts = Readonly<Partial<Record<TeamSide, LineupDraft>>>;

/**
 * "Salvar escalação" in a match: one `LineupChanged` per changed team, in tab order, each through the
 * engine on the log of the moment (D7). The first refusal stops the rest and is what the screen says.
 */
export function saveMatchLineups(
  dispatch: LineupDispatch,
  drafts: MatchDrafts,
): Promise<CommandResult> {
  return LINEUP_SIDES.reduce<Promise<CommandResult>>(
    (previous, team) =>
      previous.then((result) => {
        const draft = drafts[team];
        return !result.ok || draft === undefined
          ? result
          : dispatch({ type: "change-lineup", team, allocation: toAllocation(draft) });
      }),
    Promise.resolve(ok(undefined)),
  );
}
