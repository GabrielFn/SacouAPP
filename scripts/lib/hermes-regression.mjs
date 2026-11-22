// ESLint cases for the ES2023+ built-ins the Hermes of the phone lacks (R98, item 10).
const NO_RESTRICTED_PROPERTIES = "no-restricted-properties";
const CLEAN = "clean";
const HERMES = "Hermes";

/** Cases as `[file, code, expected rule or "clean", part of the message]`, relative to the root. */
export function hermesLintCases(prefix) {
  const home = `apps/mobile/src/features/groups/${prefix}`;
  const court = `apps/mobile/src/features/court/${prefix}`;
  const theme = `apps/mobile/src/theme/${prefix}`;
  const sorted = "export const sorted = [3, 1].toSorted((a, b) => a - b);\n";
  return [
    [`${home}to-sorted.ts`, sorted, NO_RESTRICTED_PROPERTIES, HERMES],
    [`${court}to-sorted.ts`, sorted, NO_RESTRICTED_PROPERTIES, HERMES],
    [`${theme}to-sorted.ts`, sorted, NO_RESTRICTED_PROPERTIES, HERMES],
    [
      `${home}find-last.ts`,
      "export const last = [1, 2].findLast((n) => n > 1);\n",
      NO_RESTRICTED_PROPERTIES,
      HERMES,
    ],
    [
      `${home}group-by.ts`,
      "export const groups = Object.groupBy([1], (n) => String(n));\n",
      NO_RESTRICTED_PROPERTIES,
      HERMES,
    ],
    [
      `${home}resolvers.ts`,
      "export const waiting = Promise.withResolvers<number>();\n",
      NO_RESTRICTED_PROPERTIES,
      HERMES,
    ],
    [`${home}sorted.test.ts`, sorted, CLEAN],
    [`${home}at.ts`, "export const first = [1, 2].at(0);\n", CLEAN],
    [`${home}sort-copy.ts`, "export const sorted = [...[3, 1]].sort((a, b) => a - b);\n", CLEAN],
  ];
}
