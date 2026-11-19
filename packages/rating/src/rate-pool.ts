import { err, ok, type Result } from "@sacou/volley-rules";

import { rateTwoTeams, type TwoRanks } from "./openskill-model.js";
import { BASE_LEVEL_TENTHS, isValidLevelTenths, seedOf } from "./seed.js";
import {
  RATING_POOLS,
  type MemberLevel,
  type MemberRating,
  type MemberSeed,
  type Modality,
  type RatedMatch,
  type RatedRound,
  type RatingParams,
  type RatingPool,
  type Skill,
  type TeamSide,
} from "./types.js";

export type RatingError =
  | { readonly code: "invalid-level"; readonly memberId: string }
  | { readonly code: "duplicate-seed"; readonly memberId: string }
  | { readonly code: "invalid-starts-at"; readonly roundId: string };

/** `startsAt` in one fixed form, so the text order is the time order (TS and C# alike). */
const STARTS_AT_FORM = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u;

/** A member nobody graded starts at 3.0 with a high σ, as `IMemberLevels` resolves it. */
const DEFAULT_LEVEL: MemberLevel = { levelTenths: BASE_LEVEL_TENTHS, source: "default" };

const A_WINS: TwoRanks = [1, 2];
const B_WINS: TwoRanks = [2, 1];

const POOL_OF_MODALITY: Readonly<Record<Modality, RatingPool>> = {
  "indoor-6x6": "indoor",
  "beach-2x2": "beach",
  "beach-4x4": "beach",
};

interface Standing {
  readonly skill: Skill;
  readonly matchesRated: number;
}

type Seeds = ReadonlyMap<string, MemberLevel>;
type Standings = ReadonlyMap<string, Standing>;

export function poolOf(modality: Modality): RatingPool {
  return POOL_OF_MODALITY[modality];
}

function compareText(x: string, y: string): number {
  if (x === y) {
    return 0;
  }
  return x < y ? -1 : 1;
}

/** Rounds that count, in play order: not canceled, by `startsAt`, then `roundId` (ordinal). */
export function orderRounds(rounds: readonly RatedRound[]): readonly RatedRound[] {
  return rounds
    .filter((round) => !round.canceled)
    .sort(
      (x, y) => compareText(x.startsAt, y.startsAt) || compareText(x.roundId, y.roundId),
    );
}

function readSeeds(seeds: readonly MemberSeed[]): Result<Seeds, RatingError> {
  const invalid = seeds.find((seed) => !isValidLevelTenths(seed.levelTenths));
  if (invalid !== undefined) {
    return err({ code: "invalid-level", memberId: invalid.memberId });
  }
  const repeated = seeds.find((seed, index) =>
    seeds.slice(0, index).some((earlier) => earlier.memberId === seed.memberId),
  );
  if (repeated !== undefined) {
    return err({ code: "duplicate-seed", memberId: repeated.memberId });
  }
  return ok(
    new Map(seeds.map(({ memberId, levelTenths, source }) => [memberId, { levelTenths, source }])),
  );
}

function levelOfMember(seeds: Seeds, memberId: string): MemberLevel {
  return seeds.get(memberId) ?? DEFAULT_LEVEL;
}

function standingOf(
  params: RatingParams,
  seeds: Seeds,
  standings: Standings,
  memberId: string,
): Standing {
  return (
    standings.get(memberId) ?? {
      skill: seedOf(params, levelOfMember(seeds, memberId)),
      matchesRated: 0,
    }
  );
}

/** A match with no winner tells too little, and one with nobody in a rally rates no one. */
function isRated(match: RatedMatch): match is RatedMatch & { readonly winner: TeamSide } {
  return match.winner !== null && match.onCourt.a.length > 0 && match.onCourt.b.length > 0;
}

/** Only who stood on the court in a rally is rated, with weight 1; the bench is not. */
function rateMatch(
  params: RatingParams,
  seeds: Seeds,
  standings: Standings,
  match: RatedMatch,
): Standings {
  if (!isRated(match)) {
    return standings;
  }
  const skillsOf = (memberIds: readonly string[]): readonly Skill[] =>
    memberIds.map((memberId) => standingOf(params, seeds, standings, memberId).skill);
  const { a, b } = match.onCourt;
  const [ratedA, ratedB] = rateTwoTeams(
    params,
    [skillsOf(a), skillsOf(b)],
    match.winner === "a" ? A_WINS : B_WINS,
  );
  const updatesOf = (memberIds: readonly string[], skills: readonly Skill[]) =>
    memberIds.flatMap((memberId, index) => {
      const skill = skills[index];
      const before = standingOf(params, seeds, standings, memberId);
      return skill === undefined
        ? []
        : [[memberId, { skill, matchesRated: before.matchesRated + 1 }] as const];
    });
  return new Map([...standings, ...updatesOf(a, ratedA), ...updatesOf(b, ratedB)]);
}

/** Members in order of first appearance: `teams.a`, `teams.b`, then `onCourt`, match by match. */
function membersOf(matches: readonly RatedMatch[]): readonly string[] {
  const all = matches.flatMap((match) => [
    ...match.teams.a,
    ...match.teams.b,
    ...match.onCourt.a,
    ...match.onCourt.b,
  ]);
  return [...new Set(all)];
}

function rateOnePool(
  params: RatingParams,
  seeds: Seeds,
  rounds: readonly RatedRound[],
  pool: RatingPool,
): readonly MemberRating[] {
  const matches = rounds
    .filter((round) => poolOf(round.modality) === pool)
    .flatMap((round) => round.matches);
  const standings = matches.reduce<Standings>(
    (current, match) => rateMatch(params, seeds, current, match),
    new Map(),
  );
  return membersOf(matches).map((memberId) => {
    const level = levelOfMember(seeds, memberId);
    const { skill, matchesRated } = standingOf(params, seeds, standings, memberId);
    return {
      memberId,
      pool,
      seedTenths: level.levelTenths,
      seedSource: level.source,
      mu: skill.mu,
      sigma: skill.sigma,
      matchesRated,
    };
  });
}

/**
 * The hidden rating of a group (ADR 0047 and 0071), rebuilt from scratch on every call: a fold
 * over the finished matches of the rounds in play order, indoor and beach apart, each member
 * seeded with the current level. Members come in order of first appearance, `indoor` first.
 */
export function ratePool(
  params: RatingParams,
  seeds: readonly MemberSeed[],
  rounds: readonly RatedRound[],
): Result<readonly MemberRating[], RatingError> {
  const badRound = rounds.find((round) => !STARTS_AT_FORM.test(round.startsAt));
  if (badRound !== undefined) {
    return err({ code: "invalid-starts-at", roundId: badRound.roundId });
  }
  const seedMap = readSeeds(seeds);
  if (!seedMap.ok) {
    return seedMap;
  }
  const ordered = orderRounds(rounds);
  return ok(RATING_POOLS.flatMap((pool) => rateOnePool(params, seedMap.value, ordered, pool)));
}
