import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import { err, ok } from "@sacou/volley-rules";

import { googleFailureOf } from "./auth-failure-codes";
import type { GoogleAccountPicker } from "./firebase-auth-session";

/**
 * The native Google picker (the account chooser of Android). `webClientId` is public, not a secret: it
 * names the OAuth client whose ID token Firebase accepts (ADR 0057, D1).
 */
export function createGoogleAccountPicker(webClientId: string): GoogleAccountPicker {
  GoogleSignin.configure({ webClientId });
  return {
    async pick() {
      try {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        const response = await GoogleSignin.signIn();
        if (response.type === "cancelled") return err("cancelled");
        const { idToken } = response.data;
        return idToken === null ? err("unexpected") : ok(idToken);
      } catch (error) {
        return err(googleFailureOf(error, statusCodes));
      }
    },
    async forget() {
      await GoogleSignin.signOut();
    },
  };
}
