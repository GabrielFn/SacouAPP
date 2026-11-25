/** The store platforms the API knows by name (`X-Sacou-App-Platform`). */
export type AppPlatform = "android" | "ios";

/**
 * Which native build of the app runs (ADR 0084): the number of the store version, read from the binary,
 * never from an OTA update. `build` is `null` when the binary does not tell: such an app is never
 * blocked and never names itself to the API.
 */
export interface AppBuild {
  readonly platform: AppPlatform;
  readonly build: number | null;
}
