import {
  SETTINGS_CATALOG,
  type GroupSettings,
  type SettingsLayer,
  type SettingsPath,
  type SettingsValue,
} from "@sacou/match-engine";

import { settingsStrings } from "../../../strings/settings.pt-BR";
import { leafLayer } from "./settings-patch";

const { summary } = settingsStrings.queueRule;
const SUMMARY_SEPARATOR = " · ";

export type QueueSettingsValue = GroupSettings["queue"];
export type ExitMode = QueueSettingsValue["exitMode"];

/** The four leaves of screen 18a; the draft holds exactly these and nothing else. */
export interface QueueRuleDraft {
  readonly exitMode: ExitMode;
  readonly fixedExitCount: number;
  readonly winnerExitEnabled: boolean;
  readonly winnerExitWins: number;
}

export interface StepRange {
  readonly min: number;
  readonly max: number;
}

function rangeOf(path: SettingsPath): StepRange {
  const field = SETTINGS_CATALOG.fields.find((entry) => entry.path === path);
  if (field?.min == null || field.max == null) throw new Error(`No range for ${path}`);
  return { min: field.min, max: field.max };
}

/** The bounds of the two steppers, read from the catalog (E2.12); the buttons turn off at the limits. */
export const FIXED_EXIT_RANGE: StepRange = rangeOf("queue.fixedExitCount");
export const WINNER_WINS_RANGE: StepRange = rangeOf("queue.winnerExitWins");

export function clampStep(value: number, range: StepRange): number {
  return Math.min(range.max, Math.max(range.min, value));
}

export function draftOf(settings: GroupSettings): QueueRuleDraft {
  const { exitMode, fixedExitCount, winnerExitEnabled, winnerExitWins } = settings.queue;
  return { exitMode, fixedExitCount, winnerExitEnabled, winnerExitWins };
}

/** "Automático · vencedor sai após 3", "Sempre o time inteiro", "Número fixo: 2". */
export function queueRuleSummary(queue: QueueRuleDraft): string {
  const mode = {
    automatic: summary.automatic,
    "whole-team": summary.wholeTeam,
    "fixed-count": summary.fixedCount(queue.fixedExitCount),
  }[queue.exitMode];
  return queue.winnerExitEnabled
    ? [mode, summary.winnerExits(queue.winnerExitWins)].join(SUMMARY_SEPARATOR)
    : mode;
}

const LEAF_PATHS: readonly (readonly [keyof QueueRuleDraft, SettingsPath])[] = [
  ["exitMode", "queue.exitMode"],
  ["fixedExitCount", "queue.fixedExitCount"],
  ["winnerExitEnabled", "queue.winnerExitEnabled"],
  ["winnerExitWins", "queue.winnerExitWins"],
];

/** The leaves of the draft that differ from the saved document. */
export function changedLeaves(
  saved: GroupSettings,
  draft: QueueRuleDraft,
): readonly (readonly [SettingsPath, SettingsValue])[] {
  return LEAF_PATHS.filter(([key]) => draft[key] !== saved.queue[key]).map(
    ([key, path]) => [path, draft[key]] as const,
  );
}

/** One `PATCH` with every changed leaf of the queue; `null` when nothing changed. */
export function queueRuleLayer(saved: GroupSettings, draft: QueueRuleDraft): SettingsLayer | null {
  const changes = changedLeaves(saved, draft);
  return changes.length === 0 ? null : leafLayer(changes);
}

/** The document the draft would make, for the same check the server does (`parseGroupSettings`). */
export function withDraft(settings: GroupSettings, draft: QueueRuleDraft): GroupSettings {
  return { ...settings, queue: { ...settings.queue, ...draft } };
}
