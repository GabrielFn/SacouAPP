import { err, ok } from "@sacou/volley-rules";

import type { FileShare } from "../services/share/file-share";

/** The few calls of `expo-file-system` and `expo-sharing` the share needs (expo-file-share.ts). */
export interface TempFileSdk {
  canShare(): Promise<boolean>;
  /** Writes the file in the temporary directory of the app and gives its URI. */
  write(name: string, text: string): Promise<string>;
  /** Resolves when the share sheet closes. */
  share(uri: string): Promise<void>;
  remove(uri: string): Promise<void>;
}

/**
 * The file lives only while the sheet is open: it is deleted after, also when sharing fails, so the
 * personal data does not stay in the cache directory of the app (E4.3, D9).
 */
export function createTempFileShare(sdk: TempFileSdk): FileShare {
  return {
    async shareJsonFile(name, text) {
      if (!(await sdk.canShare().catch(() => false))) return err("unavailable");
      const written: { uri: string | null } = { uri: null };
      try {
        written.uri = await sdk.write(name, text);
        await sdk.share(written.uri);
        return ok(null);
      } catch {
        // The reason may carry the path: only the kind goes on.
        return err("failed");
      } finally {
        if (written.uri !== null) await sdk.remove(written.uri).catch(() => null);
      }
    },
  };
}
