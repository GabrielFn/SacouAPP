import type { RoundSummary } from "../../../services/api/sacou-api";

/** The dates (`YYYY-MM-DD`) that already have a round that was not canceled. */
export function takenRoundDates(rounds: readonly RoundSummary[]): readonly string[] {
  return rounds.filter((round) => round.status === "scheduled").map((round) => round.localDate);
}

/** True when some round that has not started belongs to a weekly series: the group already repeats. */
export function hasUpcomingSeries(rounds: readonly RoundSummary[], now: number): boolean {
  return rounds.some(
    (round) =>
      round.seriesId !== null && round.status === "scheduled" && Date.parse(round.startsAt) > now,
  );
}
