import { roundsStrings } from "../../../strings/rounds.pt-BR";
import { formatTime } from "../../groups/model/schedule-text";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const HOUR_MINUTE = /^(\d{2}):(\d{2})$/;
const MONTH_OFFSET = 1;
const PAD_WIDTH = 2;
const SUNDAY_JS = 0;
const SUNDAY_ISO = 7;

export interface RoundClockInput {
  readonly localDate: string;
  readonly localTime: string;
  readonly startsAt: string;
}

/** The wall time of the round read as if it were UTC, so the offset of its zone comes out of `startsAt`. */
function localAsUtc(localDate: string, localTime: string): number | null {
  const date = ISO_DATE.exec(localDate);
  const time = HOUR_MINUTE.exec(localTime);
  if (date === null || time === null) return null;
  const [, year = "", month = "", day = ""] = date;
  const [, hours = "", minutes = ""] = time;
  return Date.UTC(
    Number(year),
    Number(month) - MONTH_OFFSET,
    Number(day),
    Number(hours),
    Number(minutes),
  );
}

/**
 * The wall time, in the zone of the round, of an instant near the round, read with the `getUTC*` methods.
 * The offset is the one of the round itself, so the phone needs no time zone table (ADR 0054); a change
 * of offset between the two instants (daylight saving) is out of the zones of the pilot.
 */
export function localWallTime(round: RoundClockInput, instant: string): Date | null {
  const local = localAsUtc(round.localDate, round.localTime);
  const starts = Date.parse(round.startsAt);
  const at = Date.parse(instant);
  if (local === null || Number.isNaN(starts) || Number.isNaN(at)) return null;
  return new Date(at + (local - starts));
}

const two = (value: number) => String(value).padStart(PAD_WIDTH, "0");

const MS_PER_DAY = 86_400_000;

/** The calendar day of a wall time read with `getUTC*`, as a number of days. */
function dayNumber(wall: Date): number {
  return Math.floor(
    Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate()) / MS_PER_DAY,
  );
}

/**
 * When the drop-ins may answer, in the zone of the round: "hoje, às 20h", "amanhã, às 20h" or, any other
 * day, the weekday and the date ("na terça, 24/11, às 20h"), since the window may be a week away.
 * "Today" is the day of `now` in the zone of the round, not of the phone.
 */
export function dropInOpensPhrase(round: RoundClockInput, opensAt: string, now: number): string {
  const wall = localWallTime(round, opensAt);
  const today = localWallTime(round, new Date(now).toISOString());
  if (wall === null || today === null) return "";
  const { when } = roundsStrings;
  const at = when.at(
    wall.getUTCHours(),
    formatTime(`${two(wall.getUTCHours())}:${two(wall.getUTCMinutes())}`),
  );
  const ahead = dayNumber(wall) - dayNumber(today);
  if (ahead === 0) return when.day(when.today, at);
  if (ahead === 1) return when.day(when.tomorrow, at);
  const weekday = wall.getUTCDay() === SUNDAY_JS ? SUNDAY_ISO : wall.getUTCDay();
  const date = `${String(wall.getUTCDate())}/${String(wall.getUTCMonth() + MONTH_OFFSET)}`;
  return when.dated(when.weekdayWithArticle[weekday] ?? "", date, at);
}

/** True once the instant has come, by the clock of the phone (the server has the last word, risk 4). */
export function hasArrived(instant: string, now: number): boolean {
  const at = Date.parse(instant);
  return !Number.isNaN(at) && at <= now;
}
