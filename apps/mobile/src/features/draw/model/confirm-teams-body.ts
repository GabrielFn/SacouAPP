import type { ConfirmTeamsBody } from "../../../services/api/sacou-api";
import type { DrawArrangement } from "./draw-arrangement";

/**
 * The body of "Confirmar e compartilhar" (R100, ADR 0078): the teams in order and the queue of reserves, member
 * IDs only. It reads `teams` and `reserves` and never `levels`: the admin's notes stay on screen 07.
 */
export function confirmTeamsBody(
  arrangement: Pick<DrawArrangement, "teams" | "reserves">,
): ConfirmTeamsBody {
  return {
    teams: arrangement.teams.map((team) => [...team]),
    reserves: [...arrangement.reserves],
  };
}
