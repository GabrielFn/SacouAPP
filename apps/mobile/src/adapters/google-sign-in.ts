import {
  GoogleSignin,
  statusCodes,
  type SignInResponse,
} from "@react-native-google-signin/google-signin";
import { err, ok, type Result } from "@sacou/volley-rules";

import type { AuthFailure } from "../services/auth/auth-session";
import { googleFailureOf } from "./auth-failure-codes";
import type { AuthFailureReporter, AuthStage } from "./auth-failure-report";
import type { GoogleAccountPicker } from "./firebase-auth-session";

const SUCCESS = "success";
const CANCELLED = "cancelled";

/** An answer of the picker with a `type` the library does not document. */
class UnknownGoogleResponse extends Error {
  constructor() {
    super("unknown response type");
    this.name = "UnknownGoogleResponse";
  }
}

/** The answer as it is read at run time: `data` may be missing, whatever the types say. */
interface SuccessAnswer {
  readonly data: { readonly idToken: string | null };
}

/**
 * The native Google picker (the account chooser of Android). `webClientId` is public, not a secret: it
 * names the OAuth client whose ID token Firebase accepts (ADR 0057, D1). Each call of the SDK is its own
 * stage, so an unexpected failure reaches Sentry with where it happened (E5.2b).
 */
export function createGoogleAccountPicker(
  webClientId: string,
  failures: AuthFailureReporter,
): GoogleAccountPicker {
  GoogleSignin.configure({ webClientId });

  async function step<T>(
    stage: AuthStage,
    action: () => Promise<T>,
  ): Promise<Result<T, AuthFailure>> {
    try {
      return ok(await action());
    } catch (error) {
      const failure = googleFailureOf(error, statusCodes);
      failures.report({ stage, failure, thrown: { error } });
      return err(failure);
    }
  }

  /** The ID token of the answer; a missing one or a malformed answer is `unexpected` (criteria 5, 6). */
  function idTokenOf(response: SignInResponse): Result<string, AuthFailure> {
    try {
      const type: string = response.type;
      if (type === CANCELLED) return err("cancelled");
      if (type !== SUCCESS) throw new UnknownGoogleResponse();
      const { idToken } = (response as SuccessAnswer).data;
      if (idToken !== null) return ok(idToken);
      failures.report({
        stage: "google-response",
        failure: "unexpected",
        google: { responseType: SUCCESS, hasIdToken: false },
      });
      return err("unexpected");
    } catch (error) {
      failures.report({
        stage: "google-response",
        failure: "unexpected",
        thrown: { error },
        google: { responseType: "other", hasIdToken: false },
      });
      return err("unexpected");
    }
  }

  return {
    async pick() {
      const played = await step("google-play-services", () =>
        GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true }),
      );
      if (!played.ok) return played;
      const signed = await step("google-picker", () => GoogleSignin.signIn());
      if (!signed.ok) return signed;
      return idTokenOf(signed.value);
    },
    async forget() {
      await GoogleSignin.signOut();
    },
    async revoke() {
      await GoogleSignin.revokeAccess();
    },
  };
}
