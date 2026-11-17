import type { Member, Round } from "../../../services/api/sacou-api";
import { roundsStrings } from "../../../strings/rounds.pt-BR";
import { addableMembers, type AddableRow } from "./addable-members";
import { capacityHint, type CapacityHint } from "./capacity-hint";
import { presenceCard, type PresenceCardView } from "./presence-card";
import { confirmedAmount, isCanceled, type RoundSettingsView } from "./round-detail";
import { rosterOf, waitlistLine, type RosterEntry } from "./roster";

/** The names of a round, derived on each render from the round and the member list (rule 1). */
export interface RosterView {
  readonly waitlistEnabled: boolean;
  readonly going: readonly RosterEntry[];
  /** Empty with the waitlist off. */
  readonly waitlistRoster: readonly RosterEntry[];
  /** "1º Clara · 2º Igor", empty without a waitlist. */
  readonly waitlist: string;
}

export function rosterView(
  round: Round,
  settings: RoundSettingsView | null,
  members: readonly Member[],
): RosterView {
  const waitlistEnabled = settings?.values.attendance.waitlistEnabled ?? false;
  const waitlistRoster = waitlistEnabled ? rosterOf(round.waitlist, members) : [];
  return {
    waitlistEnabled,
    going: rosterOf(round.going, members),
    waitlistRoster,
    waitlist: waitlistLine(waitlistRoster),
  };
}

/** "Copiar lista" shows with the attendance on and the round not canceled. */
export function canCopyList(round: Round, settings: RoundSettingsView | null): boolean {
  return settings?.values.attendance.enabled === true && !isCanceled(round);
}

/** The name in "{nome} sai da lista.": "Você" for oneself, "Sem apelido" without a nickname. */
export function removalName(going: readonly RosterEntry[], memberId: string, meId: string): string {
  if (memberId === meId) return roundsStrings.confirmed.youRow;
  return going.find((entry) => entry.memberId === memberId)?.name ?? roundsStrings.detail.noName;
}

/** The card of screen 26, or `null` with the attendance off or settings that do not parse. */
export function playerPresence(
  round: Round,
  settings: RoundSettingsView | null,
  members: readonly Member[],
  now: number,
): PresenceCardView | null {
  if (settings === null || !settings.values.attendance.enabled) return null;
  const { waitlistRoster } = rosterView(round, settings, members);
  const myType = members.find((member) => member.isMe)?.memberType ?? null;
  return presenceCard({ round, values: settings.values, waitlist: waitlistRoster, myType, now });
}

export interface AddPlayerView {
  readonly rows: readonly AddableRow[];
  readonly hint: CapacityHint | null;
  /** "12/14", for "Racha de terça · 12/14 confirmados". */
  readonly confirmed: string;
  /** What "confirmados" agrees with in the subtitle. */
  readonly confirmedAmount: number;
  /** A full list without waitlist: "Adicionar" is off. */
  readonly blocked: boolean;
}

export function addPlayerView(
  round: Round,
  settings: RoundSettingsView | null,
  members: readonly Member[],
  search: string,
): AddPlayerView {
  const waitlistEnabled = settings?.values.attendance.waitlistEnabled ?? false;
  const hint = capacityHint(round, waitlistEnabled);
  return {
    rows: addableMembers(members, round, search),
    hint,
    confirmed:
      round.capacity === null
        ? roundsStrings.detail.confirmedCount(round.goingCount)
        : roundsStrings.detail.confirmedOf(round.goingCount, round.capacity),
    confirmedAmount: confirmedAmount(round),
    blocked: hint?.canAdd === false,
  };
}
