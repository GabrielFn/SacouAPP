// Reads a file from a git ref for check:api-compat (ADR 0042, D4). Only a ref that exists and lacks the file
// counts as "no contract yet"; a missing ref, or any other git failure, is an error, so the gate never passes
// by accident.
import { execFileSync } from "node:child_process";

export const BASE_CONTRACT = Object.freeze({
  FOUND: "found",
  ABSENT: "absent",
  MISSING_REF: "missing-ref",
});

function git(cwd, args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
}

function refExists(cwd, ref) {
  try {
    git(cwd, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

/** `{ status, text }`: FOUND with the file's text, ABSENT when the ref has no such file, or MISSING_REF. */
export function readBaseContract({ cwd, ref, path }) {
  if (!refExists(cwd, ref)) return { status: BASE_CONTRACT.MISSING_REF };
  const listed = git(cwd, ["ls-tree", "--name-only", ref, "--", path]).trim();
  if (listed === "") return { status: BASE_CONTRACT.ABSENT };
  return { status: BASE_CONTRACT.FOUND, text: git(cwd, ["show", `${ref}:${path}`]) };
}
