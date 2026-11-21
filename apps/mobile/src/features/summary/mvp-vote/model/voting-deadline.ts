import { mvpVoteStrings } from "../../../../strings/mvp-vote.pt-BR";

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const MS_PER_HOUR = MS_PER_MINUTE * MINUTES_PER_HOUR;
const MIN_MINUTES = 1;
const TIME_DIGITS = 2;

/**
 * "23 h" from 1 h on, whole hours down; under 1 h, whole minutes down with 1 at least (question 176):
 * it never promises more time than there is. The phone clock may be wrong: the server decides.
 */
export function remainingText(untilMs: number, nowMs: number): string {
  const left = Math.max(0, untilMs - nowMs);
  if (left >= MS_PER_HOUR) return mvpVoteStrings.hours(Math.floor(left / MS_PER_HOUR));
  return mvpVoteStrings.minutes(Math.max(MIN_MINUTES, Math.floor(left / MS_PER_MINUTE)));
}

/** "02h30": the hour and minute of an instant in the time zone of the phone. */
export function localTimeText(instant: Date): string {
  const pad = (value: number) => String(value).padStart(TIME_DIGITS, "0");
  return `${pad(instant.getHours())}h${pad(instant.getMinutes())}`;
}
