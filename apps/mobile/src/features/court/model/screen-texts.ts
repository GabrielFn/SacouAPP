import type { TeamSide } from "@sacou/match-engine";

import { strings } from "../../../strings/pt-BR";
import type { CourtScreenModel, QueueModel } from "./court-screen.types";
import type { LastPoint } from "./point-toast";

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

export interface QueuePillText {
  readonly key: string;
  readonly label: string;
}

/** The pills of the queue in order: whole teams first (as "Time n"), then the reserves by name. */
export function queuePills(queue: QueueModel): readonly QueuePillText[] {
  return [
    ...queue.teams.map(({ key }, index) => ({ key, label: strings.court.queue.team(index + 1) })),
    ...queue.players.map(({ memberId, name }) => ({ key: memberId, label: name })),
  ];
}

export interface VisibleQueuePills {
  readonly shown: readonly QueuePillText[];
  /** How many did not fit: the "+k". */
  readonly hidden: number;
}

/** Whole teams first, then the reserves; past the limit the rest is a "+k". */
export function visibleQueuePills(queue: QueueModel | null, limit: number): VisibleQueuePills {
  const entries = queue === null ? [] : queuePills(queue);
  return { shown: entries.slice(0, limit), hidden: Math.max(0, entries.length - limit) };
}

/** The toast of the last point, "+1 Laranja (19–15)": it takes the place of the line of the strip. */
export function pointToastText(model: CourtScreenModel, point: LastPoint): string {
  return strings.court.strip.pointToast(model.teams[point.side].label, point.own, point.other);
}
