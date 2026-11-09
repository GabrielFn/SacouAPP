import type { TeamSide } from "@sacou/match-engine";

import { strings } from "../../../strings/pt-BR";
import type { CourtScreenModel, QueueModel } from "./court-screen.types";

/** The line in the middle strip. */
export function hintText({ hint, teams }: CourtScreenModel): string {
  switch (hint.kind) {
    case "positions":
      return strings.court.strip.positions;
    case "closes-set":
      return strings.court.strip.oneMorePoint(teams[hint.side].label);
    case "next-point-closes":
      return strings.court.strip.nextPointCloses;
  }
}

/** "Laranja venceu 2 seguidas", or `null` with no streak. */
export function streakText({ streak }: CourtScreenModel): string | null {
  return streak === null ? null : strings.court.queue.streak(streak.label, streak.count);
}

function setsWon(model: CourtScreenModel, side: TeamSide): number {
  return model.dots.filter(({ winner }) => winner === side).length;
}

/** What a screen reader says for the dots of the header. */
export function setsLabel(model: CourtScreenModel): string {
  const { a, b } = model.teams;
  return strings.court.header.setsLabel(a.label, setsWon(model, "a"), b.label, setsWon(model, "b"));
}

export function queueExitText(queue: QueueModel | null): string | null {
  if (queue === null) {
    return null;
  }
  return queue.exit === "partial" ? strings.court.queue.partialExit : strings.court.queue.fullExit;
}

/** What a screen reader says for the whole queue row. */
export function queueLabel(queue: QueueModel): string {
  const waiting = [...queue.teams.flatMap(({ players }) => players), ...queue.players];
  return strings.court.queue.waiting(
    waiting.map(({ name }) => name).join(", "),
    queue.teams.length === 0,
  );
}
