// Fails when a text file is stored in the Git index with CRLF line endings.
// The working tree state (w/) is ignored, so CRLF only on disk is never reported.
import { execFileSync } from "node:child_process";

const MAX_BUFFER_BYTES = 67_108_864;
const FORBIDDEN_INDEX_STATES = new Set(["i/crlf", "i/mixed"]);

const output = execFileSync("git", ["ls-files", "--eol"], {
  encoding: "utf8",
  maxBuffer: MAX_BUFFER_BYTES,
});

const offenders = output
  .split("\n")
  .filter((line) => line.length > 0)
  .filter((line) => FORBIDDEN_INDEX_STATES.has(line.split(/\s+/, 1)[0]));

if (offenders.length > 0) {
  console.error("Files stored with CRLF in the Git index:");
  console.error(offenders.join("\n"));
  process.exitCode = 1;
} else {
  console.log("check:eol OK: no CRLF in the Git index.");
}
