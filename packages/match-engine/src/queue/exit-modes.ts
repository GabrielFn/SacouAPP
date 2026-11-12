import { ok } from "@sacou/volley-rules";

import { MAX_TEAM_MEMBERS } from "../score/constants.data.js";
import { queueMembers, queueSize } from "../score/queue-rules.js";
import type { TeamRoster } from "../score/types.js";
import { MIN_FIXED_EXIT_COUNT } from "./constants.data.js";
import {
  enterFirstTeam,
  type ExitStepContext,
  type ExitStepResult,
  replaceBySingles,
  replaceMembers,
  stayStep,
} from "./exit-steps.js";
import type { QueueExitMode, QueueExitModeKind } from "./types.js";

/** The Strategy `IQueueExitModeStep` of the C#: one team leaving by a mode (ADR 0050). */
interface QueueExitModeStep<M extends QueueExitMode> {
  readonly run: (context: ExitStepContext, mode: M) => ExitStepResult;
}

type ModeOf<K extends QueueExitModeKind> = Extract<QueueExitMode, { readonly kind: K }>;

/** The mode of E2.6: the loser leaves whole and goes to the singles, or the singles replace some. */
const automaticStep: QueueExitModeStep<ModeOf<"automatic">> = {
  run: (context) =>
    context.pool.teams.length > 0
      ? ok(enterFirstTeam(context, ({ memberIds }) => ({ players: memberIds, teams: [] })))
      : replaceBySingles(context, "kept"),
};

/**
 * With only singles waiting, the team is set again: the singles come in, the criterion picks who of
 * the team rests, and the lineup is to set (question P2 of E2.12, recommendation adopted).
 */
function rebuildWithSingles(context: ExitStepContext): ExitStepResult {
  return replaceBySingles(context, "reset");
}

/** The team leaves whole and goes back to the end of the teams of the queue, never to the singles. */
const wholeTeamStep: QueueExitModeStep<ModeOf<"whole-team">> = {
  run: (context) =>
    context.pool.teams.length > 0
      ? ok(enterFirstTeam(context, (left: TeamRoster) => ({ players: [], teams: [left] })))
      : rebuildWithSingles(context),
};

/**
 * The queue becomes one line (teams in order, member by member, then the singles): `k` leave, the
 * smallest of the count, the team and the line, and the first `k` of the line take their places.
 */
const fixedCountStep: QueueExitModeStep<ModeOf<"fixed-count">> = {
  run: (context, { count }) => {
    const line = queueMembers(context.pool);
    const leaving = Math.min(count, context.roster.memberIds.length, line.length);
    return replaceMembers(
      context,
      line.slice(0, leaving),
      { players: line.slice(leaving), teams: [] },
      "kept",
    );
  },
};

const QUEUE_EXIT_MODE_STEPS: { readonly [K in QueueExitModeKind]: QueueExitModeStep<ModeOf<K>> } =
  {
    automatic: automaticStep,
    "whole-team": wholeTeamStep,
    "fixed-count": fixedCountStep,
  };

function isFixedCount(value: unknown): boolean {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= MIN_FIXED_EXIT_COUNT &&
    value <= MAX_TEAM_MEMBERS
  );
}

/** A known kind among the own keys of the map, and a count from 1 to 24 for the fixed count. */
export function isQueueExitMode(value: unknown): value is QueueExitMode {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const { count, kind } = value as { readonly count?: unknown; readonly kind?: unknown };
  if (typeof kind !== "string" || !Object.hasOwn(QUEUE_EXIT_MODE_STEPS, kind)) {
    return false;
  }
  return kind !== "fixed-count" || isFixedCount(count);
}

function runMode<K extends QueueExitModeKind>(
  context: ExitStepContext,
  mode: ModeOf<K>,
): ExitStepResult {
  const step: QueueExitModeStep<ModeOf<K>> = QUEUE_EXIT_MODE_STEPS[mode.kind as K];
  return step.run(context, mode);
}

/** One team leaving by the mode; nobody waiting leaves it as it is (rule 1 of `fila.md`). */
export function runExitStep(context: ExitStepContext, mode: QueueExitMode): ExitStepResult {
  return queueSize(context.pool) === 0 ? ok(stayStep(context)) : runMode(context, mode);
}
