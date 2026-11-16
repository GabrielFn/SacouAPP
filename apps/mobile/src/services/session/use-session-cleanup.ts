import { useIsRestoring } from "@tanstack/react-query";
import { useEffect } from "react";

import type { SessionSnapshot } from "../auth/auth-session";
import { useServices } from "../services-context";

/**
 * Signed out, nothing of the last account stays: the app may have opened that way, or the session
 * fell elsewhere (ADR 0057, D4). It waits for the restore of `sacou-cache.db`, which would otherwise
 * bring the old cache back after the cleanup.
 */
export function useSessionCleanup(session: SessionSnapshot): void {
  const { sessionEnder } = useServices();
  const restoring = useIsRestoring();
  const signedOut = session.status === "signedOut";
  useEffect(() => {
    if (signedOut && !restoring) void sessionEnder.cleanUp();
  }, [signedOut, restoring, sessionEnder]);
}
