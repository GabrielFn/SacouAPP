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

/** "sex, 19h": when the drop-ins may answer, in the zone of the round. */
export function dropInOpensLabel(round: RoundClockInput, opensAt: string): string {
  const wall = localWallTime(round, opensAt);
  if (wall === null) return "";
  const day = wall.getUTCDay();
  const weekday = roundsStrings.weekdayShort[day === SUNDAY_JS ? SUNDAY_ISO : day] ?? "";
  const time = `${two(wall.getUTCHours())}:${two(wall.getUTCMinutes())}`;
  return `${weekday.toLowerCase()}, ${formatTime(time)}`;
}

/** True once the instant has come, by the clock of the phone (the server has the last word, risk 4). */
export function hasArrived(instant: string, now: number): boolean {
  const at = Date.parse(instant);
  return !Number.isNaN(at) && at <= now;
}
