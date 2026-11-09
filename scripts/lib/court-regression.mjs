// ESLint cases for the offline court slice (E4.9): no network, SDKs only in adapters.
const NO_RESTRICTED_GLOBALS = "no-restricted-globals";
const NO_RESTRICTED_IMPORTS = "@typescript-eslint/no-restricted-imports";
const CLEAN = "clean";

/** Cases as `[file, code, expected rule or "clean"]`, relative to the root. */
export function courtLintCases(prefix) {
  const court = `apps/mobile/src/features/court/${prefix}`;
  return [
    [`${court}fetch.ts`, 'export const call = fetch("/");\n', NO_RESTRICTED_GLOBALS],
    [`${court}xhr.ts`, "export const call = new XMLHttpRequest();\n", NO_RESTRICTED_GLOBALS],
    [`${court}socket.ts`, 'export const call = new WebSocket("wss://x");\n', NO_RESTRICTED_GLOBALS],
    [`${court}source.ts`, 'export const call = new EventSource("/");\n', NO_RESTRICTED_GLOBALS],
    [`${court}query.ts`, 'import "@tanstack/react-query";\n', NO_RESTRICTED_IMPORTS],
    [`${court}sqlite.ts`, 'import "expo-sqlite";\n', NO_RESTRICTED_IMPORTS],
    [`${court}clean.ts`, "export const value = 1;\n", CLEAN],
    [`apps/mobile/src/ui/${prefix}fetch.ts`, 'export const call = fetch("/");\n', CLEAN],
  ];
}
