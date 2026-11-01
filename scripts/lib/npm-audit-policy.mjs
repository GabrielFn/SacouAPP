// What `pnpm audit` does not control: the expiry of audit.ignore entries, and a direct use of a
// package whose advisory is ignored, since an entry applies to the GHSA and not to one path.
import { parseExceptions } from "./audit-exceptions.mjs";

const ZOD_PACKAGE = "zod";
const ZOD_ALIAS_PREFIX = "npm:zod@";
const CATALOG_SPEC = "catalog:";
const MINIMUM_ZOD_VERSION = "4.6.6";
const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];
const SINGLE_LOWER_BOUND = /^(?:\^|~|>=)?(\d+\.\d+\.\d+)$/;
const AUDIT_BLOCK = /^audit:\n((?:[ \t]+.*\n?)*)/m;
const GHSA_ID = /GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}/g;
const CATALOG_ZOD_ENTRY = /^catalog:\n(?:[ \t]+.*\n)*?[ \t]+["']?zod["']?:[ \t]*["']?([^"'\s]+)/m;

function listIgnoredAdvisories(workspaceYaml) {
  const block = AUDIT_BLOCK.exec(workspaceYaml)?.[1] ?? "";
  return block.match(GHSA_ID) ?? [];
}

function findExceptionFailures(ignored, exceptions, today) {
  const missing = ignored
    .filter((id) => !exceptions.some(({ advisory }) => advisory === id))
    .map((id) => `audit.ignore has ${id} without an entry in npm-audit-exceptions.json.`);
  const stale = exceptions
    .filter(({ advisory }) => !ignored.includes(advisory))
    .map(({ advisory }) => `npm-audit-exceptions.json has ${advisory}, absent from audit.ignore.`);
  const expired = exceptions
    .filter(({ expires }) => expires < today)
    .map(({ advisory, expires }) => `Exception for ${advisory} expired on ${expires}.`);
  return [...missing, ...stale, ...expired];
}

function compareVersions(left, right) {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  const index = leftParts.findIndex((part, position) => part !== rightParts[position]);
  return index === -1 ? 0 : leftParts[index] - rightParts[index];
}

function listZodSpecs(manifest) {
  return DEPENDENCY_FIELDS.flatMap((field) => Object.entries(manifest[field] ?? {})).flatMap(
    ([name, spec]) => {
      if (spec.startsWith(ZOD_ALIAS_PREFIX)) {
        return [spec.slice(ZOD_ALIAS_PREFIX.length)];
      }
      return name === ZOD_PACKAGE ? [spec] : [];
    },
  );
}

function isAcceptedZodSpec(spec, workspaceYaml) {
  const resolved = spec.startsWith(CATALOG_SPEC)
    ? CATALOG_ZOD_ENTRY.exec(workspaceYaml)?.[1]
    : spec;
  const lowerBound = SINGLE_LOWER_BOUND.exec(resolved ?? "")?.[1];
  return lowerBound !== undefined && compareVersions(lowerBound, MINIMUM_ZOD_VERSION) >= 0;
}

function findZodFailures(manifests, workspaceYaml) {
  return manifests.flatMap(({ path, manifest }) =>
    listZodSpecs(manifest)
      .filter((spec) => !isAcceptedZodSpec(spec, workspaceYaml))
      .map(
        (spec) => `${path} declares zod "${spec}"; use a range starting at ${MINIMUM_ZOD_VERSION}.`,
      ),
  );
}

/** Returns the reasons to fail; an empty list means the policy holds. */
export function findNpmAuditPolicyFailures({ workspaceYaml, rawExceptions, manifests, today }) {
  const exceptions = parseExceptions(rawExceptions);
  if (exceptions === undefined) {
    return ["npm-audit-exceptions.json is invalid: each entry needs advisory, reason and expires."];
  }
  return [
    ...findExceptionFailures(listIgnoredAdvisories(workspaceYaml), exceptions, today),
    ...findZodFailures(manifests, workspaceYaml),
  ];
}
