// Rules of the round page's script (apps/web, E3.12, ADR 0070, D5), used by eslint.config.mjs.
const TS_EXTENSIONS = "{ts,tsx,mts,cts}";
const WEB_FILES = [`apps/web/src/**/*.${TS_EXTENSIONS}`];
const WEB_PLATFORM_FILES = [
  `apps/web/src/adapters/**/*.${TS_EXTENSIONS}`,
  "apps/web/src/main.ts",
  "apps/web/src/invite-main.ts",
];
const WEB_VIEW_FILES = [
  "apps/web/src/dom/**/*.ts",
  "apps/web/src/main.ts",
  "apps/web/src/invite-main.ts",
];

const XSS_MESSAGE = "Write text with textContent; HTML from a string is an XSS (ADR 0070, D5).";
const PORTS_MESSAGE =
  "Platform globals only in src/adapters and the entries (src/main.ts, src/invite-main.ts) (ports, frontend.md rule 3).";
const HTML_PROPERTIES = ["innerHTML", "outerHTML", "insertAdjacentHTML", "srcdoc"];
const DOCUMENT_WRITERS = ["write", "writeln"];
const PLATFORM_GLOBALS = [
  "fetch",
  "sessionStorage",
  "localStorage",
  "document",
  "window",
  "navigator",
];
// The DOM nodes and the one store reference are the only things the script writes to.
const WRITABLE_ACCESSORS = ["**.current", "**.hidden", "**.textContent", "**.disabled", "**.value"];
const WRITABLE_PARAMETERS = ["slot", "elements", "nodes"];

export function webPageBlocks({ testFiles }) {
  return [
    {
      files: WEB_FILES,
      rules: {
        "functional/immutable-data": ["error", { ignoreAccessorPattern: WRITABLE_ACCESSORS }],
        "no-restricted-properties": [
          "error",
          ...HTML_PROPERTIES.map((property) => ({ property, message: XSS_MESSAGE })),
          ...DOCUMENT_WRITERS.map((property) => ({
            object: "document",
            property,
            message: XSS_MESSAGE,
          })),
        ],
      },
    },
    // The view writes the page's nodes it receives; nothing else in the web app writes to a parameter.
    {
      files: WEB_VIEW_FILES,
      rules: {
        "no-param-reassign": [
          "error",
          { props: true, ignorePropertyModificationsFor: WRITABLE_PARAMETERS },
        ],
      },
    },
    {
      files: WEB_FILES,
      ignores: [...WEB_PLATFORM_FILES, ...testFiles],
      rules: {
        "@typescript-eslint/no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                regex: "^firebase(/|$)",
                message: "Firebase only in src/adapters (ports, frontend.md rule 3).",
              },
            ],
          },
        ],
        "no-restricted-globals": [
          "error",
          ...PLATFORM_GLOBALS.map((name) => ({ name, message: PORTS_MESSAGE })),
        ],
      },
    },
  ];
}
