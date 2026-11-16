import type { SaveMyProfileBody } from "../../../services/api/sacou-api";
import type { OnboardingSkip } from "../ports/onboarding-skip";
import type { ProfileFormState } from "./profile-form.reducer";
import { skipRequest } from "./profile-form.selectors";

export interface SkipQuickProfileDeps {
  readonly onboardingSkip: Pick<OnboardingSkip, "markSkipped">;
  readonly save: (body: SaveMyProfileBody) => void;
}

/**
 * "Pular" (question 40): the nickname of the field is saved when there is one, and the flag lets the
 * person into the app at once, with or without a network (nobody is held on screen 27).
 */
export function skipQuickProfile(state: ProfileFormState, deps: SkipQuickProfileDeps): void {
  const body = skipRequest(state);
  if (body !== null) deps.save(body);
  void deps.onboardingSkip.markSkipped();
}
