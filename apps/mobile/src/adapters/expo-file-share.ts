import { File, Paths } from "expo-file-system";
import { isAvailableAsync, shareAsync } from "expo-sharing";

import type { FileShare } from "../services/share/file-share";
import { createTempFileShare, type TempFileSdk } from "./temp-file-share";

const JSON_MIME = "application/json";
const JSON_UTI = "public.json";

/** The only file that touches `expo-file-system` and `expo-sharing` (frontend.md, rule 3). */
const expoTempFileSdk: TempFileSdk = {
  canShare: () => isAvailableAsync(),
  write(name, text) {
    // The cache directory of the app: private, outside the backup (`allowBackup: false`).
    const file = new File(Paths.cache, name);
    if (file.exists) file.delete();
    file.create();
    file.write(text);
    return Promise.resolve(file.uri);
  },
  share: (uri) => shareAsync(uri, { mimeType: JSON_MIME, UTI: JSON_UTI }),
  remove(uri) {
    const file = new File(uri);
    if (file.exists) file.delete();
    return Promise.resolve();
  },
};

/** Sheet 30a: the export as a temporary file in the share sheet, deleted when it closes (E4.3, D9). */
export const expoFileShare: FileShare = createTempFileShare(expoTempFileSdk);
