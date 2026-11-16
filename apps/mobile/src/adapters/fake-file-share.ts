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
  const failure: { next: FileShareFailure | null } = { next: null };
  return {
    shareJsonFile(name, text) {
      log.value = [...log.value, { name, text }];
      const next = failure.next;
      failure.next = null;
      return Promise.resolve(next === null ? ok(null) : err(next));
    },
    shared: () => log.value,
    fail(next) {
      failure.next = next;
    },
  };
}

export interface FakeTempFileSdk extends TempFileSdk {
  /** `write:<name>`, `share:<uri>` and `remove:<uri>`, in order. */
  readonly log: () => readonly string[];
  /** Files written and not removed yet. */
  readonly files: () => ReadonlyMap<string, string>;
}

export interface FakeTempFileSdkOptions {
  readonly canShare?: boolean;
  readonly shareFails?: boolean;
}

/** The SDK under `createTempFileShare`, in memory: what was written, shared and removed. */
export function createFakeTempFileSdk(options: FakeTempFileSdkOptions = {}): FakeTempFileSdk {
  const log = { value: [] as readonly string[] };
  const files = { value: new Map<string, string>() as ReadonlyMap<string, string> };
  const note = (line: string) => {
    log.value = [...log.value, line];
  };
  return {
    canShare: () => Promise.resolve(options.canShare ?? true),
    write(name, text) {
      const uri = `file:///cache/${name}`;
      note(`write:${name}`);
      files.value = new Map([...files.value, [uri, text]]);
      return Promise.resolve(uri);
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
    log: () => log.value,
    files: () => files.value,
  };
}
