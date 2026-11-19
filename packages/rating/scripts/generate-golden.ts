/**
 * Writes the two rating golden files (E3.9 part 2) from the hand-written inputs, with `openskill`
 * as the only source of numbers: nothing from `src/` runs here, so the files check `ratePool` and
 * the C# port instead of repeating them. Run `pnpm --filter @sacou/rating generate:golden`, then
 * `pnpm format`, and review the diff: a change in a number needs a reason (library upgrade or a new
 * `ratingParamsVersion`).
 */
import { readFileSync, writeFileSync } from "node:fs";

import { rate, type Options, type Rating } from "openskill";
import { plackettLuce } from "openskill/models";

import { OPENSKILL_CASES, type SkillInput } from "./openskill-cases.data.ts";
import { POOL_CASES_MORE } from "./pool-cases-more.data.ts";
import { POOL_CASES_FIRST } from "./pool-cases.data.ts";
import type { PoolCaseInput, PoolStep } from "./pool-fixtures.data.ts";

interface ParamsFile {
  readonly mu0: number;
  readonly levelStep: number;
  readonly sigmaAdmin: number;
  readonly sigmaUnconfirmed: number;
  readonly beta: number;
  readonly tau: number;
  readonly kappa: number;
  readonly limitSigma: boolean;
}

interface Standing {
  readonly mu: number;
  readonly sigma: number;
  readonly matchesRated: number;
}

const TENTHS_PER_LEVEL = 10;
const BASE_LEVEL_TENTHS = 30;
const WINNER_RANK = 1;
const LOSER_RANK = 2;
const A_WINS = [WINNER_RANK, LOSER_RANK];
const B_WINS = [LOSER_RANK, WINNER_RANK];

const PARAMS = JSON.parse(
  readFileSync(new URL("../src/rating-params.json", import.meta.url), "utf8"),
) as ParamsFile;

function rateOnce(
  teams: readonly (readonly Rating[])[],
  rank: readonly number[],
  options: Options,
) {
  return rate(
    teams.map((team) => team.map(({ mu, sigma }) => ({ mu, sigma }))),
    { ...options, model: plackettLuce, rank: [...rank] },
  );
}

function openSkillCase(input: (typeof OPENSKILL_CASES)[number]) {
  const games = input.ranks.reduce<readonly (readonly SkillInput[])[][]>(
    (done, rank) => [...done, rateOnce(done.at(-1) ?? input.teams, rank, input.options)],
    [],
  );
  return { ...input, expected: games };
}

function seedOf(input: PoolCaseInput, memberId: string): Standing {
  const seed = input.seeds.find((candidate) => candidate.memberId === memberId);
  const levelTenths = seed?.levelTenths ?? BASE_LEVEL_TENTHS;
  const mu = PARAMS.mu0 + ((levelTenths - BASE_LEVEL_TENTHS) * PARAMS.levelStep) / TENTHS_PER_LEVEL;
  const sigma = seed?.source === "admin" ? PARAMS.sigmaAdmin : PARAMS.sigmaUnconfirmed;
  return { mu, sigma, matchesRated: 0 };
}

function keyOf(pool: string, memberId: string): string {
  return `${pool} ${memberId}`;
}

function applyStep(input: PoolCaseInput, standings: ReadonlyMap<string, Standing>, step: PoolStep) {
  const current = (memberId: string) =>
    standings.get(keyOf(step.pool, memberId)) ?? seedOf(input, memberId);
  const [ratedA = [], ratedB = []] = rateOnce(
    [step.a.map(current), step.b.map(current)],
    step.winner === "a" ? A_WINS : B_WINS,
    { beta: PARAMS.beta, tau: PARAMS.tau, kappa: PARAMS.kappa, limitSigma: PARAMS.limitSigma },
  );
  const updates = (memberIds: readonly string[], rated: readonly Rating[]) =>
    memberIds.map((memberId, index) => {
      const after = rated[index];
      if (after === undefined) {
        throw new Error(`no rating for ${memberId}`);
      }
      const entry = { ...after, matchesRated: current(memberId).matchesRated + 1 };
      return [keyOf(step.pool, memberId), entry] as const;
    });
  return new Map([...standings, ...updates(step.a, ratedA), ...updates(step.b, ratedB)]);
}

function poolCase(input: PoolCaseInput) {
  const standings = input.steps.reduce<ReadonlyMap<string, Standing>>(
    (current, step) => applyStep(input, current, step),
    new Map(),
  );
  const expected = input.members.flatMap(({ pool, memberIds }) =>
    memberIds.map((memberId) => {
      const seed = input.seeds.find((candidate) => candidate.memberId === memberId);
      const { mu, sigma, matchesRated } =
        standings.get(keyOf(pool, memberId)) ?? seedOf(input, memberId);
      return {
        memberId,
        pool,
        seedTenths: seed?.levelTenths ?? BASE_LEVEL_TENTHS,
        seedSource: seed?.source ?? "default",
        mu,
        sigma,
        matchesRated,
      };
    }),
  );
  return { id: input.id, seeds: input.seeds, rounds: input.rounds, expected };
}

function write(name: string, cases: readonly unknown[]): void {
  writeFileSync(new URL(`../golden/${name}`, import.meta.url), `${JSON.stringify(cases)}\n`);
}

write("openskill-plackett-luce.json", OPENSKILL_CASES.map(openSkillCase));
write("rating-pools.json", [...POOL_CASES_FIRST, ...POOL_CASES_MORE].map(poolCase));
