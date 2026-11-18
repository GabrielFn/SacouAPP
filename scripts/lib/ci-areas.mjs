// Which parts of the CI a change needs (ADR 0004, ADR 0064). Anything unknown runs everything: a skipped
// check must always be a deliberate rule, never a gap.

const DOCS = "docs/";
// Tests read the domain docs, so they count as code.
const DOMAIN_DOCS = "docs/dominio/";
// The API reads packages/ (formations, golden files), but nothing under apps/mobile/.
const APP_ONLY = "apps/mobile/";
// The app reads packages/ too, and nothing else of the API except its contract.
const API_ONLY = "apps/api/";
// The committed contract is read by the app (generated types), so it also needs the app checks.
const SHARED_CONTRACT = "apps/api/openapi/";

// Build and analyzer configuration inside apps/api/ changes the rules of the whole API and is proved by
// the probes of both sides, so it counts as shared.
const API_CONFIGURATION =
  /(^|\/)(Directory\.[^/]+\.(props|targets)|\.editorconfig|\.globalconfig|CodeMetricsConfig\.txt)$/;

const EVERYTHING = Object.freeze({ code: true, api: true, app: true });
const NOTHING = Object.freeze({ code: false, api: false, app: false });

function isDocsOnly(file) {
  return file.startsWith(DOCS) && !file.startsWith(DOMAIN_DOCS);
}

function needsApi(file) {
  return !file.startsWith(APP_ONLY);
}

function needsApp(file) {
  return (
    !file.startsWith(API_ONLY) || file.startsWith(SHARED_CONTRACT) || API_CONFIGURATION.test(file)
  );
}

/**
 * `code`: false only when every file is in docs/ and outside docs/dominio/.
 * `api`: false only when every code file is in apps/mobile/.
 * `app`: false only when every code file is in apps/api/ and outside apps/api/openapi/.
 * Shared code (packages/, root files, scripts/, .github/) is in neither folder, so it turns both on.
 * An empty list (failed or empty diff) runs everything.
 */
export function ciAreas(files) {
  const changed = files.filter((file) => file.length > 0);
  if (changed.length === 0) return EVERYTHING;

  const code = changed.filter((file) => !isDocsOnly(file));
  if (code.length === 0) return NOTHING;

  return Object.freeze({ code: true, api: code.some(needsApi), app: code.some(needsApp) });
}
