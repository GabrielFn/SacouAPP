import type { AppForeground } from "../features/court/ports/app-foreground";
import { createListeners } from "./listeners";

export interface FakeAppForeground extends AppForeground {
  /** As if the person came back to the app. */
  bringToFront(): void;
}

export function createFakeAppForeground(): FakeAppForeground {
  const listeners = createListeners();
  return { subscribe: listeners.add, bringToFront: listeners.notify };
}
