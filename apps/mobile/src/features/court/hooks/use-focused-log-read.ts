import { useIsFocused } from "expo-router";
import { useEffect, useState } from "react";

import type { CourtRuntime } from "../ports/court-runtime";
import { useCourtRuntime } from "./court-runtime-context";

/** A read of the court log for one key: still reading, or what it found. */
export type FocusedLogRead<T> =
  { readonly status: "reading" } | { readonly status: "read"; readonly value: T };

interface ReadOfKey<T> {
  readonly key: string;
  readonly value: T;
}

const READING = { status: "reading" } as const;

/**
 * Reads the court log for `key` each time the screen comes back to the front (after the court). The
 * log is the one source: this holds the last read, never a copy a screen edits. `read` must be a
 * function of the module (stable), so the read runs again only when the key, the focus or `revision`
 * change. A new `revision` (a write of the screen itself) reads again and keeps the last read meanwhile.
 */
export function useFocusedLogRead<T>(
  key: string,
  read: (runtime: CourtRuntime, key: string) => Promise<T>,
  revision = 0,
): FocusedLogRead<T> {
  const runtime = useCourtRuntime();
  const focused = useIsFocused();
  const [last, setLast] = useState<ReadOfKey<T> | null>(null);
  useEffect(() => {
    if (!focused) return;
    const alive = { current: true };
    void read(runtime, key).then((value) => {
      if (alive.current) setLast({ key, value });
    });
    return () => {
      alive.current = false;
    };
  }, [runtime, key, focused, read, revision]);
  return last?.key === key ? { status: "read", value: last.value } : READING;
}
