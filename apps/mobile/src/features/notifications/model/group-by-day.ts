import type { NotificationItem } from "../../../services/api/sacou-api";
import { notificationsStrings } from "../../../strings/notifications.pt-BR";

const MS_PER_DAY = 86_400_000;
const MS_PER_MINUTE = 60_000;
const YESTERDAY = 1;
/** Up to six days back a day is named by its weekday ("Terça"); before that, by its date. */
const LAST_NAMED_DAY = 6;
const SUNDAY_JS = 0;
const SUNDAY_ISO = 7;
const MONTH_OFFSET = 1;
const PAD_WIDTH = 2;

export interface DayClock {
  readonly nowMs: number;
  /** Minutes the zone of the phone is behind UTC, as `Date.getTimezoneOffset` gives (180 in Brasília). */
  readonly offsetMinutes: number;
}

export interface NotificationDay {
  readonly label: string;
  readonly items: readonly NotificationRowView[];
}

export interface NotificationRowView {
  readonly item: NotificationItem;
  /** "9h00", in the zone of the phone. */
  readonly time: string;
}

const two = (value: number) => String(value).padStart(PAD_WIDTH, "0");

/** The instant as a wall time of the phone, read with the `getUTC*` methods. */
function wallTime(instantMs: number, clock: DayClock): Date {
  return new Date(instantMs - clock.offsetMinutes * MS_PER_MINUTE);
}

function dayNumber(wall: Date): number {
  return Math.floor(wall.getTime() / MS_PER_DAY);
}

function dayLabel(wall: Date, daysAgo: number): string {
  if (daysAgo <= 0) return notificationsStrings.today;
  if (daysAgo === YESTERDAY) return notificationsStrings.yesterday;
  if (daysAgo <= LAST_NAMED_DAY) {
    const day = wall.getUTCDay();
    return notificationsStrings.weekdays[day === SUNDAY_JS ? SUNDAY_ISO : day] ?? "";
  }
  return notificationsStrings.date(two(wall.getUTCDate()), two(wall.getUTCMonth() + MONTH_OFFSET));
}

export function timeLabel(wall: Date): string {
  return notificationsStrings.time(String(wall.getUTCHours()), two(wall.getUTCMinutes()));
}

/**
 * The list of screen 28 in groups of a day of the phone ("Hoje", "Ontem", "Terça", "12/11"), newest
 * first, in the order the server sent within a day. An item with an unreadable date goes to "Hoje".
 */
export function groupByDay(
  items: readonly NotificationItem[],
  clock: DayClock,
): readonly NotificationDay[] {
  const today = dayNumber(wallTime(clock.nowMs, clock));
  const days = new Map<number, { label: string; items: NotificationRowView[] }>();
  items.forEach((item) => {
    const parsed = Date.parse(item.createdAt);
    const wall = wallTime(Number.isNaN(parsed) ? clock.nowMs : parsed, clock);
    const number = dayNumber(wall);
    const day = days.get(number) ?? { label: dayLabel(wall, today - number), items: [] };
    day.items.push({ item, time: timeLabel(wall) });
    days.set(number, day);
  });
  return [...days.entries()]
    .sort(([first], [second]) => second - first)
    .map(([, day]) => ({ label: day.label, items: day.items }));
}
