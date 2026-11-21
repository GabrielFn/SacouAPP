import { useIsFocused } from "expo-router";
import { useEffect, useState } from "react";

import { DEV_TOOLS_ENABLED } from "../../../config/dev-tools";
import { readActiveCourt, type ActiveCourt } from "../session/active-court";
import { useCourtRuntime } from "./court-runtime-context";
import { useCourtSync } from "./court-sync-context";

/**
 * The match open on this device (R97, D1), for the bar "EM QUADRA" of the home. The log is the one
 * source: this is a read of it, done again each time the screen comes back to the front and when the
 * upload changed a session (a take-over closes the court here), never a copy the screen edits.
 */
export function useActiveCourt(): ActiveCourt | null {
  const runtime = useCourtRuntime();
  const sync = useCourtSync();
  const focused = useIsFocused();
  const [changes, setChanges] = useState(0);
  const [court, setCourt] = useState<ActiveCourt | null>(null);
  useEffect(
    () =>
      sync.onSessionChanged(() => {
        setChanges((count) => count + 1);
      }),
    [sync],
  );
  useEffect(() => {
    if (!focused) return;
    const alive = { current: true };
    void readActiveCourt(runtime, { includeSamples: DEV_TOOLS_ENABLED }).then((read) => {
      if (alive.current) setCourt(read);
    });
    return () => {
      alive.current = false;
    };
  }, [runtime, focused, changes]);
  return focused ? court : null;
}
