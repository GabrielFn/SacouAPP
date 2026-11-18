import { useEffect, useState } from "react";

import { useServices } from "../../../services/services-context";
import { readIndividualPoints } from "../session/individual-points";
import { useCourtRuntime } from "./court-runtime-context";
import { useCourtSession } from "./use-court-session";

interface ReadOfSession {
  readonly courtSessionId: string;
  readonly on: boolean;
}

/**
 * "Ponto individual" of the round of the open court session. It is a read of the log and of the
 * rounds cache, done once per session; until it answers, the option counts as off.
 */
export function useIndividualPoints(): boolean {
  const { log } = useCourtRuntime();
  const { courtRoundSettings } = useServices();
  const { courtSessionId } = useCourtSession();
  const [read, setRead] = useState<ReadOfSession | null>(null);
  useEffect(() => {
    const alive = { current: true };
    void readIndividualPoints(log, courtRoundSettings, courtSessionId).then((on) => {
      if (alive.current) setRead({ courtSessionId, on });
    });
    return () => {
      alive.current = false;
    };
  }, [log, courtRoundSettings, courtSessionId]);
  return read?.courtSessionId === courtSessionId && read.on;
}
