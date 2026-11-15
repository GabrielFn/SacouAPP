import { useSyncExternalStore } from "react";

import { useServices } from "../services-context";
import type { SessionSnapshot } from "./auth-session";

/** The session as the SDK sees it: a thin read, never a copy (frontend.md, rule 1). */
export function useSession(): SessionSnapshot {
  const { authSession } = useServices();
  return useSyncExternalStore(
    (listener) => authSession.subscribe(listener),
    () => authSession.snapshot(),
  );
}
