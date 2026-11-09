// Exceptions to the quality gates (max-lines, complexity, duplication) live in one file:
// scripts/quality-exceptions.json. A malformed or expired entry fails every gate that reads it.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parseDatedEntries } from "./audit-exceptions.mjs";

export const QUALITY_GATES = Object.freeze(["max-lines", "complexity", "duplication"]);
export const QUALITY_EXCEPTIONS_FILE = resolve(
  import.meta.dirname,
  "..",
  "quality-exceptions.json",
);
/** An exception lasts at most this many days from today (docs/padroes/codigo.md). */
export const MAX_EXCEPTION_DAYS = 60;

const ROOT = resolve(import.meta.dirname, "..", "..");
const ISO_DATE_LENGTH = 10;
const MILLISECONDS_PER_DAY = 86_400_000;
// A glob in `path` would relax the gate for many files (ESLint reads it as a pattern).
const GLOB_CHARACTERS = /[*?[\]{}!]/;

function hasKnownGate(entry) {
  return QUALITY_GATES.includes(entry.gate);
}

/** Today in UTC as YYYY-MM-DD. */
export function todayIso() {
  return new Date().toISOString().slice(0, ISO_DATE_LENGTH);
}

/** The ISO day `days` after `isoDate`. */
export function addDays(isoDate, days) {
  const time = new Date(`${isoDate}T00:00:00Z`).getTime() + days * MILLISECONDS_PER_DAY;
  return new Date(time).toISOString().slice(0, ISO_DATE_LENGTH);
}

/** Repository paths of the tracked files, as `git ls-files` prints them. */
export function listTrackedFiles(root = ROOT) {
  const output = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" });
  return new Set(output.split("\0").filter((path) => path.length > 0));
}

function pathProblem({ path }, isTracked) {
  if (GLOB_CHARACTERS.test(path)) {
    return `quality exception path cannot be a glob: ${path}.`;
  }
  return isTracked(path) ? undefined : `quality exception path is not a tracked file: ${path}.`;
}

function entryProblems(entries, today, isTracked) {
  const latest = addDays(today, MAX_EXCEPTION_DAYS);
  return entries.flatMap((entry) => {
    const { gate, path, expires } = entry;
    const problems = [
      pathProblem(entry, isTracked),
      expires < today ? `quality exception expired on ${expires}: ${gate} ${path}.` : undefined,
      expires > latest
        ? `quality exception expires after ${latest} (${MAX_EXCEPTION_DAYS} days at most): ${gate} ${path}.`
        : undefined,
    ];
    return problems.filter((problem) => problem !== undefined);
  });
}

/**
 * Returns `{ exceptions, failures }`. With any failure, `exceptions` is empty, so a broken
 * file never relaxes a gate. `isTracked(path)` tells whether the path is a tracked file.
 */
export function readQualityExceptions(raw, today, isTracked) {
  const entries = parseDatedEntries(raw, "path", hasKnownGate);
  if (entries === undefined) {
    return {
      exceptions: [],
      failures: [
        `quality-exceptions.json is invalid: each entry needs gate (${QUALITY_GATES.join(", ")}), path, reason and expires (YYYY-MM-DD).`,
      ],
    };
  }
  const failures = entryProblems(entries, today, isTracked);
  return failures.length > 0 ? { exceptions: [], failures } : { exceptions: entries, failures };
}

/** Reads the exceptions file, checking the paths against `git ls-files` only when needed. */
export function readQualityExceptionsFile(file = QUALITY_EXCEPTIONS_FILE, today = todayIso()) {
  const tracked = { files: undefined };
  const isTracked = (path) => {
    tracked.files ??= listTrackedFiles();
    return tracked.files.has(path);
  };
  return readQualityExceptions(readFileSync(file, "utf8"), today, isTracked);
}

/** Reads the file and throws on any failure: for gates that cannot report a list. */
export function loadQualityExceptions(file = QUALITY_EXCEPTIONS_FILE, today = todayIso()) {
  const { exceptions, failures } = readQualityExceptionsFile(file, today);
  if (failures.length > 0) {
    throw new Error(failures.join("\n"));
  }
  return exceptions;
}

/** Paths excepted from one gate. */
export function exceptedPaths(exceptions, gate) {
  return exceptions.filter((entry) => entry.gate === gate).map(({ path }) => path);
}
