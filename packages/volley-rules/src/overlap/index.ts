export {
  DEFAULT_OVERLAP_RULE_MODE,
  DEFAULT_OVERLAP_TOLERANCE,
  OVERLAP_RELATIONS,
  OVERLAP_RULE_MODES,
} from "./constants.data.js";
export { validateFormationOverlap, validateOverlap } from "./overlap-validator.js";
export type {
  FormationOverlapOptions,
  OverlapCheck,
  OverlapError,
  OverlapOptions,
  OverlapRelation,
  OverlapRelationId,
  OverlapRuleMode,
} from "./types.js";
