// The Hermes of the phone has no ES2023+ built-ins: `toSorted` broke the home on the device (R98,
// item 10). The app's tsconfig stops at ES2022, and these rules catch a method a library's `.d.ts`
// may bring back. A static method is matched on its object; an instance one on any object.
const HERMES_MESSAGE =
  "The Hermes of the phone has no ES2023+ built-ins (R98). Use an ES2022 equivalent.";

const INSTANCE_METHODS = [
  // Array
  "toSorted",
  "toReversed",
  "toSpliced",
  "with",
  "findLast",
  "findLastIndex",
  // String
  "isWellFormed",
  "toWellFormed",
  // Set
  "union",
  "intersection",
  "difference",
  "symmetricDifference",
  "isSubsetOf",
  "isSupersetOf",
  "isDisjointFrom",
  // ArrayBuffer
  "transfer",
  "resize",
];

const STATIC_METHODS = [
  ["Array", "fromAsync"],
  ["Object", "groupBy"],
  ["Map", "groupBy"],
  ["Promise", "withResolvers"],
  ["Atomics", "waitAsync"],
];

/** Entries of `no-restricted-properties`; a later block replaces the rule, so callers merge them. */
export const HERMES_MISSING_PROPERTIES = [
  ...INSTANCE_METHODS.map((property) => ({ property, message: HERMES_MESSAGE })),
  ...STATIC_METHODS.map(([object, property]) => ({ object, property, message: HERMES_MESSAGE })),
];

/** The whole app, tests aside (they run on Node, which has these methods). */
export function hermesBlocks({ files, testFiles }) {
  return [
    {
      files,
      ignores: testFiles,
      rules: { "no-restricted-properties": ["error", ...HERMES_MISSING_PROPERTIES] },
    },
  ];
}
