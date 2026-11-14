import type { RoundSummary } from "../../../services/api/sacou-api";

/** True when some round that has not started belongs to a weekly series: the group already repeats. */
export function hasUpcomingSeries(rounds: readonly RoundSummary[], now: number): boolean {
  return rounds.some(
    (round) =>
      round.seriesId !== null && round.status === "scheduled" && Date.parse(round.startsAt) > now,
  );
}
