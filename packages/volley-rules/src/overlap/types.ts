import type { FormationPhase } from "../formations/index.js";
import type { OVERLAP_RELATIONS, OVERLAP_RULE_MODES } from "./constants.data.js";

export type OverlapRuleMode = (typeof OVERLAP_RULE_MODES)[number];
export type OverlapRelation = (typeof OVERLAP_RELATIONS)[number];
export type OverlapRelationId = OverlapRelation["id"];

/** The relations in force for that mode and phase, which all held. */
export interface OverlapCheck {
  readonly checked: readonly OverlapRelationId[];
}

export type OverlapError =
  | { readonly code: "overlap"; readonly violations: readonly OverlapRelationId[] }
  | { readonly code: "invalid-tolerance" };

export interface FormationOverlapOptions {
  readonly mode: OverlapRuleMode;
  /** Reaches the depth and lateral relations alike. Defaults to `DEFAULT_OVERLAP_TOLERANCE`. */
  readonly tolerance?: number;
}

export interface OverlapOptions extends FormationOverlapOptions {
  readonly phase: FormationPhase;
}
