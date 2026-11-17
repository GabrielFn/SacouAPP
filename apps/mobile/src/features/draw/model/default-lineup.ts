import type { MemberId } from "@sacou/match-engine";
import type { FormationSystem } from "@sacou/volley-rules";

import type { Member } from "../../../services/api/sacou-api";

/** The position a member said they play; `null` without a profile. */
export type PrimaryPosition = Member["primaryPosition"];

export type PositionOf = (memberId: MemberId) => PrimaryPosition;

/** The position each index of `lineup` asks for (ADR 0026): `S, OH1, MB1, OPP, OH2, MB2` in the 5x1. */
type SlotPosition = "setter" | "outsideHitter" | "middleBlocker" | "opposite";

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

const SLOTS_OF: Readonly<Record<Exclude<FormationSystem, "livre">, readonly SlotPosition[]>> = {
  "5x1": FIVE_ONE_SLOTS,
  "6x2": TWO_SETTER_SLOTS,
  "4x2": TWO_SETTER_SLOTS,
};

/** Without a second setter, the opposite takes `S2` in the 6x2 and the 4x2 (D6). */
const SECOND_SETTER_INDEX = 3;
const SECOND_SETTER_STAND_IN: SlotPosition = "opposite";

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
  system: FormationSystem,
  seats: Seats,
  positionOf: PositionOf,
): Seats {
  if (system === "5x1" || seats[SECOND_SETTER_INDEX] !== null) return seats;
  const standIn = firstFree(
    team,
    seats,
    (memberId) => positionOf(memberId) === SECOND_SETTER_STAND_IN,
  );
  return seatWhere(seats, SECOND_SETTER_INDEX, standIn);
}

/** The empty slots take the others in order of arrival: `any`, `libero`, no profile and the extras. */
function withTheRest(team: readonly MemberId[], seats: Seats): readonly MemberId[] {
  const rest = team.filter((memberId) => !seats.includes(memberId));
  return seats.reduce<{ readonly lineup: readonly MemberId[]; readonly next: number }>(
    ({ lineup, next }, seat) =>
      seat === null
        ? { lineup: [...lineup, rest[next] ?? ""], next: next + 1 }
        : { lineup: [...lineup, seat], next },
    { lineup: [], next: 0 },
  ).lineup;
}

/**
 * The lineup a drawn team starts with (D6), from the positions of the profiles: the starting point that
 * screen 22 changes (E4.8). The team has exactly six; the free system keeps the order of arrival.
 */
export function defaultLineup(
  team: readonly MemberId[],
  system: FormationSystem,
  positionOf: PositionOf,
): readonly MemberId[] {
  if (system === "livre") return team;
  const seats = byPosition(team, SLOTS_OF[system], positionOf);
  return withTheRest(team, withStandInSetter(team, system, seats, positionOf));
}
