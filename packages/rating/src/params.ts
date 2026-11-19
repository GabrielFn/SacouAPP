import rawParams from "./rating-params.json" with { type: "json" };
import type { RatingParams } from "./types.js";

type UnknownRecord = Readonly<Record<string, unknown>>;

const NUMBER_KEYS = [
  "ratingParamsVersion",
  "mu0",
  "levelStep",
  "sigmaAdmin",
  "sigmaUnconfirmed",
  "beta",
  "tau",
  "kappa",
] as const;

function fail(key: string, expected: string): never {
  throw new Error(`Invalid rating parameters at "${key}": expected ${expected}.`);
}

function readObject(raw: unknown): UnknownRecord {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw)
    ? (raw as UnknownRecord)
    : fail("$", "an object");
}

function readPositive(source: UnknownRecord, key: string): number {
  const value = source[key];
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fail(key, "a positive number");
}

/**
 * Reads the shared parameters file (also embedded in the C# port). A broken file is a build
 * defect, not a business rule, so it throws when the module loads, like the formation catalog.
 */
export function parseRatingParams(raw: unknown): RatingParams {
  const source = readObject(raw);
  const numbers = Object.fromEntries(NUMBER_KEYS.map((key) => [key, readPositive(source, key)]));
  const limitSigma = source.limitSigma;
  if (typeof limitSigma !== "boolean") {
    return fail("limitSigma", "a boolean");
  }
  if (!Number.isInteger(numbers.ratingParamsVersion)) {
    return fail("ratingParamsVersion", "an integer");
  }
  return Object.freeze({ ...(numbers as Omit<RatingParams, "limitSigma">), limitSigma });
}

/** The parameters in use: `rating-params.json`, version 1, to calibrate with the pilot. */
export const RATING_PARAMS: RatingParams = parseRatingParams(rawParams);
