// Exceptions to the quality gates (max-lines, complexity, duplication) live in one file:
// scripts/quality-exceptions.json. A malformed or expired entry fails every gate that reads it.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parseDatedEntries } from "./audit-exceptions.mjs";

export const QUALITY_GATES = Object.freeze(["max-lines", "complexity", "duplication"]);
export const QUALITY_EXCEPTIONS_FILE = resolve(
  import.meta.dirname,
  "..",
  "quality-exceptions.json",
);

const ISO_DATE_LENGTH = 10;

function hasKnownGate(entry) {
  return QUALITY_GATES.includes(entry.gate);
}

/** Today in UTC as YYYY-MM-DD. */
export function todayIso() {
  return new Date().toISOString().slice(0, ISO_DATE_LENGTH);
}

/**
 * Returns `{ exceptions, failures }`. With any failure, `exceptions` is empty, so a broken
 * file never relaxes a gate.
 */
export function readQualityExceptions(raw, today) {
  const entries = parseDatedEntries(raw, "path", hasKnownGate);
  if (entries === undefined) {
    return {
      exceptions: [],
      failures: [
        `quality-exceptions.json is invalid: each entry needs gate (${QUALITY_GATES.join(", ")}), path, reason and expires (YYYY-MM-DD).`,
      ],
    };
  }
  const expired = entries.filter(({ expires }) => expires < today);
  if (expired.length > 0) {
    return {
      exceptions: [],
      failures: expired.map(
        ({ gate, path, expires }) => `quality exception expired on ${expires}: ${gate} ${path}.`,
      ),
    };
  }
  return { exceptions: entries, failures: [] };
}

/** Reads the file and throws on any failure: for gates that cannot report a list. */
export function loadQualityExceptions(file = QUALITY_EXCEPTIONS_FILE, today = todayIso()) {
  const { exceptions, failures } = readQualityExceptions(readFileSync(file, "utf8"), today);
  if (failures.length > 0) {
    throw new Error(failures.join("\n"));
  }
  return exceptions;
}

/** Paths excepted from one gate. */
export function exceptedPaths(exceptions, gate) {
  return exceptions.filter((entry) => entry.gate === gate).map(({ path }) => path);
}
