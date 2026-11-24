import { parseGroupSettings, type GroupSettings } from "@sacou/match-engine";

import type { GroupRole, Round } from "../../../services/api/sacou-api";
import { roundsStrings } from "../../../strings/rounds.pt-BR";
import { formatTime } from "../../groups/model/schedule-text";
import type { PendingRoundScreen } from "../navigation";
import { dateSubtitle } from "./round-dates";
import { hasEnded } from "./round-cards";
import { dropInOpensPhrase } from "./round-clock";

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

/** The court only with a session of this round on the device; the draw only for who draws (D1). */
export function roundFooterActions(
  available: readonly PendingRoundScreen[],
  drawAllowed: boolean,
  hasCourt: boolean,
): readonly PendingRoundScreen[] {
  return available.filter((action) => (action === "court" ? hasCourt : drawAllowed));
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
    ? [
        confirmed,
        {
          value: detail.waitlistCount(round.waitlistCount),
          label: detail.waitlistLabel,
          amount: round.waitlistCount,
        },
      ]
    : [confirmed];
}

export function isCanceled(round: Round): boolean {
  return round.status === "canceled";
}

/** Whether the round is over (`endsAt` passed, an early close included); a canceled one never (R99). */
export function isEnded(round: Round, now: number): boolean {
  return hasEnded(round, now);
}

/** What the admin screen (06) offers for a round: all of it only while the round is open (R99). */
export interface AdminRoundOffers {
  readonly canAdd: boolean;
  readonly canRemove: boolean;
  readonly courtEntryEnabled: boolean;
}

export function adminRoundOffers(
  round: Round,
  now: number,
  attendanceEnabled: boolean,
): AdminRoundOffers {
  const open = !isCanceled(round) && !isEnded(round, now);
  return { canAdd: attendanceEnabled && open, canRemove: open, courtEntryEnabled: open };
}

/** The line of screen 06 about the window of the drop-ins, or `null` when there is none to tell. */
export interface AdminDropInWindow {
  readonly phrase: string;
}

/**
 * "A lista dos avulsos abre amanhã, às 20h." for the admin of an open round, until the window opens;
 * nothing with the window off (`dropInOpensAt` null), once it is open, or after the round started, ended
 * or was canceled.
 */
export function adminDropInWindow(round: Round, now: number): AdminDropInWindow | null {
  const opensAt = round.dropInOpensAt;
  const open = !isCanceled(round) && !isEnded(round, now) && Date.parse(round.startsAt) > now;
  if (opensAt === null || !open || Date.parse(opensAt) <= now) return null;
  return { phrase: dropInOpensPhrase(round, opensAt, now) };
}

/**
 * The entry to the summary (screen 12) from the round: after it started or ended, never for a canceled
 * one (question 152). A round closed before its start has ended, so it has a summary too (R99).
 */
export function summaryAvailable(round: Round, now: number): boolean {
  return !isCanceled(round) && (Date.parse(round.startsAt) <= now || isEnded(round, now));
}
