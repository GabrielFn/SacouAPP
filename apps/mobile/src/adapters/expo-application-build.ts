import { nativeBuildVersion } from "expo-application";
import { Platform } from "react-native";

import type { AppBuild } from "../features/app-config/app-build";
import { parseNativeBuild } from "../features/app-config/model/app-build-headers";

/**
 * The build of the installed binary (`versionCode` on Android, `CFBundleVersion` on iOS), read from the
 * native side: an OTA update never changes it (ADR 0084). A binary that does not tell has no build, and
 * is then never blocked.
 */
export const expoApplicationBuild: AppBuild = {
  platform: Platform.OS === "ios" ? "ios" : "android",
  build: parseNativeBuild(nativeBuildVersion),
};
