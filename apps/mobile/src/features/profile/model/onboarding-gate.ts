import type { StoredProfile } from "./profile-stub";
import type { OnboardingSkipState } from "../ports/onboarding-skip";

/** What the gate reads of the profile query: its status, and the profile (`null`: never saved). */
export interface ProfileQueryView {
  readonly status: "pending" | "error" | "success";
  readonly data: StoredProfile | null | undefined;
}

export type OnboardingGate = "show" | "skip";

/**
 * Screen 27 opens only when the server said there is no profile (404) and the person did not skip it
 * on this phone. Loading, no network, a server down or any error go to the app: nobody is held on the
 * quick profile (E4.3, D6).
 */
export function onboardingGate(
  profile: ProfileQueryView,
  skip: OnboardingSkipState,
): OnboardingGate {
  return profile.status === "success" && profile.data === null && skip === "notSkipped"
    ? "show"
    : "skip";
}
