// Reads pnpm-lock.yaml, which holds one document for the tooling and one for the workspace.
import { URL } from "node:url";

import { loadAll } from "js-yaml";

const ALLOWED_TARBALL_PROTOCOL = "https:";
const ALLOWED_TARBALL_HOST = "registry.npmjs.org";
const IMPORTER_DEPENDENCY_FIELDS = ["dependencies", "devDependencies", "optionalDependencies"];
const PEER_SUFFIX = /\(.*$/;

/** Returns the documents, or undefined when the text is not YAML or has no document. */
export function parseLockfile(raw) {
  try {
    const documents = loadAll(raw).filter((document) => document !== null);
    return documents.length > 0 ? documents : undefined;
  } catch {
    return undefined;
  }
}

/** Lists what the importers declare, with the locked version and without the peer suffix. */
export function listDirectDependencies(documents) {
  return documents
    .flatMap((document) => Object.values(document.importers ?? {}))
    .flatMap((importer) =>
      IMPORTER_DEPENDENCY_FIELDS.flatMap((field) => Object.entries(importer[field] ?? {})),
    )
    .map(([name, { version }]) => ({ name, version: String(version).replace(PEER_SUFFIX, "") }));
}

export function listPackageKeys(documents) {
  return documents.flatMap((document) => Object.keys(document.packages ?? {}));
}

function isAllowedTarball(tarball) {
  if (!URL.canParse(tarball)) {
    return false;
  }
  const { protocol, host } = new URL(tarball);
  return protocol === ALLOWED_TARBALL_PROTOCOL && host === ALLOWED_TARBALL_HOST;
}

/** Returns the reasons to fail; an empty list means every tarball comes from the npm registry. */
export function findTarballSourceFailures(documents) {
  return documents
    .flatMap((document) => Object.entries(document.packages ?? {}))
    .flatMap(([key, entry]) => {
      const tarball = entry?.resolution?.tarball;
      return tarball === undefined || isAllowedTarball(tarball)
        ? []
        : [`pnpm-lock.yaml resolves ${key} from ${tarball}, outside ${ALLOWED_TARBALL_HOST}.`];
    });
}
