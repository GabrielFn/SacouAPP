import { roundsStrings } from "../../../strings/rounds.pt-BR";

const MONTH_OFFSET = 1;
const DAYS_PER_WEEK = 7;
const MS_PER_DAY = 86_400_000;
const MAX_DAYS_AHEAD = 365;
const PICKABLE_DATES = 14;
const DEFAULT_START_TIME = "20:00";
const TIME_SEPARATOR = ":";
const PAD_WIDTH = 2;
const SUNDAY_JS = 0;
const SUNDAY_ISO = 7;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const HOUR_MINUTE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** The time offered when the group has no fixed schedule. */
export const DEFAULT_ROUND_TIME = DEFAULT_START_TIME;

const two = (value: number) => String(value).padStart(PAD_WIDTH, "0");

/** The calendar day of a local date, as `YYYY-MM-DD`. */
export function isoDateOf(date: Date): string {
  return `${String(date.getFullYear())}-${two(date.getMonth() + MONTH_OFFSET)}-${two(date.getDate())}`;
}

/** `null` when the text is not a real calendar day. */
export function parseIsoDate(text: string): Date | null {
  const match = ISO_DATE.exec(text);
  if (match === null) return null;
  const [, year = "", month = "", day = ""] = match;
  const date = new Date(Number(year), Number(month) - MONTH_OFFSET, Number(day));
  return isoDateOf(date) === text ? date : null;
}

/** `{ hours, minutes }` of `HH:mm`, or `null`. */
export function parseTime(text: string): { readonly hours: number; readonly minutes: number } | null {
  const match = HOUR_MINUTE.exec(text);
  if (match === null) return null;
  const [, hours = "", minutes = ""] = match;
  return { hours: Number(hours), minutes: Number(minutes) };
}

/** ISO weekday, 1 is Monday. */
export function isoWeekdayOf(date: Date): number {
  const day = date.getDay();
  return day === SUNDAY_JS ? SUNDAY_ISO : day;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** The local moment a round of that day and time starts, or `null` for a text that is not one. */
export function startOf(localDate: string, localTime: string): Date | null {
  const day = parseIsoDate(localDate);
  const time = parseTime(localTime);
  if (day === null || time === null) return null;
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), time.hours, time.minutes);
}

/**
 * The next day the group plays that starts after `now`: the fixed weekday, or tomorrow without one.
 * (On the day the clocks change, the hour shown stays the chosen one; the server adjusts it.)
 */
export function nextRoundDate(now: Date, weekday: number | null, startTime: string): string {
  const today = addDays(now, 0);
  if (weekday === null) return isoDateOf(addDays(today, 1));
  const ahead = (weekday - isoWeekdayOf(today) + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  const candidate = addDays(today, ahead);
  const start = startOf(isoDateOf(candidate), startTime);
  return start !== null && start.getTime() > now.getTime()
    ? isoDateOf(candidate)
    : isoDateOf(addDays(candidate, DAYS_PER_WEEK));
}

/** "Ter, 3/11". */
export function dateLabel(localDate: string): string {
  const date = parseIsoDate(localDate);
  if (date === null) return localDate;
  const name = roundsStrings.weekdayShort[isoWeekdayOf(date)] ?? "";
  return `${name}, ${String(date.getDate())}/${String(date.getMonth() + MONTH_OFFSET)}`;
}

/** "Ter 3/11", the form of the subtitle of the detail. */
export function dateSubtitle(localDate: string): string {
  return dateLabel(localDate).replace(",", "");
}

export interface PickableDate {
  readonly date: string;
  readonly label: string;
}

/** The 14 dates of the sheet, one after the other from the first. */
export function pickableDates(first: string): readonly PickableDate[] {
  const start = parseIsoDate(first);
  if (start === null) return [];
  return Array.from({ length: PICKABLE_DATES }, (_unused, index) => {
    const date = isoDateOf(addDays(start, index));
    return { date, label: dateLabel(date) };
  });
}

/** Whole days from today to the date; negative for a date that passed. */
export function daysFromToday(now: Date, localDate: string): number | null {
  const date = parseIsoDate(localDate);
  if (date === null) return null;
  const today = addDays(now, 0);
  return Math.round((date.getTime() - today.getTime()) / MS_PER_DAY);
}

export function isTooFar(now: Date, localDate: string): boolean {
  const days = daysFromToday(now, localDate);
  return days !== null && days > MAX_DAYS_AHEAD;
}

export function isBeforeToday(now: Date, localDate: string): boolean {
  const days = daysFromToday(now, localDate);
  return days === null || days < 0;
}

export function joinTime(hours: number, minutes: number): string {
  return `${two(hours)}${TIME_SEPARATOR}${two(minutes)}`;
}
