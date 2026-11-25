/** The pilot's zone: the hours and the weeks of the dashboard are São Paulo's (ADR 0085, D3). */
const ZONE = "America/Sao_Paulo";

const TIME = new Intl.DateTimeFormat("pt-BR", {
  timeZone: ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** "15:04", the hour and minute of an instant in São Paulo. */
export function timeInSaoPaulo(instant: string): string {
  return TIME.format(new Date(instant));
}

/** "23/11", the Monday that names a week (`YYYY-MM-DD`). */
export function weekLabel(weekStart: string): string {
  const [, month = "", day = ""] = weekStart.split("-");
  return `${day}/${month}`;
}

/** A count as the page writes it, with the thousands of pt-BR. */
export function countText(count: number): string {
  return count.toLocaleString("pt-BR");
}
