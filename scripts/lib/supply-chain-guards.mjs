// Guards the SEC-M1 review left open (E5.3, ADR 0082, section "Pendências do SEC-M1"). Each takes text, so the
// tests plant the deviation they reject:
// - every .csproj has its packages.lock.json committed (a missing one is silently recreated by the restore);
// - every <NuGetAuditSuppress> has a live entry in nuget-audit-exceptions.json: a suppressed advisory leaves the
//   `dotnet list --vulnerable` report, so its expiry is checked here or nowhere;
// - install scripts stay off: allowBuilds only with false, no switch that turns the strict check off.
import { load } from "js-yaml";

const LOCK_FILE = "packages.lock.json";
const SUPPRESSION = /<NuGetAuditSuppress\b[^>]*\bInclude\s*=\s*"([^"]*)"/g;
// Keys of the workspace or of .npmrc that would let an install script run without review.
const BUILD_SWITCHES = [
  "strictDepBuilds",
  "strict-dep-builds",
  "dangerouslyAllowAllBuilds",
  "dangerously-allow-all-builds",
  "onlyBuiltDependencies",
  "only-built-dependencies",
  "neverBuiltDependencies",
  "never-built-dependencies",
  "ignoreDepScripts",
  "ignore-dep-scripts",
  "ignoreScripts",
  "ignore-scripts",
];

function directoryOf(path) {
  const slash = path.lastIndexOf("/");
  return slash < 0 ? "" : path.slice(0, slash + 1);
}

/** Paths use "/". Returns one failure per .csproj without a packages.lock.json next to it. */
export function findLockFileFailures(paths) {
  const present = new Set(paths);
  return paths
    .filter((path) => path.endsWith(".csproj"))
    .filter((project) => !present.has(`${directoryOf(project)}${LOCK_FILE}`))
    .map((project) => `${project} has no ${LOCK_FILE} committed next to it.`);
}

/** `files` maps a .props, .targets or .csproj path to its text; `exceptions` are the parsed NuGet exceptions. */
export function findSuppressionFailures({ files, exceptions, today }) {
  return Object.entries(files).flatMap(([path, text]) =>
    [...text.matchAll(SUPPRESSION)].flatMap(([, advisory]) => {
      const entry = exceptions.find((exception) => exception.advisory === advisory);
      if (entry === undefined) {
        return [`${path} suppresses ${advisory} without an entry in nuget-audit-exceptions.json.`];
      }
      return entry.expires < today
        ? [`${path} suppresses ${advisory}, whose exception expired on ${entry.expires}.`]
        : [];
    }),
  );
}

/** Returns the failures of pnpm-workspace.yaml and .npmrc for install scripts. */
export function findBuildScriptFailures({ workspaceYaml, npmrc }) {
  const workspace = load(workspaceYaml) ?? {};
  const allowed = Object.entries(workspace.allowBuilds ?? {})
    .filter(([, value]) => value !== false)
    .map(
      ([name]) =>
        `allowBuilds lets ${name} run its install script; only false is accepted (ADR 0001).`,
    );
  const switches = BUILD_SWITCHES.filter(
    (key) => key in workspace || new RegExp(`^\\s*${key}\\s*=`, "m").test(npmrc),
  ).map((key) => `${key} changes the review of install scripts; remove it (ADR 0001).`);
  return [...allowed, ...switches];
}
