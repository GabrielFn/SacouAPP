// Proves that the lint rules still reject the known bypasses and accept legitimate code.
// Each case becomes a temporary file (type-aware rules need it on disk), removed at the end.
// The file prefix is in .gitignore, so an interrupted run cannot be committed by accident.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { ESLint } from "eslint";

import { courtLintCases } from "./lib/court-regression.mjs";
import { hermesLintCases } from "./lib/hermes-regression.mjs";
import {
  qualityLintCases,
  runComplexityProbe,
  runDuplicationCases,
} from "./lib/quality-regression.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const PREFIX = "__lint-regression__";
const VOLLEY_RULES = `packages/volley-rules/src/${PREFIX}`;
const MATCH_ENGINE = `packages/match-engine/src/${PREFIX}`;
const RATING = `packages/rating/src/${PREFIX}`;
const MOBILE = `apps/mobile/src/${PREFIX}`;

const NO_ANY = "@typescript-eslint/no-explicit-any";
const NO_MAGIC_NUMBERS = "@typescript-eslint/no-magic-numbers";
const NO_RESTRICTED_IMPORTS = "@typescript-eslint/no-restricted-imports";
const NO_RESTRICTED_SYNTAX = "no-restricted-syntax";
const NO_RESTRICTED_GLOBALS = "no-restricted-globals";
const NO_RESTRICTED_PROPERTIES = "no-restricted-properties";
const NO_LET = "functional/no-let";
const CLEAN = "clean";

const ANY = "export const value: any = 1;\n";
const MAGIC_FUNCTION =
  "export function points(sets: number): number {\n  return sets * 7 + 13;\n}\n";

const CASES = [
  [`${VOLLEY_RULES}any.mts`, ANY, NO_ANY],
  [`${VOLLEY_RULES}any.cts`, ANY, NO_ANY],
  [`${MATCH_ENGINE}magic.mts`, MAGIC_FUNCTION, NO_MAGIC_NUMBERS],
  [`${MATCH_ENGINE}let.cts`, "export let value = 1;\n", NO_LET],

  [`${VOLLEY_RULES}disable.ts`, `/* eslint-disable */\n${ANY}`, NO_ANY],
  [`${VOLLEY_RULES}disable-line.ts`, `// eslint-disable-next-line\n${ANY}`, NO_ANY],
  [`${VOLLEY_RULES}rule-off.ts`, `/* eslint ${NO_ANY}: "off" */\n${ANY}`, NO_ANY],

  [`${MATCH_ENGINE}react.tsx`, 'export { useState } from "react";\n', NO_RESTRICTED_IMPORTS],
  [
    `${MATCH_ENGINE}document.tsx`,
    "export const page: unknown = document;\n",
    NO_RESTRICTED_GLOBALS,
  ],
  [`${MATCH_ENGINE}import-call.ts`, 'export const lazy = import("react");\n', NO_RESTRICTED_SYNTAX],
  [
    `${MATCH_ENGINE}import-type.ts`,
    'export type N = import("react").ReactNode;\n',
    NO_RESTRICTED_SYNTAX,
  ],
  [
    `${MATCH_ENGINE}reference.ts`,
    '/// <reference types="react" />\nexport {};\n',
    "@typescript-eslint/triple-slash-reference",
  ],
  [
    `${MATCH_ENGINE}community.ts`,
    'import "@react-native-community/netinfo";\n',
    NO_RESTRICTED_IMPORTS,
  ],
  [`${MATCH_ENGINE}testing.ts`, 'import "@testing-library/react-native";\n', NO_RESTRICTED_IMPORTS],
  [`${MATCH_ENGINE}apps.ts`, 'import "../../../apps/mobile/App";\n', NO_RESTRICTED_IMPORTS],
  [
    `${VOLLEY_RULES}engine.ts`,
    'import "../../match-engine/src/index.js";\n',
    NO_RESTRICTED_IMPORTS,
  ],
  [`${VOLLEY_RULES}node.ts`, 'import "node:fs";\n', NO_RESTRICTED_IMPORTS],

  [`${VOLLEY_RULES}script.js`, "export const value = 1;\n", NO_RESTRICTED_SYNTAX],
  [`${VOLLEY_RULES}script.mjs`, "export const value = 1;\n", NO_RESTRICTED_SYNTAX],
  [`${VOLLEY_RULES}script.cjs`, "module.exports = {};\n", NO_RESTRICTED_SYNTAX],
  [`${MOBILE}script.js`, "export const value = 1;\n", NO_RESTRICTED_SYNTAX],

  [`${MATCH_ENGINE}eval.ts`, 'export const value: unknown = eval("1");\n', "no-eval"],
  [`${MATCH_ENGINE}new-func.ts`, 'export const value = new Function("return 1");\n', "no-new-func"],
  [`${MOBILE}eval.tsx`, 'export const value: unknown = eval("1");\n', "no-eval"],
  [
    `${MATCH_ENGINE}implied-eval.ts`,
    'export const id = setTimeout("run()");\n',
    "@typescript-eslint/no-implied-eval",
  ],

  [`${VOLLEY_RULES}logic.data.ts`, MAGIC_FUNCTION, NO_RESTRICTED_SYNTAX],
  [`${VOLLEY_RULES}arrow.data.ts`, "export const f = (): number => 7;\n", NO_RESTRICTED_SYNTAX],
  [`packages/volley-rules/src/golden/${PREFIX}runner.ts`, MAGIC_FUNCTION, NO_MAGIC_NUMBERS],

  [`${MATCH_ENGINE}date-now.ts`, "export const now = Date.now();\n", NO_RESTRICTED_GLOBALS],
  [`${MATCH_ENGINE}new-date.ts`, "export const now = new Date();\n", NO_RESTRICTED_GLOBALS],
  [`${RATING}date-now.ts`, "export const now = Date.now();\n", NO_RESTRICTED_GLOBALS],
  [`${RATING}random.ts`, "export const value = Math.random();\n", NO_RESTRICTED_PROPERTIES],
  [`${RATING}node.ts`, 'import "node:fs";\n', NO_RESTRICTED_IMPORTS],
  [`${RATING}magic.ts`, MAGIC_FUNCTION, NO_MAGIC_NUMBERS],
  [`${MATCH_ENGINE}random.ts`, "export const value = Math.random();\n", NO_RESTRICTED_PROPERTIES],
  [
    `${MATCH_ENGINE}random-destructured.ts`,
    "const { random } = Math;\nexport const value = random();\n",
    NO_RESTRICTED_PROPERTIES,
  ],
  [`${MATCH_ENGINE}crypto.ts`, "export const id = crypto.randomUUID();\n", NO_RESTRICTED_GLOBALS],
  [
    `${MATCH_ENGINE}performance.ts`,
    "export const now = performance.now();\n",
    NO_RESTRICTED_GLOBALS,
  ],
  [
    `${MATCH_ENGINE}intl.ts`,
    "export const collator = new Intl.Collator();\n",
    NO_RESTRICTED_GLOBALS,
  ],
  [
    `${MATCH_ENGINE}set-timeout.ts`,
    "export const id = setTimeout(() => undefined);\n",
    NO_RESTRICTED_GLOBALS,
  ],
  [
    `${MATCH_ENGINE}for-let.ts`,
    "for (let index = 0; index < 1; index += 1) {\n  void index;\n}\n",
    NO_LET,
  ],
  [
    `${MATCH_ENGINE}budget.ts`,
    "export function spend(budget: { remaining: number }): void {\n  budget.remaining -= 1;\n}\n",
    "functional/immutable-data",
  ],
  [`${MATCH_ENGINE}clock.test.ts`, "export const now = Date.now();\n", CLEAN],

  [`${VOLLEY_RULES}const.ts`, "export const MAX_SETS = 5;\n", CLEAN],
  [`${VOLLEY_RULES}table.data.ts`, "export const POINTS = [25, 15] as const;\n", CLEAN],
  [`${VOLLEY_RULES}node.test.ts`, 'import "node:fs";\nexport const sets = [5];\n', CLEAN],
  [`${MATCH_ENGINE}rules.ts`, 'import "@sacou/volley-rules";\n', CLEAN],
  [`${MOBILE}react.tsx`, 'export { useState } from "react";\n', CLEAN],
  ...qualityLintCases(PREFIX),
  ...courtLintCases(PREFIX),
  ...hermesLintCases(PREFIX),
].map(([file, code, expected, messagePart]) => ({
  path: resolve(ROOT, file),
  code,
  expected,
  messagePart,
}));

function createFiles(cases) {
  return cases.flatMap(({ path, code }) => {
    const createdDirectory = mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, code);
    return createdDirectory === undefined ? [path] : [path, createdDirectory];
  });
}

function removeFiles(paths) {
  paths.forEach((path) => rmSync(path, { recursive: true, force: true }));
}

// With `messagePart`, the message must also contain it (which no-restricted-syntax entry fired).
function matches({ expected, messagePart }, { ruleId, message }) {
  return ruleId === expected && (messagePart === undefined || message.includes(messagePart));
}

function describeFailure(testCase, messages) {
  const found = messages.map(({ ruleId, message }) => ruleId ?? message).join(", ") || "nothing";
  const { expected, messagePart } = testCase;
  const passed =
    expected === CLEAN ? messages.length === 0 : messages.some((m) => matches(testCase, m));
  const wanted = messagePart === undefined ? expected : `${expected} ("${messagePart}")`;
  return passed ? null : `expected ${wanted}, found ${found}`;
}

async function lintCases(cases) {
  const results = await new ESLint({ cwd: ROOT }).lintFiles(cases.map(({ path }) => path));
  const messagesByPath = new Map(results.map(({ filePath, messages }) => [filePath, messages]));
  return cases.map((testCase) => ({
    path: testCase.path,
    failure: describeFailure(testCase, messagesByPath.get(testCase.path) ?? []),
  }));
}

async function main() {
  const created = createFiles(CASES);
  try {
    const outcomes = await lintCases(CASES);
    const failures = outcomes.filter(({ failure }) => failure !== null);
    failures.forEach(({ path, failure }) => console.error(`FAIL ${path}: ${failure}`));
    console.log(`lint:regression: ${outcomes.length - failures.length}/${outcomes.length} passed.`);
    const probeFailures = [
      ...runDuplicationCases(ROOT, PREFIX),
      ...runComplexityProbe(ROOT, PREFIX),
    ];
    probeFailures.forEach((failure) => console.error(`FAIL ${failure}`));
    console.log(`lint:regression: probes ${probeFailures.length === 0 ? "passed" : "failed"}.`);
    process.exitCode = failures.length === 0 && probeFailures.length === 0 ? 0 : 1;
  } finally {
    removeFiles(created);
  }
}

await main();
