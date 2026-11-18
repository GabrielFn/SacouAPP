import { useState } from "react";

import { useServices } from "../../../services/services-context";
import { useCourtSync } from "../../court/hooks/court-sync-context";
import type { UnsentSummary } from "../../court/ports/court-sync";
import { signOutOrWarn } from "../model/sign-out-flow";

export interface SignOutModel {
  /** The events not sent yet while the warning shows, or `null`. */
  readonly warning: UnsentSummary | null;
  readonly request: () => void;
  readonly confirm: () => void;
  readonly cancel: () => void;
}

/** "Sair" of screen 30, through the `SessionEnder`, with the warning of question 84. */
export function useSignOut(): SignOutModel {
  const { sessionEnder } = useServices();
  const sync = useCourtSync();
  // Simple state of one field (frontend.md, rule 4): the warning is open or not.
  const [warning, setWarning] = useState<UnsentSummary | null>(null);
  const signOut = () => {
    void sessionEnder.end("signedOut");
  };
  return {
    warning,
    request: () => {
      void signOutOrWarn({ countUnsent: () => sync.countUnsent(), signOut, warn: setWarning });
    },
    confirm: () => {
      setWarning(null);
      signOut();
    },
    cancel: () => {
      setWarning(null);
    },
  };
}
