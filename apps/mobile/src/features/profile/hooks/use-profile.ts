import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

import { useServices } from "../../../services/services-context";
import { onboardingGate, type OnboardingGate } from "../model/onboarding-gate";
import type { OnboardingSkipState } from "../ports/onboarding-skip";
import { myProfileQuery } from "../queries/profile-queries";

// The profile stays only in the query cache and the flag only in its store (frontend.md, rule 1).

export function useMyProfile(enabled = true) {
  const { sacouApi } = useServices();
  return useQuery(myProfileQuery(sacouApi, enabled));
}

export function useOnboardingSkip(): OnboardingSkipState {
  const { onboardingSkip } = useServices();
  return useSyncExternalStore(onboardingSkip.subscribe, onboardingSkip.snapshot);
}

/** Whether the session gate opens screen 27 (E4.3, D6); signed out it never asks for the profile. */
export function useOnboardingGate(signedIn: boolean): OnboardingGate {
  const profile = useMyProfile(signedIn);
  const skip = useOnboardingSkip();
  return signedIn ? onboardingGate(profile, skip) : "skip";
}
