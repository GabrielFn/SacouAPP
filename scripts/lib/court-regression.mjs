// ESLint cases for the offline court slice (E4.9) and for Node.js stay-out rules in the app.
const NO_RESTRICTED_GLOBALS = "no-restricted-globals";
const NO_RESTRICTED_PROPERTIES = "no-restricted-properties";
const NO_RESTRICTED_IMPORTS = "@typescript-eslint/no-restricted-imports";
const NO_RESTRICTED_SYNTAX = "no-restricted-syntax";
const CLEAN = "clean";

function deviceImport(name) {
  return `import { ${name} } from "react-native";\nexport const used = ${name};\n`;
}

const NODE_GLOBAL_CASES = [
  ["buffer", "export const value: unknown = Buffer;\n"],
  ["immediate", "export const value: unknown = setImmediate;\n"],
  ["dirname", "export const value: unknown = __dirname;\n"],
  ["filename", "export const value: unknown = __filename;\n"],
  ["global", "export const value: unknown = global;\n"],
];

/** Cases as `[file, code, expected rule or "clean"]`, relative to the root. */
export function courtLintCases(prefix) {
  const court = `apps/mobile/src/features/court/${prefix}`;
  const ui = `apps/mobile/src/ui/${prefix}`;
  return [
    [`${court}fetch.ts`, 'export const call = fetch("/");\n', NO_RESTRICTED_GLOBALS],
    [`${court}xhr.ts`, "export const call = new XMLHttpRequest();\n", NO_RESTRICTED_GLOBALS],
    [`${court}socket.ts`, 'export const call = new WebSocket("wss://x");\n', NO_RESTRICTED_GLOBALS],
    [`${court}source.ts`, 'export const call = new EventSource("/");\n', NO_RESTRICTED_GLOBALS],
    [`${court}query.ts`, 'import "@tanstack/react-query";\n', NO_RESTRICTED_IMPORTS],
    [
      `${court}query-lazy.ts`,
      'export const query = import("@tanstack/react-query");\n',
      NO_RESTRICTED_SYNTAX,
    ],
    [
      `${court}global-fetch.ts`,
      'export const call = globalThis.fetch("/");\n',
      NO_RESTRICTED_PROPERTIES,
    ],
    [
      `${court}window-socket.ts`,
      'export const call = new window.WebSocket("x");\n',
      NO_RESTRICTED_PROPERTIES,
    ],
    [
      `${court}self-xhr.ts`,
      "export const call = new self.XMLHttpRequest();\n",
      NO_RESTRICTED_PROPERTIES,
    ],
    [`${court}sqlite.ts`, 'import "expo-sqlite";\n', NO_RESTRICTED_IMPORTS],
    [`${court}clean.ts`, "export const value = 1;\n", CLEAN],
    // The device APIs of react-native live in adapters; the rest of react-native stays free.
    [`${court}back-handler.ts`, deviceImport("BackHandler"), NO_RESTRICTED_IMPORTS],
    [`${ui}vibration.ts`, deviceImport("Vibration"), NO_RESTRICTED_IMPORTS],
    [`${ui}accessibility-info.ts`, deviceImport("AccessibilityInfo"), NO_RESTRICTED_IMPORTS],
    [`${ui}view.ts`, deviceImport("View"), CLEAN],
    [`apps/mobile/src/adapters/${prefix}back-handler.ts`, deviceImport("BackHandler"), CLEAN],
    [`${ui}fetch.ts`, 'export const call = fetch("/");\n', CLEAN],
    // Node.js is for tests only, everywhere in the app.
    [`${ui}node.ts`, 'import "node:fs";\n', NO_RESTRICTED_IMPORTS],
    [`${ui}node-bare.ts`, 'import "path";\n', NO_RESTRICTED_IMPORTS],
    [`apps/mobile/src/adapters/${prefix}node.ts`, 'import "node:sqlite";\n', NO_RESTRICTED_IMPORTS],
    [`${ui}node.test.ts`, 'import "node:fs";\n', CLEAN],
    [`${court}node-fixture.test.fixture.ts`, 'import "node:sqlite";\n', CLEAN],
    ...NODE_GLOBAL_CASES.map(([name, code]) => [
      `${ui}node-${name}.ts`,
      code,
      NO_RESTRICTED_GLOBALS,
    ]),
    ...NODE_GLOBAL_CASES.map(([name, code]) => [
      `${court}node-${name}.ts`,
      code,
      NO_RESTRICTED_GLOBALS,
    ]),
    [`${ui}buffer.test.ts`, "export const value: unknown = Buffer;\n", CLEAN],
  ];
}
