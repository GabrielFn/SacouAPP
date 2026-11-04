import { expect } from "vitest";

export function expectUniqueIds(cases: readonly { readonly id: string }[]) {
  const ids = cases.map(({ id }) => id);
  expect(new Set(ids).size).toBe(ids.length);
}

export function expectExactIds(
  cases: readonly { readonly id: string }[],
  expected: readonly string[],
) {
  const ids = new Set(cases.map(({ id }) => id));
  const allowed = new Set(expected);
  expect({
    missing: expected.filter((id) => !ids.has(id)),
    unexpected: [...ids].filter((id) => !allowed.has(id)),
  }).toStrictEqual({ missing: [], unexpected: [] });
}
