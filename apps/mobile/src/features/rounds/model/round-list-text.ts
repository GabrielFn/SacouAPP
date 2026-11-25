import type { Member, Round } from "../../../services/api/sacou-api";
import { roundsStrings } from "../../../strings/rounds.pt-BR";
import { roundSubtitle } from "./round-detail";
import { rosterOf, type RosterEntry } from "./roster";

const { copyList, detail } = roundsStrings;
const LINE_BREAK = "\n";

function numbered(roster: readonly RosterEntry[]): readonly string[] {
  return [...roster]
    .sort((first, second) => first.position - second.position)
    .map((entry, index) => copyList.line(index + 1, entry.name ?? detail.noName));
}

function confirmedHeading(round: Round): string {
  return round.capacity === null
    ? copyList.confirmed(String(round.goingCount))
    : copyList.confirmed(detail.confirmedOf(round.goingCount, round.capacity));
}

/**
 * The text of "Copiar lista" (screen 06): the round, the numbered confirmed and the waitlist. Only
 * nicknames: no ID, no position in the group, no level nor phone. It reaches the clipboard only on the
 * tap, because other apps can read it (ADR 0054).
 */
export function roundListText(
  groupName: string,
  round: Round,
  members: readonly Member[],
  waitlistEnabled: boolean,
  /** The link of the round (only the manager has it, while the round is open); `null` leaves it out. */
  link: string | null = null,
): string {
  const going = numbered(rosterOf(round.going, members));
  const waitlist = waitlistEnabled ? numbered(rosterOf(round.waitlist, members)) : [];
  const head = [copyList.header(groupName, roundSubtitle(round)), "", confirmedHeading(round)];
  const body = going.length === 0 ? [copyList.nobody] : going;
  const tail = waitlist.length === 0 ? [] : ["", copyList.waitlist, ...waitlist];
  const linkLines = link === null ? [] : ["", copyList.confirmHere(link)];
  return [...head, ...body, ...tail, ...linkLines].join(LINE_BREAK);
}
