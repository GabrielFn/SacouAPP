import type { CourtSessionTimeline } from "@sacou/match-engine";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import type { PlayCommand } from "../session/command-drafts";
import type { LoadFailureCode } from "../session/court-errors";
import {
  createCourtSessionController,
  type CommandResult,
  type CourtSessionController,
} from "../session/court-session-controller";
import { useCourtRuntime } from "./court-runtime-context";

export type CourtSessionView =
  | { readonly status: "loading" }
  | { readonly status: "failed"; readonly code: LoadFailureCode }
  | { readonly status: "ready"; readonly timeline: CourtSessionTimeline };

export interface UseCourtSession {
  readonly courtSessionId: string;
  readonly view: CourtSessionView;
  /** Starting a match is not here: only `startCourtMatch` does that. */
  readonly dispatch: (command: PlayCommand) => Promise<CommandResult>;
  readonly retry: () => void;
}

interface SessionHandle {
  readonly courtSessionId: string;
  readonly controller: CourtSessionController;
}

const CourtSessionContext = createContext<SessionHandle | null>(null);

export interface CourtSessionProviderProps {
  readonly courtSessionId: string;
  readonly children: ReactNode;
}

/**
 * One controller per court session for all the routes of the court (the court, the end of the set,
 * the menu): they all read and write the same log through it.
 */
export function CourtSessionProvider({ courtSessionId, children }: CourtSessionProviderProps) {
  const runtime = useCourtRuntime();
  // Created once per mount; the layout keys the provider by session, so another session remounts it.
  const [handle] = useState<SessionHandle>(() => ({
    courtSessionId,
    controller: createCourtSessionController({ courtSessionId, ...runtime }),
  }));
  return <CourtSessionContext.Provider value={handle}>{children}</CourtSessionContext.Provider>;
}

export function useCourtSession(): UseCourtSession {
  const handle = useContext(CourtSessionContext);
  if (!handle) throw new Error("CourtSessionProvider is missing from the tree.");
  const { replayer } = useCourtRuntime();
  const { courtSessionId, controller } = handle;
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const view = useMemo<CourtSessionView>(() => {
    if (snapshot.status !== "ready") {
      return snapshot;
    }
    // The replayer remembers the answer per array: the tap already simulated this very log.
    const replayed = replayer.replay(courtSessionId, snapshot.events);
    return replayed.ok
      ? { status: "ready", timeline: replayed.value }
      : { status: "failed", code: "replay-failed" };
  }, [snapshot, replayer, courtSessionId]);
  const dispatch = useCallback(
    (command: PlayCommand) => controller.dispatch(command),
    [controller],
  );
  const retry = useCallback(() => {
    void controller.retry();
  }, [controller]);
  return { courtSessionId, view, dispatch, retry };
}
