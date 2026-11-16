import { err, ok } from "@sacou/volley-rules";

import type { FileShare } from "../services/share/file-share";

/** A file in the temporary directory of the app. */
export interface TempFile {
  readonly name: string;
  readonly uri: string;
}

/** The few calls of `expo-file-system` and `expo-sharing` the share needs (expo-file-share.ts). */
export interface TempFileSdk {
  canShare(): Promise<boolean>;
  /** Creates the empty file in the temporary directory of the app and gives its URI. */
  create(name: string): Promise<string>;
  write(uri: string, text: string): Promise<void>;
  /** Resolves when the share sheet closes. */
  share(uri: string): Promise<void>;
  remove(uri: string): Promise<void>;
  /** The files of the temporary directory. */
  list(): Promise<readonly TempFile[]>;
}

/**
 * The file lives only while the sheet is open: it is deleted after, also when writing or sharing fails,
 * so the personal data does not stay in the cache directory of the app (E4.3, D9). What a crash left
 * behind goes when the app opens again (`removeLeftovers`).
 */
export function createTempFileShare(sdk: TempFileSdk): FileShare {
  return {
    async shareJsonFile(name, text) {
      if (!(await sdk.canShare().catch(() => false))) return err("unavailable");
      const created: { value: string | null } = { value: null };
      try {
        created.value = await sdk.create(name);
        await sdk.write(created.value, text);
        await sdk.share(created.value);
        return ok(null);
      } catch {
        // The reason may carry the path: only the kind goes on.
        return err("failed");
      } finally {
        if (created.value !== null) await sdk.remove(created.value).catch(() => null);
      }
    },
    async removeLeftovers(prefix) {
      const files = await sdk.list().catch(() => []);
      const leftovers = files.filter((file) => file.name.startsWith(prefix));
      await Promise.all(leftovers.map((file) => sdk.remove(file.uri).catch(() => null)));
    },
  };
}
