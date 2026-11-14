import { settingsStrings } from "../../../strings/settings.pt-BR";

const ZERO_MINUTES = "00";
const TIME_SEPARATOR = ":";

export function weekdayName(weekday: number): string {
  return settingsStrings.weekdays[weekday]?.name ?? "";
}

/** "20:30" → "20h30"; "20:00" → "20h". */
export function formatTime(time: string): string {
  const [hour = "", minute = ""] = time.split(TIME_SEPARATOR);
  const hours = String(Number(hour));
  return minute === ZERO_MINUTES ? `${hours}h` : `${hours}h${minute}`;
}

/** "Terça, 20h30" for a button. */
export function scheduleText(weekday: number, time: string): string {
  return `${weekdayName(weekday)}, ${formatTime(time)}`;
}

/** "toda terça 20h30" for a summary. */
export function scheduleSummary(weekday: number, time: string): string {
  return `${settingsStrings.weekdays[weekday]?.every ?? ""} ${formatTime(time)}`;
}
