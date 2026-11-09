// Rules of docs/padroes/frontend.md that ESLint can check (ADR 0035), used by eslint.config.mjs.
const TS_EXTENSIONS = "{ts,tsx,mts,cts}";
const MOBILE_SOURCE_FILES = [`apps/mobile/src/**/*.${TS_EXTENSIONS}`];
const MOBILE_THEME_FILES = ["apps/mobile/src/theme/**"];
const MOBILE_ADAPTER_FILES = ["apps/mobile/src/adapters/**"];
const MOBILE_DATA_FILES = ["apps/mobile/src/**/*.data.{ts,mts,cts}"];
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
  regex: `^(expo(/|$)|expo-(?!${FREE_EXPO}(/|$))|react-native-(?!${FREE_REACT_NATIVE}(/|$))|@react-native-community/|@react-native-async-storage/)`,
  message: "Device and service SDKs are used only in src/adapters/, behind an interface.",
};

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
      ignores: [...MOBILE_ADAPTER_FILES, ...testFiles],
      rules: { "@typescript-eslint/no-restricted-imports": ["error", { patterns: [SDK_IMPORTS] }] },
    },
  ];
}
