// File size gate for C#: physical lines, the same count as `wc -l` and ESLint max-lines.
export const SIZE_LIMITS = Object.freeze([
  { prefix: "apps/api/tests/", maxLines: 600 },
  { prefix: "apps/api/src/", maxLines: 300 },
]);

/** Physical lines of a text: a final newline does not open a new line. */
export function countLines(text) {
  if (text.length === 0) {
    return 0;
  }
  const breaks = text.split("\n").length - 1;
  return text.endsWith("\n") ? breaks : breaks + 1;
}

function limitFor(path, limits) {
  return limits.find(({ prefix }) => path.startsWith(prefix))?.maxLines;
}

/** Returns one message per file over its limit; excepted paths are skipped. */
export function findSizeViolations({ files, limits = SIZE_LIMITS, exceptedPaths = [] }) {
  const excepted = new Set(exceptedPaths);
  return files
    .filter(({ path }) => !excepted.has(path))
    .map(({ path, lines }) => ({ path, lines, maxLines: limitFor(path, limits) }))
    .filter(({ lines, maxLines }) => maxLines !== undefined && lines > maxLines)
    .map(
      ({ path, lines, maxLines }) => `${path} has ${lines} lines. Maximum allowed is ${maxLines}.`,
    );
}
