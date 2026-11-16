import { strings } from "../../../strings/pt-BR";
import { SKILL_LEVEL } from "../../../ui/skill-level";

const TENTHS_PER_POINT = 10;
const LOWEST_LEVEL = SKILL_LEVEL.minTenths / TENTHS_PER_POINT;

export interface SelfLevelOption {
  /** In points, as on the wire. */
  readonly level: number;
  readonly text: string;
}

/** The five whole levels of screen 27, 1 to 5: the screen offers no half points (`perfil-e-nota.md`). */
export const SELF_LEVEL_OPTIONS: readonly SelfLevelOption[] = strings.profile.levels.map(
  (text, index) => ({ level: LOWEST_LEVEL + index, text }),
);
