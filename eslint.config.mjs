import { builtinModules } from "node:module";

import eslint from "@eslint/js";
import prettier from "eslint-config-prettier";
import expo from "eslint-config-expo/flat.js";
import functional from "eslint-plugin-functional";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

const TS_EXTENSIONS = "{ts,tsx,mts,cts}";
const TYPESCRIPT_FILES = [`**/*.${TS_EXTENSIONS}`];
const MOBILE_FILES = [`apps/mobile/**/*.${TS_EXTENSIONS}`];
const TEST_FILES = [`**/*.test.${TS_EXTENSIONS}`];
const PURE_PACKAGE_FILES = [`packages/{match-engine,volley-rules}/src/**/*.${TS_EXTENSIONS}`];
const VOLLEY_RULES_FILES = [`packages/volley-rules/src/**/*.${TS_EXTENSIONS}`];
const DATA_FILES = ["**/*.data.{ts,mts,cts}"];
const FORBIDDEN_JAVASCRIPT_FILES = ["{packages/*,apps/mobile}/src/**/*.{js,jsx,cjs,mjs}"];
const TOOLING_FILES = ["eslint.config.mjs", "scripts/**/*.{js,cjs,mjs}"];

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

const PURE_SYNTAX_RESTRICTIONS = [
  { selector: "ImportExpression", message: "Pure packages cannot use dynamic imports." },
  { selector: "TSImportType", message: "Use a static `import type` instead of import()." },
];

const NO_FUNCTIONS_IN_DATA = {
  selector: ":function",
  message: "Data files hold data only. Move the logic to a regular file.",
};

export default defineConfig([
  globalIgnores([
    "**/dist/**",
    "**/.expo/**",
    "**/.turbo/**",
    "**/node_modules/**",
    "**/coverage/**",
  ]),

  // Exceptions live in this file, with a reason. Inline directives have no effect and warn.
  {
    linterOptions: { noInlineConfig: true },
  },

  eslint.configs.recommended,

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
      "no-restricted-syntax": ["error", ...PURE_SYNTAX_RESTRICTIONS, NO_FUNCTIONS_IN_DATA],
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

  // Stylistic rules are Prettier's job, so this must stay last.
  prettier,
]);
