import { builtinModules } from "node:module";

import { HERMES_MISSING_PROPERTIES } from "./eslint-hermes-rules.mjs";

// Rules of docs/padroes/frontend.md that ESLint can check (ADR 0035), used by eslint.config.mjs.
const TS_EXTENSIONS = "{ts,tsx,mts,cts}";
const MOBILE_SOURCE_FILES = [`apps/mobile/src/**/*.${TS_EXTENSIONS}`];
const MOBILE_THEME_FILES = ["apps/mobile/src/theme/**"];
const MOBILE_ADAPTER_FILES = ["apps/mobile/src/adapters/**"];
const MOBILE_DATA_FILES = ["apps/mobile/src/**/*.data.{ts,mts,cts}"];
const COURT_FILES = [`apps/mobile/src/features/court/**/*.${TS_EXTENSIONS}`];
const COURT_DATA_FILES = ["apps/mobile/src/features/court/**/*.data.{ts,mts,cts}"];
const COURT_REDUCER_FILES = ["apps/mobile/src/features/court/**/*.reducer.{ts,mts,cts}"];
const FIXTURE_FILES = ["apps/mobile/src/**/*.test.fixture.ts"];
const REDUCER_FILES = [`apps/mobile/src/**/*.reducer.${TS_EXTENSIONS}`];

// Selector regexes avoid backslashes, which esquery drops.
const COLOR_MESSAGE = "Colors come from the theme (src/theme/). Use a token.";
const HEX = "#[0-9a-fA-F]{3,8}";
const COLOR_RESTRICTIONS = [
  { selector: `Literal[value=/^${HEX}$/]`, message: COLOR_MESSAGE },
  { selector: `TemplateElement[value.raw=/${HEX}(?![0-9a-zA-Z])/]`, message: COLOR_MESSAGE },
  { selector: "Literal[value=/^ *rgba?[(]/i]", message: COLOR_MESSAGE },
  { selector: "TemplateElement[value.raw=/rgba?[(]/i]", message: COLOR_MESSAGE },
];

// Unitless style values that are not sizes, so they may be written as numbers.
const UNITLESS_STYLE_KEYS = "/^(flex|flexGrow|flexShrink|opacity|aspectRatio|zIndex)$/";
const STYLE_CONTEXTS = [
  "CallExpression[callee.object.name='StyleSheet'][callee.property.name='create']",
  "JSXAttribute[name.name=/[sS]tyle$/]",
  "VariableDeclarator[id.typeAnnotation.typeAnnotation.typeName.name=/Style$/]",
];
const STYLE_NUMBER_MESSAGE = "Sizes in styles come from tokens or relative units, not numbers.";
const STYLE_NUMBER_RESTRICTIONS = STYLE_CONTEXTS.flatMap((context) =>
  ["Literal[raw=/^[.]?[0-9]/]", "UnaryExpression > Literal[raw=/^[.]?[0-9]/]"].map((literal) => ({
    selector: `${context} Property:not([key.name=${UNITLESS_STYLE_KEYS}]) > ${literal}`,
    message: STYLE_NUMBER_MESSAGE,
  })),
);

const PROPS_MESSAGE = "Component props are an exported interface named <Component>Props.";
const PROPS_RESTRICTIONS = [
  { selector: "TSTypeAliasDeclaration[id.name=/Props$/]", message: PROPS_MESSAGE },
  {
    selector: ":not(ExportNamedDeclaration) > TSInterfaceDeclaration[id.name=/Props$/]",
    message: PROPS_MESSAGE,
  },
  {
    selector:
      "FunctionDeclaration[id.name=/^[A-Z]/] > :matches(Identifier, ObjectPattern) > TSTypeAnnotation > TSTypeLiteral",
    message: PROPS_MESSAGE,
  },
  {
    selector:
      "VariableDeclarator[id.name=/^[A-Z]/] > ArrowFunctionExpression > :matches(Identifier, ObjectPattern) > TSTypeAnnotation > TSTypeLiteral",
    message: PROPS_MESSAGE,
  },
];

const MOBILE_SYNTAX_RESTRICTIONS = [
  ...COLOR_RESTRICTIONS,
  ...STYLE_NUMBER_RESTRICTIONS,
  ...PROPS_RESTRICTIONS,
];

const NO_DEFAULT_IN_REDUCER = {
  selector: "SwitchCase[test=null]",
  message: "Reducers list every action: a default case hides a new one.",
};

// Device and service SDKs are reached through src/adapters/ only; UI and navigation are free.
const FREE_EXPO = "(router|status-bar)";
const FREE_REACT_NATIVE = "(svg|safe-area-context|reanimated|gesture-handler|screens)";
const SDK_IMPORTS = {
  regex: `^(expo(/|$)|expo-(?!${FREE_EXPO}(/|$))|react-native-(?!${FREE_REACT_NATIVE}(/|$))|@react-native-community/|@react-native-async-storage/|@react-native-firebase/|@react-native-google-signin/|openapi-fetch$)`,
  message: "Device and service SDKs are used only in src/adapters/, behind an interface.",
};

// react-native itself is free, but its device APIs are not: they have an adapter and an interface.
// The routes run the real services only: a fake adapter in src/app/ would ship in the APK (ADR 0057).
const MOBILE_ROUTE_FILES = [`apps/mobile/src/app/**/*.${TS_EXTENSIONS}`];
const FAKE_IMPORTS = {
  regex: "(^|/)adapters/fake-",
  message: "Routes use the real adapters; fakes are for tests (ADR 0057, D10).",
};

const DEVICE_API_NAMES = ["BackHandler", "Vibration", "AccessibilityInfo"];
const DEVICE_API_PATHS = [
  {
    name: "react-native",
    importNames: DEVICE_API_NAMES,
    message: "Device APIs of react-native are used only in src/adapters/, behind an interface.",
  },
];

// The same SDK rule for import() and require(), which no-restricted-imports does not see.
// esquery ends a regex at "/", so the selector spells it as "[/]".
const SDK_SELECTOR_REGEX = SDK_IMPORTS.regex.replaceAll("/", "[/]");
const SDK_DYNAMIC_RESTRICTIONS = [
  {
    selector: `ImportExpression[source.value=/${SDK_SELECTOR_REGEX}/]`,
    message: SDK_IMPORTS.message,
  },
  {
    selector: `CallExpression[callee.name='require'] > Literal.arguments[value=/${SDK_SELECTOR_REGEX}/]`,
    message: SDK_IMPORTS.message,
  },
];

// The court mode works with the plane in airplane mode (E4.9): the slice has no way to reach a network.
const NETWORK_MESSAGE = "The court slice is offline by design: no network access (E4.9).";
const NETWORK_GLOBALS = ["fetch", "XMLHttpRequest", "WebSocket", "EventSource"].map((name) => ({
  name,
  message: NETWORK_MESSAGE,
}));
const NETWORK_IMPORTS = { regex: "^@tanstack/", message: NETWORK_MESSAGE };
const NETWORK_TARGETS = ["globalThis", "window", "self"];
const NETWORK_PROPERTIES = NETWORK_TARGETS.flatMap((object) =>
  ["fetch", "XMLHttpRequest", "WebSocket", "EventSource"].map((property) => ({
    object,
    property,
    message: NETWORK_MESSAGE,
  })),
);
const NETWORK_DYNAMIC_RESTRICTIONS = [
  {
    selector: "ImportExpression[source.value=/^@tanstack[/]/]",
    message: NETWORK_MESSAGE,
  },
];

// The app runs on Hermes, not on Node.js: only tests (which run on Node) may use it.
const NODE_MESSAGE = "The app does not run on Node.js: Node built-ins are for tests only.";
const NODE_IMPORTS = {
  regex: `^node:|^(${builtinModules.filter((name) => !name.startsWith("_")).join("|")})(/|$)`,
  message: NODE_MESSAGE,
};
const NODE_GLOBALS = ["Buffer", "setImmediate", "__dirname", "__filename", "global"].map(
  (name) => ({
    name,
    message: NODE_MESSAGE,
  }),
);

// The API is reached through the SacouApi port only: `fetch` lives in src/adapters/ (E4.2, D4).
const FETCH_GLOBALS = [
  {
    name: "fetch",
    message: "Call the API through the SacouApi port; fetch is used only in src/adapters/.",
  },
];

function syntaxRule(restrictions) {
  return { "no-restricted-syntax": ["error", ...restrictions] };
}

/**
 * Two blocks for one set of files: outside src/adapters/ the SDK restrictions are added, inside
 * they are not. A later block replaces `no-restricted-syntax` as a whole, so each list is complete.
 */
function syntaxBlocks({ files, ignores, restrictions }) {
  return [
    {
      files,
      ignores: [...ignores, ...MOBILE_ADAPTER_FILES],
      rules: syntaxRule([...restrictions, ...SDK_DYNAMIC_RESTRICTIONS]),
    },
    {
      files: files.map((pattern) => [...MOBILE_ADAPTER_FILES, pattern]),
      ignores,
      rules: syntaxRule(restrictions),
    },
  ];
}

/**
 * Config blocks for apps/mobile/src. The theme is the only place for colors and sizes, and
 * adapters the only place for device SDKs. `dataRestrictions` keeps the data-file rules alive in
 * mobile data files, because a later block replaces `no-restricted-syntax` as a whole.
 */
export function mobileFrontendBlocks({ testFiles, dataRestrictions }) {
  const outsideTheme = [...MOBILE_THEME_FILES, ...testFiles];
  return [
    ...syntaxBlocks({
      files: MOBILE_SOURCE_FILES,
      ignores: outsideTheme,
      restrictions: MOBILE_SYNTAX_RESTRICTIONS,
    }),
    ...syntaxBlocks({
      files: MOBILE_DATA_FILES,
      ignores: outsideTheme,
      restrictions: [...dataRestrictions, ...MOBILE_SYNTAX_RESTRICTIONS],
    }),
    ...syntaxBlocks({
      files: REDUCER_FILES,
      ignores: testFiles,
      restrictions: [...MOBILE_SYNTAX_RESTRICTIONS, NO_DEFAULT_IN_REDUCER],
    }),
    {
      files: REDUCER_FILES,
      ignores: testFiles,
      rules: {
        "@typescript-eslint/switch-exhaustiveness-check": [
          "error",
          { considerDefaultExhaustiveForUnions: false, requireDefaultForNonUnion: false },
        ],
      },
    },
    {
      files: MOBILE_SOURCE_FILES,
      ignores: [...MOBILE_ADAPTER_FILES, ...testFiles, ...FIXTURE_FILES],
      rules: {
        "@typescript-eslint/no-restricted-imports": [
          "error",
          { patterns: [SDK_IMPORTS, NODE_IMPORTS], paths: DEVICE_API_PATHS },
        ],
      },
    },
    {
      files: MOBILE_ROUTE_FILES,
      ignores: [...testFiles, ...FIXTURE_FILES],
      rules: {
        "@typescript-eslint/no-restricted-imports": [
          "error",
          { patterns: [SDK_IMPORTS, NODE_IMPORTS, FAKE_IMPORTS], paths: DEVICE_API_PATHS },
        ],
      },
    },
    {
      files: MOBILE_ADAPTER_FILES,
      ignores: [...testFiles, ...FIXTURE_FILES],
      rules: {
        "@typescript-eslint/no-restricted-imports": ["error", { patterns: [NODE_IMPORTS] }],
      },
    },
    {
      files: MOBILE_SOURCE_FILES,
      ignores: [...MOBILE_ADAPTER_FILES, ...testFiles, ...FIXTURE_FILES],
      rules: { "no-restricted-globals": ["error", ...NODE_GLOBALS, ...FETCH_GLOBALS] },
    },
    {
      files: MOBILE_ADAPTER_FILES,
      ignores: [...testFiles, ...FIXTURE_FILES],
      rules: { "no-restricted-globals": ["error", ...NODE_GLOBALS] },
    },
    ...courtBlocks({ testFiles, dataRestrictions }),
  ];
}

/** The court slice is also offline by design (E4.9); lists are complete because blocks replace. */
function courtBlocks({ testFiles, dataRestrictions }) {
  const outsideTheme = [...MOBILE_THEME_FILES, ...testFiles];
  const restrictions = [...MOBILE_SYNTAX_RESTRICTIONS, ...NETWORK_DYNAMIC_RESTRICTIONS];
  return [
    ...syntaxBlocks({ files: COURT_FILES, ignores: outsideTheme, restrictions }),
    ...syntaxBlocks({
      files: COURT_DATA_FILES,
      ignores: outsideTheme,
      restrictions: [...dataRestrictions, ...restrictions],
    }),
    ...syntaxBlocks({
      files: COURT_REDUCER_FILES,
      ignores: testFiles,
      restrictions: [...restrictions, NO_DEFAULT_IN_REDUCER],
    }),
    {
      files: COURT_FILES,
      rules: { "no-restricted-properties": ["error", ...NETWORK_PROPERTIES] },
    },
    {
      files: COURT_FILES,
      ignores: testFiles,
      rules: {
        "no-restricted-properties": ["error", ...NETWORK_PROPERTIES, ...HERMES_MISSING_PROPERTIES],
      },
    },
    {
      files: COURT_FILES,
      rules: { "no-restricted-globals": ["error", ...NETWORK_GLOBALS] },
    },
    {
      files: COURT_FILES,
      ignores: [...testFiles, ...FIXTURE_FILES],
      rules: {
        "no-restricted-globals": ["error", ...NETWORK_GLOBALS, ...NODE_GLOBALS],
        "@typescript-eslint/no-restricted-imports": [
          "error",
          { patterns: [SDK_IMPORTS, NODE_IMPORTS, NETWORK_IMPORTS], paths: DEVICE_API_PATHS },
        ],
      },
    },
  ];
}
