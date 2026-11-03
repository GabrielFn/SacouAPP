/**
 * The version of the formation catalog. A recorded match keeps playing the catalog it started with,
 * so a change to `formations.json` raises this number and keeps the previous catalog (ADR 0026).
 */
export const FORMATION_CATALOG_VERSION = 1;

export const ROTATION_SLOTS = Object.freeze([1, 2, 3, 4, 5, 6] as const);

/** `0` is the single rotation of the Livre system, which has no setter. */
export const ROTATION_KEYS = Object.freeze([0, ...ROTATION_SLOTS] as const);

export const FORMATION_SYSTEMS = Object.freeze(["5x1", "6x2", "4x2", "livre"] as const);

export const PLAYER_ROLES = Object.freeze([
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
] as const);
