// Reads a jscpd JSON report: any clone fails, except those touching a path excepted from the
// "duplication" gate in scripts/quality-exceptions.json.
import { relative } from "node:path";

// Windows absolute paths may come with the extended-length prefix (\\?\ or //?/).
const EXTENDED_LENGTH_PREFIX = /^[\\/]{2}\?[\\/]/;

function toRepoPath(root, file) {
  return relative(root, file.replace(EXTENDED_LENGTH_PREFIX, "")).split("\\").join("/");
}

function describeFragment(root, { name, start, end }) {
  return `${toRepoPath(root, name)}:${start}-${end}`;
}

/** Returns one message per clone that is not excepted. */
export function findDuplicationFailures({ report, root, exceptedPaths = [] }) {
  if (!Array.isArray(report?.duplicates)) {
    return ["jscpd report is invalid: no duplicates list."];
  }
  const excepted = new Set(exceptedPaths);
  return report.duplicates
    .filter(
      ({ firstFile, secondFile }) =>
        !excepted.has(toRepoPath(root, firstFile.name)) &&
        !excepted.has(toRepoPath(root, secondFile.name)),
    )
    .map(
      ({ format, tokens, firstFile, secondFile }) =>
        `${format} clone of ${tokens} tokens: ${describeFragment(root, firstFile)} and ${describeFragment(root, secondFile)}`,
    );
}
