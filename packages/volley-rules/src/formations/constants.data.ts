export const ROTATION_SLOTS = [1, 2, 3, 4, 5, 6] as const;

/** `0` is the single rotation of the Livre system, which has no setter. */
export const ROTATION_KEYS = [0, ...ROTATION_SLOTS] as const;

export const FORMATION_SYSTEMS = ["5x1", "6x2", "4x2", "livre"] as const;

export const PLAYER_ROLES = [
  "S",
  "S1",
  "S2",
  "OPP",
  "OH1",
  "OH2",
  "MB1",
  "MB2",
  "L",
  "P1",
  "P2",
  "P3",
  "P4",
  "P5",
  "P6",
] as const;
