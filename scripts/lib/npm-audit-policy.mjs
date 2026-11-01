// What `pnpm audit` does not control: the expiry of audit.ignore entries, a direct use of a package
// whose advisory is ignored, since an entry applies to the GHSA and not to one path, and where the
// lockfile downloads packages from.
import { load } from "js-yaml";

import { parseExceptions } from "./audit-exceptions.mjs";
import {
  findTarballSourceFailures,
  listDirectDependencies,
  listPackageKeys,
  parseLockfile,
} from "./pnpm-lockfile.mjs";

const ZOD_PACKAGE = "zod";
const ZOD_LOCKED_PREFIX = "zod@";
const CATALOG_SPEC = "catalog:";
const MINIMUM_ZOD_VERSION = "4.6.6";
const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];
const SINGLE_LOWER_BOUND = /^(?:\^|~|>=)?(\d+\.\d+\.\d+)$/;
const EXACT_VERSION = /^\d+\.\d+\.\d+$/;
const ZOD_ALIAS = /^npm:zod(?:@(.*))?$/;
const OTHER_PACKAGE_ALIAS_PREFIX = "npm:";
const MENTIONS_ZOD = /zod/i;
const ANY_ADVISORY = /ghsa-/i;
const MAX_EXCEPTION_DAYS = 180;
const MILLISECONDS_PER_DAY = 86_400_000;
const ISO_DATE_LENGTH = 10;

function parseWorkspace(raw) {
  try {
    const workspace = load(raw) ?? {};
    return typeof workspace === "object" && !Array.isArray(workspace) ? workspace : undefined;
  } catch {
    return undefined;
  }
}

function listIgnoredAdvisories(workspace) {
  const ignore = workspace.audit?.ignore ?? [];
  return (Array.isArray(ignore) ? ignore : [ignore]).map(String);
}

function findStrayAdvisoryFailures(workspace) {
  const audit = { ...workspace.audit, ignore: undefined };
  return ANY_ADVISORY.test(JSON.stringify({ ...workspace, audit }))
    ? ["pnpm-workspace.yaml has a GHSA outside audit.ignore, where its expiry is not checked."]
    : [];
}

function latestAllowedExpiry(today) {
  const limit = Date.parse(`${today}T00:00:00Z`) + MAX_EXCEPTION_DAYS * MILLISECONDS_PER_DAY;
  return new Date(limit).toISOString().slice(0, ISO_DATE_LENGTH);
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
  const tooLong = exceptions
    .filter(({ expires }) => expires > latestAllowedExpiry(today))
    .map(
      ({ advisory, expires }) =>
        `Exception for ${advisory} expires on ${expires}, over ${MAX_EXCEPTION_DAYS} days from today.`,
    );
  return [...missing, ...stale, ...expired, ...tooLong];
}

function compareVersions(left, right) {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  const index = leftParts.findIndex((part, position) => part !== rightParts[position]);
  return index === -1 ? 0 : leftParts[index] - rightParts[index];
}

function isAcceptedZodVersion(version) {
  return version !== undefined && compareVersions(version, MINIMUM_ZOD_VERSION) >= 0;
}

/** Returns the zod range the spec declares, or undefined when it points to another package. */
function readZodRange(name, spec) {
  const alias = ZOD_ALIAS.exec(spec);
  if (alias !== null) {
    return alias[1] ?? "";
  }
  if (name === ZOD_PACKAGE) {
    return spec;
  }
  return !spec.startsWith(OTHER_PACKAGE_ALIAS_PREFIX) && MENTIONS_ZOD.test(spec) ? spec : undefined;
}

function isAcceptedZodRange(range) {
  return isAcceptedZodVersion(SINGLE_LOWER_BOUND.exec(range)?.[1]);
}

function findDeclarationFailure(path, name, spec, catalog) {
  if (spec.startsWith(CATALOG_SPEC) && spec !== CATALOG_SPEC) {
    return `${path} declares ${name} as "${spec}"; only the default "${CATALOG_SPEC}" is accepted.`;
  }
  const resolved = spec === CATALOG_SPEC ? String(catalog[name] ?? "") : spec;
  const range = readZodRange(name, resolved);
  return range === undefined || isAcceptedZodRange(range)
    ? undefined
    : `${path} declares ${name} as "${spec}"; use a zod range starting at ${MINIMUM_ZOD_VERSION}.`;
}

function findManifestFailures(manifests, workspace) {
  const catalog = workspace.catalog ?? workspace.catalogs?.default ?? {};
  return manifests.flatMap(({ path, manifest }) =>
    DEPENDENCY_FIELDS.flatMap((field) => Object.entries(manifest[field] ?? {}))
      .map(([name, spec]) => findDeclarationFailure(path, name, spec, catalog))
      .filter((failure) => failure !== undefined),
  );
}

/** Returns the locked version when the dependency is zod, under its own name or any other. */
function readLockedZodVersion({ name, version }, packageKeys) {
  if (version.startsWith(ZOD_LOCKED_PREFIX)) {
    return version.slice(ZOD_LOCKED_PREFIX.length);
  }
  return name === ZOD_PACKAGE || packageKeys.includes(`${ZOD_LOCKED_PREFIX}${version}`)
    ? version
    : undefined;
}

function isAcceptedLockedVersion(version) {
  return EXACT_VERSION.test(version) && isAcceptedZodVersion(version);
}

function findLockedZodFailures(documents) {
  const packageKeys = listPackageKeys(documents);
  return listDirectDependencies(documents).flatMap((dependency) => {
    const version = readLockedZodVersion(dependency, packageKeys);
    return version === undefined || isAcceptedLockedVersion(version)
      ? []
      : [
          `pnpm-lock.yaml locks ${dependency.name} to zod "${version}"; use ${MINIMUM_ZOD_VERSION} or above.`,
        ];
  });
}

/** Returns the reasons to fail; an empty list means the policy holds. */
export function findNpmAuditPolicyFailures({
  workspaceYaml,
  lockfileYaml,
  rawExceptions,
  manifests,
  today,
}) {
  const exceptions = parseExceptions(rawExceptions);
  if (exceptions === undefined) {
    return ["npm-audit-exceptions.json is invalid: each entry needs advisory, reason and expires."];
  }
  const workspace = parseWorkspace(workspaceYaml);
  if (workspace === undefined) {
    return ["pnpm-workspace.yaml is invalid: it must be a single YAML mapping."];
  }
  const lockfile = parseLockfile(lockfileYaml);
  if (lockfile === undefined) {
    return ["pnpm-lock.yaml is invalid: it must be YAML with at least one document."];
  }
  return [
    ...findExceptionFailures(listIgnoredAdvisories(workspace), exceptions, today),
    ...findStrayAdvisoryFailures(workspace),
    ...findManifestFailures(manifests, workspace),
    ...findLockedZodFailures(lockfile),
    ...findTarballSourceFailures(lockfile),
  ];
}
