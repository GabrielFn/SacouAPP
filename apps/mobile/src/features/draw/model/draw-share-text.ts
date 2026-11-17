import type { Round } from "../../../services/api/sacou-api";
import { drawStrings } from "../../../strings/draw.pt-BR";
import { dateSubtitle } from "../../rounds/model/round-dates";
import type { DrawArrangement } from "./draw-arrangement";
import type { DrawNameOf } from "./draw-names";
import { teamIdentity } from "./team-identity";

const LINE_BREAK = "\n";

/**
 * The text of "Confirmar e compartilhar" (D11, question 71): the group, the day, each team and the queue,
 * with names only. Never a level, a position nor an ID: it leaves the app for WhatsApp.
 */
export function drawShareText(
  groupName: string,
  round: Pick<Round, "localDate">,
  arrangement: DrawArrangement,
  nameOf: DrawNameOf,
): string {
  const { share } = drawStrings;
  const teams = arrangement.teams.map((members, index) =>
    share.team(teamIdentity(index).name, members.map(nameOf)),
  );
  const reserves =
    arrangement.reserves.length === 0 ? [] : [share.reserves(arrangement.reserves.map(nameOf))];
  return [share.heading(groupName, dateSubtitle(round.localDate)), ...teams, ...reserves].join(
    LINE_BREAK,
  );
}
