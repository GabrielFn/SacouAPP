import { offlineTexts } from "../../strings/api-errors.pt-BR";

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

function updatedAgo(elapsedMs: number): string | null {
  const minutes = Math.floor(elapsedMs / MS_PER_MINUTE);
  if (minutes < 1) return null;
  if (minutes < MINUTES_PER_HOUR) return offlineTexts.minutesAgo(minutes);
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  if (hours < HOURS_PER_DAY) return offlineTexts.hoursAgo(hours);
  return offlineTexts.daysAgo(Math.floor(hours / HOURS_PER_DAY));
}

/**
 * "Sem conexão · atualizado há 2 h", derived from the query's `dataUpdatedAt` and the network, never kept
 * as a flag (frontend.md, rule 1). Under a minute it is only "Sem conexão": "updated just now" adds nothing. `null` when online or when there is nothing kept to show.
 */
export function offlineBannerText(input: {
  readonly online: boolean;
  readonly dataUpdatedAt: number;
  readonly now: number;
}): string | null {
  if (input.online || input.dataUpdatedAt === 0) return null;
  const updated = updatedAgo(Math.max(input.now - input.dataUpdatedAt, 0));
  return updated === null ? offlineTexts.bannerNow : offlineTexts.banner(updated);
}
