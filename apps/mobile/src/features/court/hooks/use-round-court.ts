import { useIsFocused } from "expo-router";
import { useEffect, useState } from "react";

import { readRoundCourt, type RoundCourt } from "../session/round-court";
import { useCourtRuntime } from "./court-runtime-context";

/** What the device knows of the court of a round: still reading the log, or what it found there. */
export type RoundCourtRead =
  { readonly status: "reading" } | { readonly status: "read"; readonly court: RoundCourt | null };

interface ReadOfRound {
  readonly roundId: string;
  readonly court: RoundCourt | null;
}

const READING: RoundCourtRead = { status: "reading" };

/**
 * The court session of a round on this device (screens 06 and 08). The log is the one source: this is
 * a read of it, done again each time the screen comes back to the front (after the court), never a
 * second copy that the screen edits. A log that does not load counts as no session here; the court
 * itself shows the error.
 */
export function useRoundCourt(roundId: string): RoundCourtRead {
  const runtime = useCourtRuntime();
  const focused = useIsFocused();
  const [read, setRead] = useState<ReadOfRound | null>(null);
  useEffect(() => {
    if (!focused) return;
    const alive = { current: true };
    void readRoundCourt(runtime, roundId).then((result) => {
      if (alive.current) setRead({ roundId, court: result.ok ? result.value : null });
    });
    return () => {
      alive.current = false;
    };
  }, [runtime, roundId, focused]);
  return read?.roundId === roundId ? { status: "read", court: read.court } : READING;
}
