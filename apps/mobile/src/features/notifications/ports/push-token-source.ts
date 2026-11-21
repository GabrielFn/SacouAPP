import type { components } from "../../../api/generated/schema";

export type PushPlatform = components["schemas"]["PushDevicePlatform"];

/**
 * The Expo push token of this phone and its platform. The token is personal data that can send messages
 * to the phone: it goes only to the API and is never logged, cached nor shown (E3.11, section 6).
 */
export interface PushToken {
  readonly token: string;
  readonly platform: PushPlatform;
}

/** Where the push token of this phone comes from (E3.11). */
export interface PushTokenSource {
  /** `null` when the phone gives none (no permission, emulator, no network to the push service). */
  getToken(): Promise<PushToken | null>;
  /** The system replaced the token; the returned function stops listening. */
  onTokenChange(listener: (token: PushToken) => void): () => void;
  /** Stops this phone receiving pushes until a new token is asked for (the exit of the account). */
  unregister(): Promise<void>;
}
