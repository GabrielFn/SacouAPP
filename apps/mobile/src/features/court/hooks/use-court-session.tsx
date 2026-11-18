import type { CourtSessionTimeline } from "@sacou/match-engine";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
import { selectSyncNotice, type SyncNotice } from "../sync/sync-notice";
import { blockedCourtOf, type BlockedCourt } from "../takeover/blocked-court";
import { useCourtRuntime } from "./court-runtime-context";
import { useCourtSync } from "./court-sync-context";

export type CourtSessionView =
  | { readonly status: "loading" }
  | { readonly status: "failed"; readonly code: LoadFailureCode }
  | {
      readonly status: "ready";
      readonly timeline: CourtSessionTimeline;
      /** Why the points are not reaching the server, or `null` (question 85); `taken-over` is the 09b. */
      readonly notice: SyncNotice | null;
      /** The court takes no gesture (09b and 09c, another account, no account), or `null`. */
      readonly blocked: BlockedCourt | null;
    };

export interface UseCourtSession {
  readonly courtSessionId: string;
  readonly view: CourtSessionView;
  /** Starting a match is not here: only `startCourtMatch` does that. */
  readonly dispatch: (command: PlayCommand) => Promise<CommandResult>;
  readonly retry: () => void;
  /** "Entendi" of screen 09c. */
  readonly markRefusedSeen: () => void;
  /** Reads the file again: a take-over on another route may have replaced the session. */
  readonly reload: () => void;
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
  const sync = useCourtSync();
  // The upload wrote a halt or a take-over in this session: the court reads the file again.
  useEffect(
    () =>
      sync.onSessionChanged((changed) => {
        if (changed === handle.courtSessionId) void handle.controller.reload();
      }),
    [sync, handle],
  );
  // Another account signed in: whose the court is is read again (D8).
  useEffect(
    () =>
      sync.onAccountChanged(() => {
        void handle.controller.reload();
      }),
    [sync, handle],
  );
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
    if (!replayed.ok) return { status: "failed", code: "replay-failed" };
    const notice = selectSyncNotice(snapshot.sync);
    return {
      status: "ready",
      timeline: replayed.value,
      notice,
      blocked: blockedCourtOf(snapshot, notice, replayer),
    };
  }, [snapshot, replayer, courtSessionId]);
  const dispatch = useCallback(
    (command: PlayCommand) => controller.dispatch(command),
    [controller],
  );
  const retry = useCallback(() => {
    void controller.retry();
  }, [controller]);
  const markRefusedSeen = useCallback(() => {
    void controller.markRefusedSeen();
  }, [controller]);
  const reload = useCallback(() => {
    void controller.reload();
  }, [controller]);
  return { courtSessionId, view, dispatch, retry, markRefusedSeen, reload };
}
