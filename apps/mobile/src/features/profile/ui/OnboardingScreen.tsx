import type { AccountView } from "../../../services/auth/auth-session";
import { initFromAccount } from "../model/profile-form.reducer";
import { QuickProfileScreen } from "./QuickProfileScreen";

export interface OnboardingScreenProps {
  readonly account: AccountView;
}

/** Nothing to do once saved: the profile lands in the cache, and the session gate leaves screen 27. */
const LEAVES_BY_THE_GATE = (): void => undefined;

/** Screen 27 on the first access: the nickname starts as the first name of the provider (question 40). */
export function OnboardingScreen({ account }: OnboardingScreenProps) {
  return (
    <QuickProfileScreen
      mode="onboarding"
      initial={initFromAccount(account.displayName)}
      onSaved={LEAVES_BY_THE_GATE}
    />
  );
}
