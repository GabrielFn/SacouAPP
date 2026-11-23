import { builtinModules } from "node:module";

import eslint from "@eslint/js";
import prettier from "eslint-config-prettier";
import expo from "eslint-config-expo/flat.js";
import functional from "eslint-plugin-functional";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

import { hermesBlocks } from "./scripts/lib/eslint-hermes-rules.mjs";
import { mobileFrontendBlocks } from "./scripts/lib/eslint-mobile-rules.mjs";
import { webPageBlocks } from "./scripts/lib/eslint-web-rules.mjs";
import { exceptedPaths, loadQualityExceptions } from "./scripts/lib/quality-exceptions.mjs";

const TS_EXTENSIONS = "{ts,tsx,mts,cts}";
const TYPESCRIPT_FILES = [`**/*.${TS_EXTENSIONS}`];
const MOBILE_FILES = [`apps/mobile/**/*.${TS_EXTENSIONS}`];
const TEST_FILES = [`**/*.test.${TS_EXTENSIONS}`];
const PURE_PACKAGE_FILES = [
  `packages/{match-engine,rating,volley-rules}/src/**/*.${TS_EXTENSIONS}`,
];
// The engine replays and the rating rebuilds from scratch: both must give the same result every time.
const DETERMINISTIC_FILES = [`packages/{match-engine,rating}/src/**/*.${TS_EXTENSIONS}`];
const VOLLEY_RULES_FILES = [`packages/volley-rules/src/**/*.${TS_EXTENSIONS}`];
const DATA_FILES = ["**/*.data.{ts,mts,cts}"];
const FORBIDDEN_JAVASCRIPT_FILES = ["{packages/*,apps/mobile,apps/web}/src/**/*.{js,jsx,cjs,mjs}"];
const TOOLING_FILES = ["eslint.config.mjs", "scripts/**/*.{js,cjs,mjs}"];
const LONG_FILES = ["**/*.test.*", "**/*.test.fixture.ts"];

// Quality gates (ADR 0035). Thresholds live here; exceptions only in scripts/quality-exceptions.json.
const MAX_COMPLEXITY = 10;
const MAX_LINES = 300;
const MAX_LINES_IN_TESTS = 600;
const QUALITY_EXCEPTIONS = loadQualityExceptions();

const MAGIC_NUMBER_OPTIONS = {
  ignore: [-1, 0, 1],
  enforceConst: true,
  ignoreArrayIndexes: true,
  detectObjects: false,
};

const FORBIDDEN_IN_PURE_PACKAGES = [
  {
    regex: "^(react|expo)|^@(expo|react-native|react-native-community|testing-library)/",
    message: "Pure packages cannot depend on React, Expo, React Native or their test tools.",
  },
  {
    regex: "^@sacou/mobile(/|$)|^\\.{1,2}/(.*/)?apps(/|$)",
    message: "Pure packages cannot depend on the apps.",
  },
  {
    regex: `^node:|^(${builtinModules.filter((name) => !name.startsWith("_")).join("|")})(/|$)`,
    message: "Pure packages cannot depend on Node.js built-in modules.",
  },
];

const FORBIDDEN_MATCH_ENGINE_IMPORT = {
  regex: "^@sacou/match-engine(/|$)|^\\.{1,2}/(.*/)?match-engine(/|$)",
  message: "volley-rules is the lowest layer and cannot depend on match-engine.",
};

const FORBIDDEN_GLOBALS = [
  "window",
  "document",
  "navigator",
  "localStorage",
  "fetch",
  "process",
  "Buffer",
].map((name) => ({ name, message: "Pure packages cannot use platform globals." }));

const NONDETERMINISTIC_MESSAGE =
  "The match engine and the rating must be deterministic: replay and rebuild cannot vary.";

const NONDETERMINISTIC_GLOBALS = ["Date", "crypto", "performance", "Intl", "setTimeout"].map(
  (name) => ({ name, message: NONDETERMINISTIC_MESSAGE }),
);

const PURE_SYNTAX_RESTRICTIONS = [
  { selector: "ImportExpression", message: "Pure packages cannot use dynamic imports." },
  { selector: "TSImportType", message: "Use a static `import type` instead of import()." },
];

const NO_FUNCTIONS_IN_DATA = {
  selector: ":function",
  message: "Data files hold data only. Move the logic to a regular file.",
};
const DATA_RESTRICTIONS = [...PURE_SYNTAX_RESTRICTIONS, NO_FUNCTIONS_IN_DATA];

function exceptionBlock(gate, rules) {
  const files = exceptedPaths(QUALITY_EXCEPTIONS, gate);
  return files.length === 0 ? [] : [{ files, rules }];
}

export default defineConfig([
  globalIgnores([
    "**/dist/**",
    "**/.expo/**",
    "**/.turbo/**",
    "**/node_modules/**",
    "**/coverage/**",
    // Written by scripts/generate-api-types.mjs from the API contract; check:api-types guards it (ADR 0042).
    "apps/mobile/src/api/generated/**",
  ]),

  // Exceptions live in this file, with a reason. Inline directives have no effect and warn.
  {
    linterOptions: { noInlineConfig: true },
  },

  eslint.configs.recommended,

  // Code built from strings cannot be analysed, in any file.
  { rules: { "no-eval": "error", "no-new-func": "error" } },

  // The Expo preset carries the React and import rules, so it applies only to the app.
  { files: MOBILE_FILES, extends: [expo] },

  {
    files: TYPESCRIPT_FILES,
    extends: [tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { functional },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-implied-eval": "error",
      "@typescript-eslint/no-magic-numbers": [
        "error",
        {
          ...MAGIC_NUMBER_OPTIONS,
          ignoreEnums: true,
          ignoreNumericLiteralTypes: true,
          ignoreReadonlyClassProperties: true,
          ignoreTypeIndexes: true,
        },
      ],
      "@typescript-eslint/prefer-readonly": "error",
      "prefer-const": "error",
      "no-param-reassign": ["error", { props: true }],
      "functional/no-let": "error",
      "functional/immutable-data": "error",
    },
  },

  {
    files: MOBILE_FILES,
    rules: {
      // React refs and Reanimated shared values are mutable by design.
      "functional/immutable-data": ["error", { ignoreAccessorPattern: ["**.current", "**.value"] }],
    },
  },

  // The round page (E3.12, ADR 0070, D5): textContent only, platform globals only in the adapters.
  ...webPageBlocks({ testFiles: TEST_FILES }),

  {
    files: PURE_PACKAGE_FILES,
    ignores: TEST_FILES,
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        { patterns: FORBIDDEN_IN_PURE_PACKAGES },
      ],
      "@typescript-eslint/triple-slash-reference": [
        "error",
        { lib: "never", path: "never", types: "never" },
      ],
      "no-restricted-syntax": ["error", ...PURE_SYNTAX_RESTRICTIONS],
      "no-restricted-globals": ["error", ...FORBIDDEN_GLOBALS],
    },
  },

  {
    files: VOLLEY_RULES_FILES,
    ignores: TEST_FILES,
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        { patterns: [...FORBIDDEN_IN_PURE_PACKAGES, FORBIDDEN_MATCH_ENGINE_IMPORT] },
      ],
    },
  },

  {
    files: DETERMINISTIC_FILES,
    ignores: TEST_FILES,
    rules: {
      // A later block replaces the rule, so the list repeats the globals of the pure packages.
      "no-restricted-globals": ["error", ...FORBIDDEN_GLOBALS, ...NONDETERMINISTIC_GLOBALS],
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random", message: NONDETERMINISTIC_MESSAGE },
      ],
    },
  },

  // The replay walks a linked timeline without recursion (10 thousand events), and the loop
  // variable is the only thing it reassigns. Registered in ADR 0002.
  {
    files: ["packages/match-engine/src/event-log/replay-events.ts"],
    rules: { "functional/no-let": ["error", { allowInForLoopInit: true }] },
  },

  // The payload copy counts nodes in one pass; threading the count would make it quadratic.
  // The counter is its only mutable value. Registered in ADR 0002.
  {
    files: ["packages/match-engine/src/event-log/parse-envelope.ts"],
    rules: {
      "functional/immutable-data": ["error", { ignoreAccessorPattern: ["budget.remaining"] }],
      "no-param-reassign": ["error", { props: true, ignorePropertyModificationsFor: ["budget"] }],
    },
  },

  {
    files: FORBIDDEN_JAVASCRIPT_FILES,
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: "Program", message: "Sources must be TypeScript." },
      ],
    },
  },

  // Numbers are the content of a data file, so it cannot hold logic to hide them in.
  {
    files: DATA_FILES,
    rules: {
      "@typescript-eslint/no-magic-numbers": "off",
      "no-restricted-syntax": ["error", ...DATA_RESTRICTIONS],
    },
  },

  {
    files: TEST_FILES,
    rules: {
      "@typescript-eslint/no-magic-numbers": "off",
      "functional/no-let": "off",
      "functional/immutable-data": "off",
    },
  },

  // Node.js scripts have no type information, so only the syntactic rules apply.
  {
    files: TOOLING_FILES,
    languageOptions: { globals: { console: "readonly", process: "readonly" } },
    plugins: { functional },
    rules: {
      "no-magic-numbers": ["error", MAGIC_NUMBER_OPTIONS],
      "no-param-reassign": ["error", { props: true }],
      "prefer-const": "error",
      "functional/no-let": "error",
    },
  },

  // Quality gates: complexity in production code and size everywhere (tests may be longer).
  {
    files: [...TYPESCRIPT_FILES, ...TOOLING_FILES],
    rules: {
      complexity: ["error", MAX_COMPLEXITY],
      "max-lines": ["error", { max: MAX_LINES, skipBlankLines: false, skipComments: false }],
    },
  },
  {
    files: LONG_FILES,
    rules: {
      complexity: "off",
      "max-lines": [
        "error",
        { max: MAX_LINES_IN_TESTS, skipBlankLines: false, skipComments: false },
      ],
    },
  },
  ...exceptionBlock("complexity", { complexity: "off" }),
  ...exceptionBlock("max-lines", { "max-lines": "off" }),

  // The Metro config is CommonJS run by Node.
  {
    files: ["apps/mobile/metro.config.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { require: "readonly", module: "writable", __dirname: "readonly" },
    },
  },

  // No ES2023+ built-ins in the app: the Hermes of the phone lacks them (R98, item 10).
  ...hermesBlocks({ files: MOBILE_FILES, testFiles: TEST_FILES }),

  // docs/padroes/frontend.md made automatic, in its own module.
  ...mobileFrontendBlocks({ testFiles: TEST_FILES, dataRestrictions: DATA_RESTRICTIONS }),

  // Stylistic rules are Prettier's job, so this must stay last.
  prettier,
]);
