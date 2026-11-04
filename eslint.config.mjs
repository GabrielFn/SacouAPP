import { existsSync, readdirSync } from "node:fs";
import { builtinModules } from "node:module";
import { resolve } from "node:path";

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
const MATCH_ENGINE_FILES = [`packages/match-engine/src/**/*.${TS_EXTENSIONS}`];
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

const NONDETERMINISTIC_MESSAGE = "The match engine must be deterministic: replay cannot vary.";

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

// Size and complexity of production code (ADR 0034). Tests only have a file size limit.
const MAX_COMPLEXITY = 10;
const MAX_FILE_LINES = 300;
const MAX_COMPONENT_FILE_LINES = 200;
const MAX_TEST_FILE_LINES = 800;
const MAX_FUNCTION_LINES = 50;
const MAX_COMPONENT_FUNCTION_LINES = 80;
const MAX_DEPTH = 4;
const MAX_PARAMS = 4;
const MAX_NESTED_CALLBACKS = 3;
const COMPONENT_FILES = ["**/*.tsx"];

const linesLimit = (max) => ({ max, skipBlankLines: true, skipComments: true });

const PRODUCTION_METRICS = {
  complexity: ["error", MAX_COMPLEXITY],
  "max-lines": ["error", linesLimit(MAX_FILE_LINES)],
  "max-lines-per-function": ["error", linesLimit(MAX_FUNCTION_LINES)],
  "max-depth": ["error", MAX_DEPTH],
  "@typescript-eslint/max-params": ["error", { max: MAX_PARAMS }],
  "max-nested-callbacks": ["error", MAX_NESTED_CALLBACKS],
};

const TEST_METRICS = {
  complexity: "off",
  "max-lines": ["error", linesLimit(MAX_TEST_FILE_LINES)],
  "max-lines-per-function": "off",
  "max-depth": "off",
  "@typescript-eslint/max-params": "off",
  "max-nested-callbacks": "off",
};

// App architecture (ADR 0034, docs/padroes/app.md). Imports out of the current folder go
// through the `@/` alias, so the folder an import reaches is spelled in it.
const MOBILE_SRC = "apps/mobile/src";
const FEATURES_DIRECTORY = resolve(import.meta.dirname, MOBILE_SRC, "features");
const mobileFolderFiles = (folder) => [`${MOBILE_SRC}/${folder}/**/*.${TS_EXTENSIONS}`];

const ALIAS_IMPORT = "^@/";

const PARENT_IMPORT = {
  regex: "(^|/)\\.\\.(/|$)",
  message: "Import from another folder through the @/ alias, not with ../.",
};

const UI_IMPORT = {
  regex: "^@/(features|lib|app)(/|$)",
  message: "ui/ is the design system: it cannot import features/, lib/ or app/.",
};

const ROUTE_IMPORT = {
  regex: "^@/(?!features/[^/]+/screens(/|$))",
  message: "Routes in app/ only mount a screen: import from features/<feature>/screens.",
};

const VIEW_IMPORTS = [
  {
    regex: "^@/(lib(/|$)|features/[^/]+/api(/|$))",
    message: "Screens and components reach api/ and lib/ only through the hooks of their feature.",
  },
];

const otherFeatureImport = (feature) => ({
  regex: `^@/features/(?!${feature}(/|$))`,
  message: "A feature cannot import another one. Move what they share to ui/ or lib/.",
});

const RAW_TOUCHABLES = [
  "Pressable",
  "TouchableHighlight",
  "TouchableOpacity",
  "TouchableWithoutFeedback",
];

const RAW_TOUCHABLE_PATHS = ["react-native", "react-native-gesture-handler"].map((name) => ({
  name,
  importNames: RAW_TOUCHABLES,
  message: "Use the touchable components of ui/: they keep 44 px and the accessibility label.",
}));

const restrictImports = (patterns, paths = RAW_TOUCHABLE_PATHS) => ({
  "@typescript-eslint/no-restricted-imports": ["error", { patterns, paths }],
});

const FEATURES = existsSync(FEATURES_DIRECTORY)
  ? readdirSync(FEATURES_DIRECTORY, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  : [];

const featureBlocks = (feature) => [
  {
    files: mobileFolderFiles(`features/${feature}`),
    rules: restrictImports([PARENT_IMPORT, otherFeatureImport(feature)]),
  },
  {
    files: [
      ...mobileFolderFiles(`features/${feature}/screens`),
      ...mobileFolderFiles(`features/${feature}/components`),
    ],
    rules: restrictImports([PARENT_IMPORT, otherFeatureImport(feature), ...VIEW_IMPORTS]),
  },
];

// Any object literal in a style prop, except the arguments of a call (Unistyles variants and
// dynamic styles take one) and the objects nested in one already reported.
const INLINE_STYLE = {
  selector:
    "JSXAttribute[name.name=/^style$|Style$/] ObjectExpression:not(CallExpression > ObjectExpression, Property > ObjectExpression)",
  message: "No inline style: use a Unistyles stylesheet with the theme tokens.",
};

const COLOR_PATTERN = "/#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})\\b|(rgba?|hsla?)\\(/i";
const COLOR_MESSAGE = "Colors live in ui/tokens/: use the theme.";

const LITERAL_COLORS = [
  { selector: `Literal[value=${COLOR_PATTERN}]`, message: COLOR_MESSAGE },
  { selector: `TemplateElement[value.raw=${COLOR_PATTERN}]`, message: COLOR_MESSAGE },
];

const TOKEN_FILES = mobileFolderFiles("ui/tokens");
const MOBILE_SOURCE_FILES = mobileFolderFiles("**");

// no-restricted-syntax is one list per file, so a mobile data file repeats the data restrictions.
const mobileSyntaxBlocks = (files, restrictions, ignores = []) => [
  {
    files,
    ignores: [...ignores, ...DATA_FILES],
    rules: { "no-restricted-syntax": ["error", ...restrictions] },
  },
  {
    files: files.map((pattern) => pattern.replace(`*.${TS_EXTENSIONS}`, "*.data.{ts,mts,cts}")),
    ignores,
    rules: {
      "no-restricted-syntax": [
        "error",
        ...PURE_SYNTAX_RESTRICTIONS,
        NO_FUNCTIONS_IN_DATA,
        ...restrictions,
      ],
    },
  },
];

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
      // The preset resolves imports with the Node resolver, which does not read the `@/` alias of
      // apps/mobile/tsconfig.json; tsc checks those imports (typecheck and build). ADR 0034.
      "import/no-unresolved": ["error", { ignore: [ALIAS_IMPORT] }],
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
    files: MATCH_ENGINE_FILES,
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

  // App boundaries (ADR 0034). The rule is one list per file, so each block repeats what applies.
  { files: MOBILE_SOURCE_FILES, rules: restrictImports([PARENT_IMPORT]) },
  { files: mobileFolderFiles("ui"), rules: restrictImports([PARENT_IMPORT, UI_IMPORT], []) },
  { files: mobileFolderFiles("app"), rules: restrictImports([PARENT_IMPORT, ROUTE_IMPORT]) },
  ...FEATURES.flatMap(featureBlocks),

  // One component per file; a subcomponent goes to its own file in the same folder.
  {
    files: MOBILE_SOURCE_FILES,
    rules: { "react/no-multi-comp": ["error", { ignoreStateless: false }] },
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

  // Colors only in ui/tokens/, and no inline style anywhere in the app (ADR 0034).
  ...mobileSyntaxBlocks(MOBILE_SOURCE_FILES, [INLINE_STYLE, ...LITERAL_COLORS], TOKEN_FILES),
  ...mobileSyntaxBlocks(TOKEN_FILES, [INLINE_STYLE]),

  { files: TYPESCRIPT_FILES, rules: PRODUCTION_METRICS },

  {
    files: COMPONENT_FILES,
    rules: {
      "max-lines": ["error", linesLimit(MAX_COMPONENT_FILE_LINES)],
      "max-lines-per-function": ["error", linesLimit(MAX_COMPONENT_FUNCTION_LINES)],
    },
  },

  {
    files: TEST_FILES,
    rules: {
      ...TEST_METRICS,
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
