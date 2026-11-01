import { deepFreeze } from "../formations/deep-freeze.js";

export const OVERLAP_RULE_MODES = Object.freeze(["fivb-2025-28", "classic"] as const);

export const DEFAULT_OVERLAP_RULE_MODE = "fivb-2025-28";

/** A fraction of the half court: 0.02 of its 9 m is about 18 cm. */
export const DEFAULT_OVERLAP_TOLERANCE = 0.02;

/** The server is the player in this slot, and stays out of the classic serving check. */
export const SERVER_SLOT = 1;

/** The official relations, in the fixed order of `checked` and `violations`. */
export const OVERLAP_RELATIONS = deepFreeze([
  { id: "1-behind-2", kind: "depth", back: 1, front: 2 },
  { id: "6-behind-3", kind: "depth", back: 6, front: 3 },
  { id: "5-behind-4", kind: "depth", back: 5, front: 4 },
  { id: "4-left-of-3", kind: "lateral", left: 4, right: 3 },
  { id: "3-left-of-2", kind: "lateral", left: 3, right: 2 },
  { id: "5-left-of-6", kind: "lateral", left: 5, right: 6 },
  { id: "6-left-of-1", kind: "lateral", left: 6, right: 1 },
] as const);
