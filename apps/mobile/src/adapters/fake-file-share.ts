import { err, ok } from "@sacou/volley-rules";

import type { FileShare, FileShareFailure } from "../services/share/file-share";
import type { TempFileSdk } from "./temp-file-share";

export interface SharedFile {
  readonly name: string;
  readonly text: string;
}

export interface FakeFileShare extends FileShare {
  /** Every file shared, in order. */
  shared(): readonly SharedFile[];
  /** The next share gives this failure (once). */
  fail(failure: FileShareFailure): void;
}

/** The `FileShare` of the screens' tests: records the file, opens nothing. */
export function createFakeFileShare(): FakeFileShare {
  const log = { value: [] as readonly SharedFile[] };
  const failure: { value: FileShareFailure | null } = { value: null };
  return {
    removeLeftovers: () => Promise.resolve(),
    shareJsonFile(name, text) {
      log.value = [...log.value, { name, text }];
      const next = failure.value;
      failure.value = null;
      return Promise.resolve(next === null ? ok(null) : err(next));
    },
    shared: () => log.value,
    fail(next) {
      failure.value = next;
    },
  };
}

export interface FakeTempFileSdk extends TempFileSdk {
  /** `create:<name>`, `write:<uri>`, `share:<uri>` and `remove:<uri>`, in order. */
  readonly log: () => readonly string[];
  /** Files written and not removed yet. */
  readonly files: () => ReadonlyMap<string, string>;
}

export interface FakeTempFileSdkOptions {
  readonly canShare?: boolean;
  readonly shareFails?: boolean;
  readonly writeFails?: boolean;
  /** Files already in the directory when the app opens (left by a crash, or of other features). */
  readonly existing?: ReadonlyMap<string, string>;
}

/** The SDK under `createTempFileShare`, in memory: what was written, shared and removed. */
export function createFakeTempFileSdk(options: FakeTempFileSdkOptions = {}): FakeTempFileSdk {
  const log = { value: [] as readonly string[] };
  const files = {
    value: new Map<string, string>(options.existing ?? []) as ReadonlyMap<string, string>,
  };
  const note = (line: string) => {
    log.value = [...log.value, line];
  };
  return {
    canShare: () => Promise.resolve(options.canShare ?? true),
    create(name) {
      const uri = `file:///cache/${name}`;
      note(`create:${name}`);
      files.value = new Map([...files.value, [uri, ""]]);
      return Promise.resolve(uri);
    },
    write(uri, text) {
      note(`write:${uri}`);
      if (options.writeFails === true) return Promise.reject(new Error(`no space for ${uri}`));
      files.value = new Map([...files.value, [uri, text]]);
      return Promise.resolve();
    },
    share(uri) {
      note(`share:${uri}`);
      return options.shareFails === true
        ? Promise.reject(new Error(`share failed for ${uri}`))
        : Promise.resolve();
    },
    remove(uri) {
      note(`remove:${uri}`);
      files.value = new Map([...files.value].filter(([key]) => key !== uri));
      return Promise.resolve();
    },
    list: () =>
      Promise.resolve(
        [...files.value.keys()].map((uri) => ({ name: uri.slice(uri.lastIndexOf("/") + 1), uri })),
      ),
    log: () => log.value,
    files: () => files.value,
  };
}
