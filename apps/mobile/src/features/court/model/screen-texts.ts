import type { TeamSide } from "@sacou/match-engine";

import type { TeamColorName } from "../../../theme/team-colors";
import { strings } from "../../../strings/pt-BR";
import { sidesOf } from "./court-sides";
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
    case "first-server-drawn":
      return strings.court.strip.firstServerDrawn(teams[hint.side].label);
  }
}

/** The color of whoever won each set, `null` for the set still open: the dots of the bar. */
export function dotColors(model: CourtScreenModel): readonly (TeamColorName | null)[] {
  return model.dots.map(({ winner }) => (winner === null ? null : model.teams[winner].color));
}

/** "Laranja venceu 2 seguidas", or `null` with no streak. */
export function streakText({ streak }: CourtScreenModel): string | null {
  return streak === null ? null : strings.court.queue.streak(streak.label, streak.count);
}

function setsWon(model: CourtScreenModel, side: TeamSide): number {
  return model.dots.filter(({ winner }) => winner === side).length;
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
    ...queue.players.map(({ memberId, displayName }) => ({ key: memberId, label: displayName })),
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

/** What a screen reader says for the dots of the header: the team drawn first (left or top) is named first. */
export function setsLabel(model: CourtScreenModel, inverted = false): string {
  const { left, right } = sidesOf(inverted);
  const { teams } = model;
  return strings.court.header.setsLabel(
    teams[left].label,
    setsWon(model, left),
    teams[right].label,
    setsWon(model, right),
  );
}
