import type { Member } from "../../../services/api/sacou-api";
import { roundsStrings } from "../../../strings/rounds.pt-BR";

const WAITLIST_NAMES_SHOWN = 3;
const ORDINAL_SUFFIX = "º";

export interface PlaceEntry {
  readonly memberId: string;
  readonly position: number;
}

export interface RosterEntry {
  readonly memberId: string;
  readonly position: number;
  /** `null` when the member has no nickname or left the group. */
  readonly name: string | null;
}

/** The names come from the member list, joined here by `memberId` and never copied into the round. */
export function rosterOf(
  entries: readonly PlaceEntry[],
  members: readonly Member[],
): readonly RosterEntry[] {
  const names = new Map(members.map((member) => [member.memberId, member.nickname]));
  return entries.map((entry) => ({ ...entry, name: names.get(entry.memberId) ?? null }));
}

/** "1º Clara · 2º Igor"; up to three names and "+N"; empty for no waitlist. */
export function waitlistLine(roster: readonly RosterEntry[]): string {
  const shown = roster
    .slice(0, WAITLIST_NAMES_SHOWN)
    .map(
      (entry) =>
        `${String(entry.position)}${ORDINAL_SUFFIX} ${entry.name ?? roundsStrings.detail.noName}`,
    );
  const rest = roster.length - WAITLIST_NAMES_SHOWN;
  const line = shown.join(" · ");
  return rest > 0 ? `${line} +${String(rest)}` : line;
}
