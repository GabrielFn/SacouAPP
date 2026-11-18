import type { MemberId } from "@sacou/match-engine";
import { err, ok, ROTATION_SLOTS, type FormationSystem, type Result } from "@sacou/volley-rules";

import type { Member } from "../../../services/api/sacou-api";

/** The position a member said they play; `null` without a profile. */
export type PrimaryPosition = Member["primaryPosition"];

export type PositionOf = (memberId: MemberId) => PrimaryPosition;

/** The position each index of `lineup` asks for (ADR 0026): `S, OH1, MB1, OPP, OH2, MB2` in the 5x1. */
export type SlotPosition = "setter" | "outsideHitter" | "middleBlocker" | "opposite";

const FIVE_ONE_SLOTS: readonly SlotPosition[] = [
  "setter",
  "outsideHitter",
  "middleBlocker",
  "opposite",
  "outsideHitter",
  "middleBlocker",
];

/** `S1, OH1, MB1, S2, OH2, MB2` in the 6x2 and the 4x2. */
const TWO_SETTER_SLOTS: readonly SlotPosition[] = [
  "setter",
  "outsideHitter",
  "middleBlocker",
  "setter",
  "outsideHitter",
  "middleBlocker",
];

export const SLOTS_OF: Readonly<
  Record<Exclude<FormationSystem, "livre">, readonly SlotPosition[]>
> = {
  "5x1": FIVE_ONE_SLOTS,
  "6x2": TWO_SETTER_SLOTS,
  "4x2": TWO_SETTER_SLOTS,
};

/** Without a second setter, the opposite takes `S2` in the 6x2 and the 4x2 (D6). */
export const SECOND_SETTER_INDEX = 3;
export const SECOND_SETTER_STAND_IN: SlotPosition = "opposite";

type Seats = readonly (MemberId | null)[];

function firstFree(
  team: readonly MemberId[],
  seats: Seats,
  matches: (memberId: MemberId) => boolean,
): MemberId | null {
  return team.find((memberId) => !seats.includes(memberId) && matches(memberId)) ?? null;
}

function seatWhere(seats: Seats, index: number, pick: MemberId | null): Seats {
  return seats.map((seat, at) => (at === index && seat === null ? pick : seat));
}

/** Each slot, in order, takes the first member to arrive who plays its position. */
function byPosition(
  team: readonly MemberId[],
  slots: readonly SlotPosition[],
  positionOf: PositionOf,
): Seats {
  return slots.reduce<Seats>(
    (seats, slot, index) =>
      seatWhere(
        seats,
        index,
        firstFree(team, seats, (memberId) => positionOf(memberId) === slot),
      ),
    slots.map(() => null),
  );
}

function withStandInSetter(
  team: readonly MemberId[],
  standInIndex: number | null,
  seats: Seats,
  positionOf: PositionOf,
): Seats {
  if (standInIndex === null || seats[standInIndex] !== null) return seats;
  const standIn = firstFree(
    team,
    seats,
    (memberId) => positionOf(memberId) === SECOND_SETTER_STAND_IN,
  );
  return seatWhere(seats, standInIndex, standIn);
}

/** The empty slots take the others in order of arrival: `any`, `libero`, no profile and the extras. */
function withTheRest(team: readonly MemberId[], seats: Seats): Seats {
  const rest = team.filter((memberId) => !seats.includes(memberId));
  return seats.reduce<{ readonly lineup: Seats; readonly next: number }>(
    ({ lineup, next }, seat) =>
      seat === null
        ? { lineup: [...lineup, rest[next] ?? null], next: next + 1 }
        : { lineup: [...lineup, seat], next },
    { lineup: [], next: 0 },
  ).lineup;
}

export type DefaultLineupError = "wrong-team-size" | "duplicate-member";

function allSeated(seats: Seats): readonly MemberId[] | null {
  const seated = seats.filter((seat): seat is MemberId => seat !== null);
  return seated.length === seats.length ? seated : null;
}

/**
 * Seats `team` on `slots`, in order: each slot takes the first member who plays its position, the
 * second setter slot (`standInIndex`) takes an opposite when no setter is left, and the empty slots
 * take the others in order. `null` when the team does not fill the slots. Screen 22 reuses it for
 * "Corrigir" on the five slots after the setter (E4.8, D4).
 */
export function seatByPosition(
  team: readonly MemberId[],
  slots: readonly SlotPosition[],
  standInIndex: number | null,
  positionOf: PositionOf,
): readonly MemberId[] | null {
  const seats = byPosition(team, slots, positionOf);
  return allSeated(withTheRest(team, withStandInSetter(team, standInIndex, seats, positionOf)));
}

/** The index of the second setter slot, where an opposite stands in: none in the 5x1 nor the free system. */
export function standInIndexOf(system: FormationSystem): number | null {
  return system === "5x1" || system === "livre" ? null : SECOND_SETTER_INDEX;
}

/**
 * The lineup a drawn team starts with (D6), from the positions of the profiles: the starting point that
 * screen 22 changes (E4.8). Only a team of six has one (ADR 0024); the free system keeps the order of
 * arrival. A team that cannot fill the six seats is an error, never an empty `MemberId`.
 */
export function defaultLineup(
  team: readonly MemberId[],
  system: FormationSystem,
  positionOf: PositionOf,
): Result<readonly MemberId[], DefaultLineupError> {
  if (team.length !== ROTATION_SLOTS.length) return err("wrong-team-size");
  // A drawn team has each member once: a repeat would put one person in two seats.
  if (new Set(team).size !== team.length) return err("duplicate-member");
  if (system === "livre") return ok(team);
  const lineup = seatByPosition(team, SLOTS_OF[system], standInIndexOf(system), positionOf);
  return lineup === null ? err("wrong-team-size") : ok(lineup);
}
