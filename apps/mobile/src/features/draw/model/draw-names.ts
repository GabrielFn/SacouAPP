import type { MemberId } from "@sacou/match-engine";

import type { Member } from "../../../services/api/sacou-api";
import { drawStrings } from "../../../strings/draw.pt-BR";
import { displayNamesOf } from "../../../ui/display-names";

/** How a member of the draw is called: the short name of the court, "Sem apelido" without one. */
export type DrawNameOf = (memberId: MemberId) => string;

/**
 * The names come from the members query, joined here and never copied (D2): the first name, with the
 * start of the second when two share it (`decisoes.md`). Who has no nickname, or is not in the list
 * yet, is "Sem apelido".
 */
export function drawNamesOf(members: readonly Member[]): DrawNameOf {
  const named = members.flatMap((member) =>
    member.nickname === null || member.nickname.trim() === ""
      ? []
      : [{ memberId: member.memberId, name: member.nickname }],
  );
  const names = displayNamesOf(named);
  return (memberId) => names.get(memberId) ?? drawStrings.noName;
}
