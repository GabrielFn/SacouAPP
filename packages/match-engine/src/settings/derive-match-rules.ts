import { LIBERO_SYSTEMS } from "../score/constants.data.js";
import type { GroupSettings, MatchRules } from "./types.js";

/**
 * What a match freezes, from the resolved values. The tie-break turned off becomes `null`, as the
 * engine reads it, and the libero only plays in the systems that have one (ADR 0028): a libero on
 * with `livre`, even from another level, is not an error, just not allowed.
 */
export function deriveMatchRules(values: GroupSettings): MatchRules {
  const { scoring, rotation } = values;
  return {
    scoring: {
      bestOf: scoring.bestOf,
      pointsPerSet: scoring.pointsPerSet,
      tieBreakPoints: scoring.tieBreakEnabled ? scoring.tieBreakPoints : null,
      winMargin: scoring.winMargin,
    },
    system: rotation.system,
    ruleMode: rotation.ruleMode,
    liberoAllowed: rotation.liberoEnabled && LIBERO_SYSTEMS.includes(rotation.system),
  };
}
