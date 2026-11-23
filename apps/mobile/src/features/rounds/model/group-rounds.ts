import type { RoundSummary } from "../../../services/api/sacou-api";
import { roundsStrings } from "../../../strings/rounds.pt-BR";
import { dateLabel } from "./round-dates";
import { hasEnded, isLive, roundCardModel, type RoundCardModel } from "./round-cards";

const { groupRounds } = roundsStrings;

/** Where a round of the list stands: not started, being played, over, or canceled (R97 part 2, D6). */
export type GroupRoundState = "open" | "live" | "ended" | "canceled";

/** Where touching a round leads: screen 06, or the summary (12) of a round that took place. */
export type GroupRoundTarget = "round" | "summary";

export interface GroupRoundItem {
  readonly card: RoundCardModel;
  readonly state: GroupRoundState;
  /** "Aberta", "Rolando agora", "Encerrada · Ver resumo" or "Cancelada". */
  readonly stateText: string;
  /** "Ter, 3/11 · Aberta": the bold line of the row. */
  readonly rowTitle: string;
  /** What a screen reader says: "Ter, 3/11, Aberta, Ginásio Sesc". */
  readonly rowLabel: string;
  readonly target: GroupRoundTarget;
}

export interface GroupRoundsView {
  readonly upcoming: readonly GroupRoundItem[];
  readonly recent: readonly GroupRoundItem[];
}

export function groupRoundState(round: RoundSummary, now: number): GroupRoundState {
  if (round.status === "canceled") return "canceled";
  if (isLive(round, now)) return "live";
  return hasEnded(round, now) ? "ended" : "open";
}

function stateTextOf(state: GroupRoundState): string {
  return groupRounds.state[state];
}

function itemOf(groupId: string, round: RoundSummary, now: number): GroupRoundItem {
  const state = groupRoundState(round, now);
  const stateText = stateTextOf(state);
  const date = dateLabel(round.localDate);
  return {
    card: roundCardModel(groupId, round, state === "live" ? "live" : "next"),
    state,
    stateText,
    rowTitle: groupRounds.rowTitle(date, stateText),
    rowLabel: groupRounds.rowLabel(date, stateText, round.venue),
    target: state === "ended" ? "summary" : "round",
  };
}

function byStart(first: RoundSummary, second: RoundSummary): number {
  return Date.parse(first.startsAt) - Date.parse(second.startsAt);
}

/**
 * The rounds of a group in two lists: "Próximas" (open, being played now, and canceled ones that have
 * not started), the soonest first; "Recentes" (over, and canceled ones that have started), the newest
 * first. Sorting is stable, so equal starts keep the API order.
 */
export function groupRoundsView(
  groupId: string,
  rounds: readonly RoundSummary[],
  now: number,
): GroupRoundsView {
  const isPast = (round: RoundSummary) => {
    const state = groupRoundState(round, now);
    return state === "ended" || (state === "canceled" && Date.parse(round.startsAt) <= now);
  };
  const toItem = (round: RoundSummary) => itemOf(groupId, round, now);
  return {
    upcoming: rounds
      .filter((round) => !isPast(round))
      .sort(byStart)
      .map(toItem),
    recent: rounds
      .filter(isPast)
      .sort((first, second) => byStart(second, first))
      .map(toItem),
  };
}
