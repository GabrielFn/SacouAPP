// Cases of the quality gates (ADR 0035) for scripts/lint-regression.mjs: ESLint cases for size,
// complexity and the front-end rules, plus probes that run jscpd and dotnet on planted files.
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const COMPLEXITY = "complexity";
const MAX_LINES = "max-lines";
const NO_RESTRICTED_SYNTAX = "no-restricted-syntax";
const NO_RESTRICTED_IMPORTS = "@typescript-eslint/no-restricted-imports";
const SWITCH_EXHAUSTIVENESS = "@typescript-eslint/switch-exhaustiveness-check";
const CLEAN = "clean";

// Fragments of the no-restricted-syntax messages, so each case proves which selector fired.
const COLOR = "Colors come from the theme";
const SIZE = "Sizes in styles come from tokens";
const PROPS = "Component props are an exported interface";
const DEFAULT = "a default case hides a new one";
const DATA = "Data files hold data only";
const SDK = "Device and service SDKs";

const LIMIT = 300;
const TEST_LIMIT = 600;
// One more branch than the limit of 10, in ESLint and in CA1502.
const BRANCHES = 11;

/** `count` lines that pass every other rule. */
function linesOfCode(count) {
  return Array.from(
    { length: count },
    (_, index) => `export const LINE_${index} = "${index}";\n`,
  ).join("");
}

const ELEVEN_BRANCHES = `export function grade(value: string): string {
${Array.from({ length: BRANCHES }, (_, index) => `  if (value === "v${index}") return "g${index}";\n`).join("")}  return "none";
}
`;

const REDUCER_WITH_DEFAULT = `type CounterAction = { readonly type: "add" } | { readonly type: "reset" };
export function counterReducer(state: number, action: CounterAction): number {
  switch (action.type) {
    case "add":
      return state + 1;
    default:
      return state;
  }
}
`;

const REDUCER_MISSING_CASE = `type CounterAction = { readonly type: "add" } | { readonly type: "reset" };
export function counterReducer(state: number, action: CounterAction): number {
  switch (action.type) {
    case "add":
      return state + 1;
  }
  return state;
}
`;

/**
 * ESLint cases as `[file, code, expected rule or "clean", message fragment?]`, relative to the
 * root.
 */
export function qualityLintCases(prefix) {
  const engine = `packages/match-engine/src/${prefix}`;
  const mobile = `apps/mobile/src/${prefix}`;
  const ui = `apps/mobile/src/ui/${prefix}`;
  const theme = `apps/mobile/src/theme/${prefix}`;
  return [
    [`${engine}complex.ts`, ELEVEN_BRANCHES, COMPLEXITY],
    [`${engine}complex.test.ts`, ELEVEN_BRANCHES, CLEAN],
    [`${engine}long.ts`, linesOfCode(LIMIT + 1), MAX_LINES],
    [`${engine}at-limit.ts`, linesOfCode(LIMIT), CLEAN],
    [`${engine}long.test.ts`, linesOfCode(TEST_LIMIT + 1), MAX_LINES],
    [`${engine}at-limit.test.ts`, linesOfCode(TEST_LIMIT), CLEAN],
    [`scripts/${prefix}long.mjs`, linesOfCode(LIMIT + 1), MAX_LINES],

    [`${ui}hex.ts`, 'export const color = "#FF5A1F";\n', NO_RESTRICTED_SYNTAX, COLOR],
    [`${ui}hex-template.ts`, "export const color = `#fff`;\n", NO_RESTRICTED_SYNTAX, COLOR],
    [`${ui}rgb.ts`, 'export const color = "rgba(0, 0, 0, 0.5)";\n', NO_RESTRICTED_SYNTAX, COLOR],
    [
      `${ui}sheet.ts`,
      'import { StyleSheet } from "react-native";\nexport const styles = StyleSheet.create({ box: { padding: 8 } });\n',
      NO_RESTRICTED_SYNTAX,
      SIZE,
    ],
    [
      `${ui}inline-style.tsx`,
      'import { View } from "react-native";\nexport function Box() {\n  return <View style={{ width: 120 }} />;\n}\n',
      NO_RESTRICTED_SYNTAX,
      SIZE,
    ],
    [
      `${ui}flex.tsx`,
      'import { View } from "react-native";\nexport function Box() {\n  return <View style={{ flex: 1 }} />;\n}\n',
      CLEAN,
    ],
    [`${ui}haptics.ts`, 'import "expo-haptics";\n', NO_RESTRICTED_IMPORTS],
    [
      `${ui}storage.ts`,
      'import "@react-native-async-storage/async-storage";\n',
      NO_RESTRICTED_IMPORTS,
    ],
    [`${ui}expo.ts`, 'import "expo/fetch";\n', NO_RESTRICTED_IMPORTS],
    [`${ui}font.ts`, 'import "expo-font";\n', NO_RESTRICTED_IMPORTS],
    [`${ui}font-lazy.ts`, 'export const font = import("expo-font");\n', NO_RESTRICTED_SYNTAX, SDK],
    [
      `${ui}font-require.ts`,
      'declare const require: (id: string) => unknown;\nexport const font = require("expo-font");\n',
      NO_RESTRICTED_SYNTAX,
      SDK,
    ],
    [`${ui}router-lazy.ts`, 'export const router = import("expo-router");\n', CLEAN],
    [
      `apps/mobile/src/adapters/${prefix}font-lazy.ts`,
      'export const font = import("expo-font");\n',
      CLEAN,
    ],
    // An installed SDK, so import/no-unresolved stays quiet: the adapters are free.
    [`apps/mobile/src/adapters/${prefix}font.ts`, 'import "expo-font";\n', CLEAN],
    [`apps/mobile/src/app/${prefix}screen.ts`, 'export { Stack } from "expo-router";\n', CLEAN],
    [
      `${ui}type-props.ts`,
      "export type ButtonProps = { readonly label: string };\n",
      NO_RESTRICTED_SYNTAX,
      PROPS,
    ],
    [
      `${ui}interface-props.ts`,
      'interface ButtonProps {\n  readonly label: string;\n}\nexport const props: ButtonProps = { label: "" };\n',
      NO_RESTRICTED_SYNTAX,
      PROPS,
    ],
    [
      `${ui}inline-props.tsx`,
      "export function Button({ label }: { readonly label: string }) {\n  return label;\n}\n",
      NO_RESTRICTED_SYNTAX,
      PROPS,
    ],
    [
      `${ui}exported-props.tsx`,
      "export interface ButtonProps {\n  readonly label: string;\n}\nexport function Button({ label }: ButtonProps) {\n  return label;\n}\n",
      CLEAN,
    ],
    [`${mobile}counter.reducer.ts`, REDUCER_WITH_DEFAULT, NO_RESTRICTED_SYNTAX, DEFAULT],
    [`${mobile}missing.reducer.ts`, REDUCER_MISSING_CASE, SWITCH_EXHAUSTIVENESS],
    [`${theme}palette.data.ts`, 'export const ORANGE = "#FF5A1F";\n', CLEAN],
    [
      `${theme}logic.data.ts`,
      'export const f = (): string => "#fff";\n',
      NO_RESTRICTED_SYNTAX,
      DATA,
    ],
    [`${mobile}colors.data.ts`, 'export const ORANGE = "#FF5A1F";\n', NO_RESTRICTED_SYNTAX, COLOR],
    [`${mobile}logic.data.ts`, 'export const f = (): string => "a";\n', NO_RESTRICTED_SYNTAX, DATA],
  ];
}

function writeFiles(directory, files) {
  mkdirSync(directory, { recursive: true });
  Object.entries(files).forEach(([name, code]) => writeFileSync(join(directory, name), code));
}

// No shell: it would split a node path with spaces ("C:\Program Files\...") and fail every case.
function run(command, args, cwd) {
  return spawnSync(command, args, { cwd, encoding: "utf8" });
}

// A filter and a reduction: 71 tokens in TypeScript and 65 in C# (jscpd 5.4.2), above the limit
// of 50; the short ones stay under it.
const TS_LONG = (
  name,
) => `export function ${name}(values: readonly number[], limit: number): number {
  const kept = values.filter((value) => value > limit && value < limit * 2);
  const total = kept.reduce((sum, value) => sum + value, 0);
  return total > limit ? total - limit : limit - total;
}
`;
const TS_SHORT = (
  name,
) => `export function ${name}(values: readonly number[], limit: number): number {
  return values.filter((value) => value > limit).length;
}
`;
const CS_LONG = (name) => `namespace Probe;

internal static class ${name}
{
    public static int Sum(int[] values, int limit)
    {
        var kept = values.Where(value => value > limit && value < limit * 2).ToArray();
        var total = kept.Sum();
        return total > limit ? total - limit : limit - total;
    }
}
`;

const CS_SHORT = (name) => `namespace Probe;

internal static class ${name}
{
    public static int Count(int[] values, int limit)
    {
        return values.Count(value => value > limit);
    }
}
`;

const DUPLICATION_CASES = [
  {
    name: "TypeScript, 60 tokens",
    files: { "a.ts": TS_LONG("first"), "b.ts": TS_LONG("second") },
    fails: true,
  },
  {
    name: "TypeScript, 40 tokens",
    files: { "a.ts": TS_SHORT("first"), "b.ts": TS_SHORT("second") },
    fails: false,
  },
  {
    name: "C#, 60 tokens",
    files: { "A.cs": CS_LONG("First"), "B.cs": CS_LONG("Second") },
    fails: true,
  },
  {
    name: "C#, 40 tokens",
    files: { "A.cs": CS_SHORT("First"), "B.cs": CS_SHORT("Second") },
    fails: false,
  },
];

/** Runs check-duplication.mjs on planted clones; returns the failures. */
export function runDuplicationCases(root, prefix) {
  const directory = resolve(root, `${prefix}duplication`);
  return DUPLICATION_CASES.flatMap(({ name, files, fails }) => {
    try {
      writeFiles(directory, files);
      const result = run(process.execPath, ["scripts/check-duplication.mjs", directory], root);
      // A failure only counts when jscpd reported the clone, not when the command broke.
      const reported = result.status === 1 && (result.stderr ?? "").includes(" clone of ");
      return (fails ? reported : result.status === 0)
        ? []
        : [
            `duplication (${name}): expected ${fails ? "a failure" : "a pass"}, got ${result.status}`,
          ];
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}

const PROBE_PROJECT = `<Project Sdk="Microsoft.NET.Sdk">
    <PropertyGroup>
        <RestorePackagesWithLockFile>false</RestorePackagesWithLockFile>
        <RestoreLockedMode>false</RestoreLockedMode>
    </PropertyGroup>
</Project>
`;

const PROBE_CODE = `namespace Probe;

internal static class Branchy
{
    public static string Grade(string value)
    {
${Array.from({ length: BRANCHES }, (_, index) => `        if (value == "v${index}")\n        {\n            return "g${index}";\n        }\n`).join("\n")}
        return "none";
    }
}
`;

/** Builds a planted method with 11 branches; the build must fail with CA1502. Never skipped. */
export function runComplexityProbe(root, prefix) {
  const directory = resolve(root, `apps/api/${prefix}probe`);
  try {
    writeFiles(directory, { "Probe.csproj": PROBE_PROJECT, "Probe.cs": PROBE_CODE });
    const result = run("dotnet", ["build", "Probe.csproj", "-nologo"], directory);
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    return result.status !== 0 && output.includes("CA1502")
      ? []
      : [`CA1502 probe: expected the build to fail with CA1502, got ${result.status}`];
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
