import { randomUUID } from "expo-crypto";
import * as SecureStore from "expo-secure-store";

import type { InstallationIdStore } from "../features/notifications/ports/installation-id-store";

export const INSTALLATION_ID_KEY = "sacou.push.installation-id";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Only on this phone: a backup restored elsewhere makes a new id (ADR 0049, D7). */
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

async function read(): Promise<string | null> {
  try {
    const stored = await SecureStore.getItemAsync(INSTALLATION_ID_KEY, OPTIONS);
    return stored !== null && UUID.test(stored) ? stored : null;
  } catch {
    return null;
  }
}

const making: { current: Promise<string> | null } = { current: null };

async function make(): Promise<string> {
  const id = randomUUID().toLowerCase();
  await SecureStore.setItemAsync(INSTALLATION_ID_KEY, id, OPTIONS);
  return id;
}

/** The id of the install in the encrypted store of the system; it outlives the sessions. */
export const secureStoreInstallationIdStore: InstallationIdStore = {
  read,
  readOrCreate: async () => {
    const stored = await read();
    if (stored !== null) return stored;
    // Two first registrations at the same time make one id.
    making.current ??= make().finally(() => {
      making.current = null;
    });
    return making.current;
  },
};
