import { rate, type Gamma, type Options } from "openskill";
import { plackettLuce } from "openskill/models";

import type { RatingParams, Skill } from "./types.js";

/** Two teams, as the court has. */
export type TwoTeams<T> = readonly [readonly T[], readonly T[]];

/** `rank` of each team: 1 wins, 2 loses (a draw would be equal ranks, left for calibration). */
export type TwoRanks = readonly [number, number];

/**
 * γ of Weng-Lin, written here so nothing depends on a default of the library: `√σ²ᵢ / c`, the
 * value `openskill` uses, and the one the C# port implements.
 */
const gamma: Gamma = (c, _teamCount, _mu, sigmaSquared) => Math.sqrt(sigmaSquared) / c;

/**
 * Every option of `rate()` that the Plackett-Luce model reads, explicit (ADR 0071). `mu` and
 * `sigma` only fill in a missing rating, which never happens here; `balance` stays off, so `z`,
 * `alpha` and `target` are never read.
 */
function optionsOf(params: RatingParams, rank: TwoRanks): Options {
  return {
    model: plackettLuce,
    rank: [...rank],
    mu: params.mu0,
    sigma: params.sigmaUnconfirmed,
    beta: params.beta,
    tau: params.tau,
    kappa: params.kappa,
    limitSigma: params.limitSigma,
    balance: false,
    gamma,
  };
}

/** One match through OpenSkill's Plackett-Luce. The input is not changed. */
export function rateTwoTeams(
  params: RatingParams,
  teams: TwoTeams<Skill>,
  rank: TwoRanks,
): TwoTeams<Skill> {
  const [a, b] = rate([teams[0].map(copy), teams[1].map(copy)] as const, optionsOf(params, rank));
  return [a.map(copy), b.map(copy)];
}

function copy(skill: Skill): Skill {
  return { mu: skill.mu, sigma: skill.sigma };
}
