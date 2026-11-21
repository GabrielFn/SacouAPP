import { useIsFocused } from "expo-router";
import { useEffect, useState } from "react";

import { readOtherRoundCourt, type OtherRoundCourt } from "../session/other-round-court";
import { useCourtRuntime } from "./court-runtime-context";

/** What the device knows of a match open in another round: still reading the log, or what it found. */
export type OtherRoundCourtRead =
  | { readonly status: "reading" }
  | { readonly status: "read"; readonly court: OtherRoundCourt | null };

interface ReadOfRound {
  readonly roundId: string;
  readonly court: OtherRoundCourt | null;
}

const READING: OtherRoundCourtRead = { status: "reading" };

/**
 * The match open in another round on this device (R97, D2), read from the log on each focus: the 08
 * shows it before the tap on "Começar partida". A log that does not load counts as none here; the
 * start then fails closed (`ensureRoundCourtSession` keeps an unreadable session open).
 */
export function useOtherRoundCourt(roundId: string): OtherRoundCourtRead {
  const runtime = useCourtRuntime();
  const focused = useIsFocused();
  const [read, setRead] = useState<ReadOfRound | null>(null);
  useEffect(() => {
    if (!focused) return;
    const alive = { current: true };
    void readOtherRoundCourt(runtime, roundId).then((result) => {
      if (alive.current) setRead({ roundId, court: result.ok ? result.value : null });
    });
    return () => {
      alive.current = false;
    };
  }, [runtime, roundId, focused]);
  return read?.roundId === roundId ? { status: "read", court: read.court } : READING;
}
