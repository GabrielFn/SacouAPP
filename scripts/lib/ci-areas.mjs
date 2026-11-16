// Which parts of the CI a change needs (ADR 0004). Anything unknown runs everything: a skipped check
// must always be a deliberate rule, never a gap.

const DOCS = "docs/";
// Tests read the domain docs, so they count as code.
const DOMAIN_DOCS = "docs/dominio/";
// The API reads packages/ (formations, golden files), but nothing under apps/mobile/.
const APP_ONLY = "apps/mobile/";

const EVERYTHING = Object.freeze({ code: true, api: true });

function isDocsOnly(file) {
  return file.startsWith(DOCS) && !file.startsWith(DOMAIN_DOCS);
}

/**
 * `code`: false only when every file is in docs/ and outside docs/dominio/.
 * `api`: false only when every code file is in apps/mobile/.
 * An empty list (failed or empty diff) runs everything.
 */
export function ciAreas(files) {
  const changed = files.filter((file) => file.length > 0);
  if (changed.length === 0) return EVERYTHING;

  const code = changed.filter((file) => !isDocsOnly(file));
  if (code.length === 0) return Object.freeze({ code: false, api: false });

  return Object.freeze({ code: true, api: code.some((file) => !file.startsWith(APP_ONLY)) });
}
