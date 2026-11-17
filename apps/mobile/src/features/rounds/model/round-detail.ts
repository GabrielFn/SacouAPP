import { parseGroupSettings, type GroupSettings } from "@sacou/match-engine";

import type { GroupRole, Round } from "../../../services/api/sacou-api";
import { roundsStrings } from "../../../strings/rounds.pt-BR";
import { formatTime } from "../../groups/model/schedule-text";
import type { PendingRoundScreen } from "../navigation";
import { dateSubtitle } from "./round-dates";

const { detail } = roundsStrings;
const MANAGER_ROLES: ReadonlySet<GroupRole> = new Set(["admin", "coAdmin"]);

/** Admin and co-admin see the manager's screen (06); scorekeeper and player see the player's (26). */
export function managesRounds(role: GroupRole): boolean {
  return MANAGER_ROLES.has(role);
}

const ROLE_HEADERS: Readonly<Record<GroupRole, string>> = {
  admin: detail.youAreAdmin,
  coAdmin: detail.youAreCoAdmin,
  scorekeeper: detail.youAreScorekeeper,
  player: detail.youArePlayer,
};

export function roleHeader(role: GroupRole): string {
  return ROLE_HEADERS[role];
}

const FOOTER_ACTIONS: readonly PendingRoundScreen[] = ["court", "draw"];

/** The footer buttons whose destination exists; none for a canceled round. */
export function footerActions(
  pending: readonly PendingRoundScreen[],
  canceled: boolean,
): readonly PendingRoundScreen[] {
  return canceled ? [] : FOOTER_ACTIONS.filter((action) => !pending.includes(action));
}

export interface RoundSettingsView {
  readonly values: GroupSettings;
  readonly sources: Readonly<Record<string, string>>;
}

/** `null` when the resolved document does not pass the parser the server uses: nothing is drawn from it. */
export function roundSettingsOf(round: Round): RoundSettingsView | null {
  const parsed = parseGroupSettings(round.settings.resolved);
  return parsed.ok ? { values: parsed.value, sources: round.settings.sources } : null;
}

/** "Ter 3/11 · 20h30 · Ginásio Sesc". */
export function roundSubtitle(round: Round): string {
  return detail.subtitle(dateSubtitle(round.localDate), formatTime(round.localTime), round.venue);
}

/** The number the noun "confirmado" agrees with: the capacity when counted as "x/y", else the count. */
export function confirmedAmount(round: Pick<Round, "capacity" | "goingCount">): number {
  return round.capacity ?? round.goingCount;
}

export interface StatsCell {
  readonly value: string;
  readonly label: string;
  /** What the label agrees with, for the accessible name of the cell. */
  readonly amount: number;
}

/** The two cells of the dark panel; none with the attendance off, and no money cell (ADR 0046). */
export function statsCells(round: Round, values: GroupSettings): readonly StatsCell[] {
  if (!values.attendance.enabled) return [];
  const confirmed: StatsCell = {
    value:
      round.capacity === null
        ? detail.confirmedCount(round.goingCount)
        : detail.confirmedOf(round.goingCount, round.capacity),
    label: detail.confirmedLabel(confirmedAmount(round)),
    amount: confirmedAmount(round),
  };
  return values.attendance.waitlistEnabled
    ? [confirmed, { value: detail.waitlistCount(round.waitlistCount), label: detail.waitlistLabel, amount: round.waitlistCount }]
    : [confirmed];
}

export function isCanceled(round: Round): boolean {
  return round.status === "canceled";
}
