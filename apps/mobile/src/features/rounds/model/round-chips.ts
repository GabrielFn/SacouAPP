import type { GroupSettings, SettingsPath } from "@sacou/match-engine";

import { roundsStrings } from "../../../strings/rounds.pt-BR";

const BEST_OF_ONE = 1;
const ROUND_SOURCE = "round";
const WHOLE_TEAM_EXIT = "whole-team";

const { chips } = roundsStrings;

export type ChipKey = "modality" | "points" | "sets" | "queue" | "exit" | "rotation";

export interface RoundChip {
  readonly key: ChipKey;
  readonly label: string;
  /** The orange dot: this leaf was set only for this round. */
  readonly highlighted: boolean;
}

export interface ChipOptions {
  /** Screen 20 shows the rotation system; 06 and 26 do not. */
  readonly withRotation: boolean;
}

export type SourceOf = (path: SettingsPath) => string | undefined;

/** The "Como vai ser" pills of a round. Money has no pill in the pilot (ADR 0046). */
export function roundChips(
  values: GroupSettings,
  sourceOf: SourceOf,
  options: ChipOptions,
): readonly RoundChip[] {
  const chip = (key: ChipKey, label: string, path: SettingsPath): RoundChip => ({
    key,
    label,
    highlighted: sourceOf(path) === ROUND_SOURCE,
  });
  const result: RoundChip[] = [
    chip("modality", chips.modalities[values.format.modality] ?? "", "format.modality"),
  ];
  if (values.scoring.enabled) {
    result.push(chip("points", chips.points(values.scoring.pointsPerSet), "scoring.pointsPerSet"));
    result.push(
      chip(
        "sets",
        values.scoring.bestOf === BEST_OF_ONE ? chips.oneSet : chips.bestOf(values.scoring.bestOf),
        "scoring.bestOf",
      ),
    );
  }
  if (values.queue.enabled) {
    result.push(chip("queue", chips.queue, "queue.enabled"));
    if (values.queue.exitMode !== WHOLE_TEAM_EXIT) {
      result.push(chip("exit", chips.partialExit, "queue.exitMode"));
    }
  }
  if (options.withRotation && values.rotation.enabled) {
    result.push(
      chip("rotation", chips.rotationSystems[values.rotation.system] ?? "", "rotation.system"),
    );
  }
  return result;
}

/** The reading of the `sources` map the server sends (a plain record by path). */
export function sourceReader(sources: Readonly<Record<string, string>>): SourceOf {
  return (path) => sources[path];
}

/** The legend under the pills only matters when the round set some leaf of its own. */
export function hasRoundLayer(sources: Readonly<Record<string, string>>): boolean {
  return Object.values(sources).includes(ROUND_SOURCE);
}
