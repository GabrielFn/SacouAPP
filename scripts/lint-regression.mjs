// Proves that the lint rules still reject the known bypasses and accept legitimate code.
// Each case becomes a temporary file (type-aware rules need it on disk), removed at the end.
// The file prefix is in .gitignore, so an interrupted run cannot be committed by accident.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { ESLint } from "eslint";

const ROOT = resolve(import.meta.dirname, "..");
const PREFIX = "__lint-regression__";
const VOLLEY_RULES = `packages/volley-rules/src/${PREFIX}`;
const MATCH_ENGINE = `packages/match-engine/src/${PREFIX}`;
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

// App boundaries, components and styles (ADR 0034). Folders with the prefix are removed at the end.
const UI = `apps/mobile/src/ui/${PREFIX}`;
const TOKENS = `apps/mobile/src/ui/tokens/${PREFIX}`;
const ROUTES = `apps/mobile/src/app/${PREFIX}`;
const FEATURE = `${PREFIX}court`;
const FEATURE_ROOT = `apps/mobile/src/features/${FEATURE}`;

const NO_MULTI_COMP = "react/no-multi-comp";
const COMPLEXITY = "complexity";
const MAX_LINES = "max-lines";
const MAX_FUNCTION_LINES = "max-lines-per-function";

const FILE_LIMIT = 300;
const COMPONENT_FILE_LIMIT = 200;
const TEST_FILE_LIMIT = 800;
const FUNCTION_LIMIT = 50;
const COMPONENT_FUNCTION_LIMIT = 80;
const COMPLEXITY_LIMIT = 10;
const DEPTH_LIMIT = 4;
const PARAMS_LIMIT = 4;
const CALLBACKS_LIMIT = 3;

const range = (count) => Array.from({ length: count }, (_, index) => index);

// Blank lines and comments do not count, so each file carries some of both.
const fileOfLines = (count) =>
  `// ${count} lines of code\n\n${range(count)
    .map((index) => `export const v${index} = "${index}";`)
    .join("\n")}\n`;

// The header, `return [`, `];` and `}` are 4 of the lines.
const FUNCTION_FRAME_LINES = 4;
const functionOfLines = (count) =>
  `export function long(): readonly string[] {\n  return [\n${range(count - FUNCTION_FRAME_LINES)
    .map((index) => `    "${index}",`)
    .join("\n")}\n  ];\n}\n`;

// Each || adds one path to the one of the function.
const functionOfComplexity = (complexity) =>
  `export function isKnown(code: string): boolean {\n  return ${range(complexity)
    .map((index) => `code === "${index}"`)
    .join(" || ")};\n}\n`;

const functionOfDepth = (depth) =>
  `export function deep(code: string): string {\n${range(depth)
    .map((index) => `if (code !== "${index}") {`)
    .join("\n")}\nreturn code;\n${"}\n".repeat(depth)}return "";\n}\n`;

const functionOfParams = (count) => {
  const names = range(count).map((index) => `p${index}`);
  return `export function join(${names.map((name) => `${name}: string`).join(", ")}): string {\n  return [${names.join(", ")}].join("");\n}\n`;
};

const callbacksOfDepth = (depth) => {
  const names = range(depth).map((index) => `c${index}`);
  const calls = names.reduceRight((inner, name) => `.map((${name}) => ${name}${inner})`, "");
  return `export const nested = ${"[".repeat(depth)}"x"${"]".repeat(depth)}${calls};\n`;
};

const TWO_COMPONENTS =
  'import { Text } from "react-native";\n\nexport function Title() {\n  return <Label />;\n}\n\nfunction Label() {\n  return <Text>Sacou</Text>;\n}\n';
const ONE_COMPONENT =
  'import { Text } from "react-native";\n\nexport function Title() {\n  return <Text>Sacou</Text>;\n}\n';
const INLINE_STYLE_COMPONENT =
  'import { View } from "react-native";\n\nexport function Box() {\n  return <View style={{ flex: 1 }} />;\n}\n';
const INLINE_STYLE_IN_ARRAY =
  'import { StyleSheet, View } from "react-native";\n\nconst styles = StyleSheet.create({ box: { flex: 1 } });\n\nexport function Box() {\n  return <View style={[styles.box, { flex: 1 }]} />;\n}\n';
const SHEET_STYLE_COMPONENT =
  'import { StyleSheet, View } from "react-native";\n\nconst styles = StyleSheet.create({ box: { flex: 1 } });\n\nexport function Box() {\n  return <View style={styles.box} />;\n}\n';

const APP_CASES = [
  [`${UI}feature.ts`, 'import "@/features/court/hooks/useScore";\n', NO_RESTRICTED_IMPORTS],
  [`${UI}lib.ts`, 'import "@/lib/query";\n', NO_RESTRICTED_IMPORTS],
  [`${UI}route.ts`, 'import "@/app/index";\n', NO_RESTRICTED_IMPORTS],
  [
    `${UI}clean.ts`,
    'import "@/strings/pt-BR";\nexport { Pressable } from "react-native";\n',
    CLEAN,
  ],
  [
    `${FEATURE_ROOT}/hooks/other.ts`,
    'import "@/features/queue/hooks/useQueue";\n',
    NO_RESTRICTED_IMPORTS,
  ],
  [
    `${FEATURE_ROOT}/hooks/parent.ts`,
    'import "../../queue/hooks/useQueue";\n',
    NO_RESTRICTED_IMPORTS,
  ],
  [`${FEATURE_ROOT}/hooks/dot-parent.ts`, 'import "./../state/store";\n', NO_RESTRICTED_IMPORTS],
  [
    `${FEATURE_ROOT}/hooks/own.ts`,
    `import "@/features/${FEATURE}/api/client";\nimport "@/lib/query";\nimport "@/ui/Button";\n`,
    CLEAN,
  ],
  [`${FEATURE_ROOT}/hooks/sibling.ts`, 'import "./own";\n', CLEAN],
  [
    `${FEATURE_ROOT}/screens/api.ts`,
    `import "@/features/${FEATURE}/api/client";\n`,
    NO_RESTRICTED_IMPORTS,
  ],
  [`${FEATURE_ROOT}/components/lib.ts`, 'import "@/lib/query";\n', NO_RESTRICTED_IMPORTS],
  [
    `${FEATURE_ROOT}/screens/hooks.ts`,
    `import "@/features/${FEATURE}/hooks/useScore";\nimport "@/ui/Button";\n`,
    CLEAN,
  ],
  [`${ROUTES}ui.tsx`, 'import "@/ui/Button";\n', NO_RESTRICTED_IMPORTS],
  [`${ROUTES}hooks.tsx`, 'import "@/features/court/hooks/useScore";\n', NO_RESTRICTED_IMPORTS],
  [`${ROUTES}screen.tsx`, 'import "@/features/court/screens/CourtScreen";\n', CLEAN],

  [`${MOBILE}two.tsx`, TWO_COMPONENTS, NO_MULTI_COMP],
  [`${MOBILE}one.tsx`, ONE_COMPONENT, CLEAN],

  [`${MOBILE}inline.tsx`, INLINE_STYLE_COMPONENT, NO_RESTRICTED_SYNTAX],
  [`${MOBILE}inline-array.tsx`, INLINE_STYLE_IN_ARRAY, NO_RESTRICTED_SYNTAX],
  [`${TOKENS}inline.tsx`, INLINE_STYLE_COMPONENT, NO_RESTRICTED_SYNTAX],
  [`${MOBILE}sheet.tsx`, SHEET_STYLE_COMPONENT, CLEAN],
  [`${MOBILE}hex.ts`, 'export const accent = "#FF5A1F";\n', NO_RESTRICTED_SYNTAX],
  [`${MOBILE}hex-short.ts`, 'export const ink = "#fff";\n', NO_RESTRICTED_SYNTAX],
  [`${MOBILE}rgba.ts`, 'export const shade = "rgba(0, 0, 0, 0.5)";\n', NO_RESTRICTED_SYNTAX],
  [`${MOBILE}hsl.ts`, "export const tone = `hsl(20, 100%, 56%)`;\n", NO_RESTRICTED_SYNTAX],
  [`${MOBILE}hex.data.ts`, 'export const ACCENT = "#FF5A1F";\n', NO_RESTRICTED_SYNTAX],
  [`${UI}hex.ts`, 'export const accent = "#FF5A1F";\n', NO_RESTRICTED_SYNTAX],
  [`${MOBILE}text.ts`, 'export const label = "Rodada #12";\n', CLEAN],
  [`${TOKENS}colors.ts`, 'export const ink = "#0F1B2D";\n', CLEAN],
  [`${TOKENS}colors.data.ts`, 'export const SHADE = "rgba(15, 27, 45, 0.5)";\n', CLEAN],

  [`${MOBILE}pressable.ts`, 'export { Pressable } from "react-native";\n', NO_RESTRICTED_IMPORTS],
  [
    `${MOBILE}touchable.ts`,
    'export { TouchableOpacity } from "react-native-gesture-handler";\n',
    NO_RESTRICTED_IMPORTS,
  ],
  [
    `${MOBILE}namespace.ts`,
    'import * as RN from "react-native";\nexport { RN };\n',
    NO_RESTRICTED_IMPORTS,
  ],
  [`${ROUTES}pressable.tsx`, 'export { Pressable } from "react-native";\n', NO_RESTRICTED_IMPORTS],
  [
    `${FEATURE_ROOT}/screens/pressable.tsx`,
    'export { Pressable } from "react-native";\n',
    NO_RESTRICTED_IMPORTS,
  ],
];

// Size and complexity (ADR 0034): the limit passes and one more fails.
const METRIC_CASES = [
  [`${MATCH_ENGINE}complex.ts`, functionOfComplexity(COMPLEXITY_LIMIT + 1), COMPLEXITY],
  [`${MATCH_ENGINE}simple.ts`, functionOfComplexity(COMPLEXITY_LIMIT), CLEAN],
  [`${MATCH_ENGINE}complex.test.ts`, functionOfComplexity(COMPLEXITY_LIMIT + 1), CLEAN],
  [`${MOBILE}complex.tsx`, functionOfComplexity(COMPLEXITY_LIMIT + 1), COMPLEXITY],

  [`${VOLLEY_RULES}long-file.ts`, fileOfLines(FILE_LIMIT + 1), MAX_LINES],
  [`${VOLLEY_RULES}file.ts`, fileOfLines(FILE_LIMIT), CLEAN],
  [`${VOLLEY_RULES}long-file.data.ts`, fileOfLines(FILE_LIMIT + 1), MAX_LINES],
  [`${MOBILE}long-file.tsx`, fileOfLines(COMPONENT_FILE_LIMIT + 1), MAX_LINES],
  [`${MOBILE}file.tsx`, fileOfLines(COMPONENT_FILE_LIMIT), CLEAN],
  [`${VOLLEY_RULES}long-file.test.ts`, fileOfLines(TEST_FILE_LIMIT + 1), MAX_LINES],
  [`${VOLLEY_RULES}file.test.ts`, fileOfLines(TEST_FILE_LIMIT), CLEAN],

  [`${MATCH_ENGINE}long-function.ts`, functionOfLines(FUNCTION_LIMIT + 1), MAX_FUNCTION_LINES],
  [`${MATCH_ENGINE}function.ts`, functionOfLines(FUNCTION_LIMIT), CLEAN],
  [`${MOBILE}long-function.tsx`, functionOfLines(COMPONENT_FUNCTION_LIMIT + 1), MAX_FUNCTION_LINES],
  [`${MOBILE}function.tsx`, functionOfLines(COMPONENT_FUNCTION_LIMIT), CLEAN],
  [`${MATCH_ENGINE}long-function.test.ts`, functionOfLines(COMPONENT_FUNCTION_LIMIT + 1), CLEAN],

  [`${MATCH_ENGINE}deep.ts`, functionOfDepth(DEPTH_LIMIT + 1), "max-depth"],
  [`${MATCH_ENGINE}shallow.ts`, functionOfDepth(DEPTH_LIMIT), CLEAN],
  [`${MATCH_ENGINE}params.ts`, functionOfParams(PARAMS_LIMIT + 1), "@typescript-eslint/max-params"],
  [`${MATCH_ENGINE}few-params.ts`, functionOfParams(PARAMS_LIMIT), CLEAN],
  [`${MATCH_ENGINE}callbacks.ts`, callbacksOfDepth(CALLBACKS_LIMIT + 1), "max-nested-callbacks"],
  [`${MATCH_ENGINE}few-callbacks.ts`, callbacksOfDepth(CALLBACKS_LIMIT), CLEAN],
  [`${MATCH_ENGINE}callbacks.test.ts`, callbacksOfDepth(CALLBACKS_LIMIT + 1), CLEAN],
];

const CASES = [
  ...APP_CASES,
  ...METRIC_CASES,
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
].map(([file, code, expected]) => ({ path: resolve(ROOT, file), code, expected }));

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

function describeFailure({ expected }, messages) {
  const found = messages.map(({ ruleId, message }) => ruleId ?? message).join(", ") || "nothing";
  const passed =
    expected === CLEAN ? messages.length === 0 : messages.some((m) => m.ruleId === expected);
  return passed ? null : `expected ${expected}, found ${found}`;
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
    process.exitCode = failures.length === 0 ? 0 : 1;
  } finally {
    removeFiles(created);
  }
}

await main();
