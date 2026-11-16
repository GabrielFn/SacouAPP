import type { IdGenerator } from "../services/id/id-generator";

const ID_DIGITS = 12;
const ID_PREFIX = "00000000-0000-4000-8000-";

/** Deterministic ids for tests: 000000000001, 000000000002, ... in the shape of a v4 UUID. */
export function createSequentialIdGenerator(): IdGenerator {
  const counter = { value: 0 };
  return {
    newId() {
      counter.value += 1;
      return `${ID_PREFIX}${String(counter.value).padStart(ID_DIGITS, "0")}`;
    },
  };
}
