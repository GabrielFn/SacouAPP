import type { GroupSettings, MemberId, SettingsPath, SettingsValue } from "@sacou/match-engine";

import { withLeaf } from "../../groups/model/settings-patch";
import { arrangementOf, type DrawArrangement } from "./draw-arrangement";
import { drawNamesOf, type DrawNameOf } from "./draw-names";
import {
  drawAnswer,
  drawSettings,
  g1Members,
  G1_ORDER,
  RESERVES,
  TEAM_A,
  TEAM_B,
} from "./draw.test.fixture";
import type { PositionOf, PrimaryPosition } from "./default-lineup";
import type { MatchStartInput } from "./match-start";
import { initialPreGameChoices, type PreGameChoices } from "./pre-game";

/** The engine takes only UUIDs: G1 again, each nickname key turned into a fixed v4 UUID. */
const UUID_PREFIX = "a0000000-0000-4000-8000-";
const UUID_DIGITS = 12;

export const G1_UUID: Readonly<Record<string, MemberId>> = Object.fromEntries(
  G1_ORDER.map((key, index) => [
    key,
    `${UUID_PREFIX}${String(index + 1).padStart(UUID_DIGITS, "0")}`,
  ]),
);

export function uuidOf(key: string): MemberId {
  const id = G1_UUID[key];
  if (id === undefined) throw new Error(`No G1 member ${key}`);
  return id;
}

/** Profiles of G1: Pedro and Gabi set, Lia and Léo play opposite; the rest is varied. */
export const G1_POSITIONS: Readonly<Record<string, PrimaryPosition>> = {
  ana: "outsideHitter",
  joao: "middleBlocker",
  pedro: "setter",
  lia: "opposite",
  marcos: "outsideHitter",
  bia: "middleBlocker",
  rafa: "outsideHitter",
  duda: "any",
  caio: "middleBlocker",
  nina: "libero",
  leo: "opposite",
  gabi: "setter",
};

const KEY_OF_UUID: ReadonlyMap<MemberId, string> = new Map(
  Object.entries(G1_UUID).map(([key, id]) => [id, key]),
);

export const g1PositionOf: PositionOf = (memberId) =>
  G1_POSITIONS[KEY_OF_UUID.get(memberId) ?? ""] ?? null;

export function g1UuidNames(): DrawNameOf {
  const byKey = drawNamesOf(g1Members());
  return (memberId) => byKey(KEY_OF_UUID.get(memberId) ?? memberId);
}

/** The arrangement of G1 with UUIDs: Laranja, Azul, then Davi and Sofia in the queue. */
export function g1UuidArrangement(
  teams: readonly (readonly string[])[] = [TEAM_A, TEAM_B],
  reserves: readonly string[] = RESERVES,
): DrawArrangement {
  return arrangementOf(
    drawAnswer(
      teams.map((team) => team.map(uuidOf)),
      reserves.map(uuidOf),
    ),
  );
}

const GOLDEN_BEST_OF = 3;
const GOLDEN_POINTS = 25;
const GOLDEN_TIE_BREAK = 15;
const ADVANTAGE = 2;

/** Best of 3 to 25, tie-break to 15, advantage, 5x1 for both: the round of the golden case. */
const GOLDEN_LEAVES: readonly (readonly [SettingsPath, SettingsValue])[] = [
  ["scoring.enabled", true],
  ["scoring.bestOf", GOLDEN_BEST_OF],
  ["scoring.pointsPerSet", GOLDEN_POINTS],
  ["scoring.tieBreakEnabled", true],
  ["scoring.tieBreakPoints", GOLDEN_TIE_BREAK],
  ["scoring.winMargin", ADVANTAGE],
  ["rotation.enabled", true],
  ["rotation.system", "5x1"],
];

export function preGameSettings(
  patch: (settings: GroupSettings) => GroupSettings = (settings) => settings,
): GroupSettings {
  return patch(
    GOLDEN_LEAVES.reduce(
      (settings, [path, value]) => withLeaf(settings, path, value),
      drawSettings(),
    ),
  );
}

export function g1Input(
  preGame: Partial<PreGameChoices> = {},
  settings: GroupSettings = preGameSettings(),
  arrangement: DrawArrangement = g1UuidArrangement(),
): MatchStartInput {
  return {
    arrangement,
    settings,
    positionOf: g1PositionOf,
    preGame: { ...initialPreGameChoices, ...preGame },
  };
}
