import type { InstallationIdStore } from "../features/notifications/ports/installation-id-store";

export const FAKE_INSTALLATION_ID = "8a4c2f0e-4444-4c3b-9d2e-0000000000ee";

/** The installation id of the tests: in memory, made as `FAKE_INSTALLATION_ID` the first time. */
export function createMemoryInstallationIdStore(
  initial: string | null = null,
): InstallationIdStore {
  const state = { value: initial };
  return {
    read: () => Promise.resolve(state.value),
    readOrCreate: () => {
      state.value ??= FAKE_INSTALLATION_ID;
      return Promise.resolve(state.value);
    },
  };
}
