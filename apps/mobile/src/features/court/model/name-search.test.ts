import { describe, expect, test } from "vitest";

import { pickCompatible } from "./name-search";

const clash = (a: number, b: number) => a === b;

describe("picking one candidate of each choice", () => {
  test("takes the first candidates when they fit together", () => {
    expect(pickCompatible([[1, 2], [3], [4]], clash)).toEqual([1, 3, 4]);
  });

  test("an earlier choice takes its next candidate when a later one is left without room", () => {
    expect(pickCompatible([[1, 2], [1]], clash)).toEqual([2, 1]);
  });

  test("gives up when nothing fits or the budget runs out", () => {
    expect(pickCompatible([[1], [1]], clash)).toBeNull();
    expect(pickCompatible([[1, 2], [1]], clash, 1)).toBeNull();
  });
});
