import { builtinModules } from "node:module";

import eslint from "@eslint/js";
import prettier from "eslint-config-prettier";
import expo from "eslint-config-expo/flat.js";
import functional from "eslint-plugin-functional";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

const TYPESCRIPT_FILES = ["**/*.{ts,tsx}"];
const MOBILE_FILES = ["apps/mobile/**/*.{ts,tsx}"];
const TEST_FILES = ["**/*.test.{ts,tsx}"];
const PURE_PACKAGE_FILES = ["packages/{match-engine,volley-rules}/src/**/*.ts"];
const VOLLEY_RULES_FILES = ["packages/volley-rules/src/**/*.ts"];
const DATA_FILES = ["**/golden/**", "**/*.data.ts"];

const FORBIDDEN_IN_PURE_PACKAGES = [
  {
    regex: "^(react|expo)|^@(expo|react-native)/",
    message: "Pure packages cannot depend on React, Expo or React Native.",
  },
  {
    regex: `^node:|^(${builtinModules.filter((name) => !name.startsWith("_")).join("|")})(/|$)`,
    message: "Pure packages cannot depend on Node.js built-in modules.",
  },
];

const FORBIDDEN_MATCH_ENGINE_IMPORT = {
  regex: "^@sacou/match-engine(/|$)",
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

export default defineConfig([
  globalIgnores([
    "**/dist/**",
    "**/.expo/**",
    "**/.turbo/**",
    "**/node_modules/**",
    "**/coverage/**",
  ]),

  {
    linterOptions: { reportUnusedDisableDirectives: "error" },
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
          ignore: [-1, 0, 1],
          enforceConst: true,
          ignoreEnums: true,
          ignoreNumericLiteralTypes: true,
          ignoreReadonlyClassProperties: true,
          ignoreTypeIndexes: true,
          ignoreArrayIndexes: true,
          detectObjects: false,
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
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportExpression",
          message: "Pure packages cannot use dynamic imports.",
        },
      ],
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
    files: [...TEST_FILES, ...DATA_FILES],
    rules: {
      "@typescript-eslint/no-magic-numbers": "off",
    },
  },

  {
    files: TEST_FILES,
    rules: {
      "functional/no-let": "off",
      "functional/immutable-data": "off",
    },
  },

  // Stylistic rules are Prettier's job, so this must stay last.
  prettier,
]);
