import { OnboardingScreen } from "../features/profile/ui/OnboardingScreen";
import { useSession } from "../services/auth/use-session";

/** Screen 27 on the first access: only while the profile is missing and was not skipped (D6). */
export default function OnboardingRoute() {
  const session = useSession();
  return session.status === "signedIn" ? <OnboardingScreen account={session.account} /> : null;
}
