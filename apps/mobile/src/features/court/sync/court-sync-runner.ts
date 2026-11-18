import type { NetworkStatus } from "../../../services/api/network-status";
import type { RandomSource } from "../../../services/random/random-source";
import type { AppForeground } from "../ports/app-foreground";
import type { Clock } from "../ports/clock";
import type { CourtAccount, CourtAccountRef } from "../ports/court-account";
import type { SessionToSync } from "../ports/court-event-log";
import type { CourtSync, CourtSyncSnapshot } from "../ports/court-sync";
import type { Scheduler } from "../ports/scheduler";
import { createSnapshotStore } from "../session/snapshot-store";
import { countUnsent } from "./count-unsent";
import {
  courtSyncReducer,
  INITIAL_COURT_SYNC_STATE,
  type CourtSyncAction,
} from "./court-sync.reducer";
import { uploadSession, type UploadDeps, type UploadOutcome } from "./upload-session";

export interface CourtSyncRunnerDeps extends Omit<UploadDeps, "onSessionChanged"> {
  readonly account: CourtAccount;
  readonly network: NetworkStatus;
  readonly foreground: AppForeground;
  readonly clock: Clock;
  readonly scheduler: Scheduler;
  readonly random: RandomSource;
}

type SessionListener = (courtSessionId: string) => void;

const NO_SESSIONS: readonly string[] = [];
const NOTHING_MORE: CourtSyncAction = { type: "pass-done", more: false };

/** The sessions of the account signed in, and the others, which are never sent (D8). */
function partition(
  sessions: readonly SessionToSync[],
  account: CourtAccountRef | null,
): { readonly owned: readonly SessionToSync[]; readonly others: readonly string[] } {
  const owns = (session: SessionToSync) => account !== null && session.ownerKey === account.key;
  return {
    owned: sessions.filter(owns),
    others: sessions.filter((session) => !owns(session)).map((session) => session.courtSessionId),
  };
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/**
 * The executor of the upload loop: the reducer decides, this file does the effects (one request at a
 * time, the waits, the listeners). It logs nothing: no ID, payload or answer of the server.
 */
export function createCourtSyncRunner(deps: CourtSyncRunnerDeps): CourtSync {
  const store = createSnapshotStore<CourtSyncSnapshot>({
    loop: INITIAL_COURT_SYNC_STATE,
    otherAccountSessions: NO_SESSIONS,
  });
  const inFlight = { value: false };
  const timer = { current: null as (() => void) | null };
  const unsubscribes = { value: [] as readonly (() => void)[] };
  const sessionListeners = { value: [] as readonly SessionListener[] };

  function notifySession(courtSessionId: string): void {
    sessionListeners.value.forEach((listener) => {
      listener(courtSessionId);
    });
  }

  function publishOthers(others: readonly string[]): void {
    const snapshot = store.getSnapshot();
    if (!sameList(snapshot.otherAccountSessions, others)) {
      store.set({ ...snapshot, otherAccountSessions: others });
    }
  }

  function failed(afterMs: number | null): CourtSyncAction {
    return {
      type: "pass-failed",
      nowMs: deps.clock.now(),
      jitter: deps.random.next(),
      retryAfterMs: afterMs,
    };
  }

  function actionOf(outcome: UploadOutcome): CourtSyncAction {
    switch (outcome.type) {
      case "progress":
        return { type: "pass-done", more: true };
      case "nothing":
      case "account-changed":
        // A new account pokes the loop through its own listener.
        return NOTHING_MORE;
      case "retry":
        return failed(outcome.afterMs);
    }
  }

  async function pass(): Promise<CourtSyncAction> {
    const account = await deps.account.current();
    const device = await deps.log.getDeviceId();
    if (!device.ok) return failed(null);
    const sessions = await deps.log.findSessionsToSync(device.value);
    if (!sessions.ok) return failed(null);
    const { owned, others } = partition(sessions.value, account);
    publishOthers(others);
    const [target] = owned;
    if (account === null || target === undefined) return NOTHING_MORE;
    // Offline, nothing is tried: the network coming back pokes the loop.
    if (!deps.network.isOnline()) return failed(null);
    const outcome = await uploadSession({
      ...deps,
      onSessionChanged: notifySession,
      target,
      account,
      deviceId: device.value,
      isAccountCurrent: async () => (await deps.account.current())?.session === account.session,
    });
    return actionOf(outcome);
  }

  function schedule(): void {
    timer.current?.();
    timer.current = null;
    const { loop } = store.getSnapshot();
    if (loop.status !== "waiting") return;
    timer.current = deps.scheduler.after(Math.max(0, loop.untilMs - deps.clock.now()), () => {
      timer.current = null;
      dispatch({ type: "wait-elapsed" });
    });
  }

  function runPass(): void {
    inFlight.value = true;
    void pass()
      .catch((): CourtSyncAction => failed(null))
      .then((action) => {
        inFlight.value = false;
        dispatch(action);
      });
  }

  function dispatch(action: CourtSyncAction): void {
    const snapshot = store.getSnapshot();
    const loop = courtSyncReducer(snapshot.loop, action);
    if (loop === snapshot.loop) return;
    store.set({ ...snapshot, loop });
    schedule();
    if (loop.status === "sending" && !inFlight.value) runPass();
  }

  const poke = () => {
    dispatch({ type: "poked" });
  };

  return {
    start() {
      if (unsubscribes.value.length > 0) return;
      unsubscribes.value = [
        deps.network.subscribe((online) => {
          if (online) poke();
        }),
        deps.foreground.subscribe(poke),
        deps.account.subscribe(poke),
      ];
      poke();
    },
    stop() {
      unsubscribes.value.forEach((unsubscribe) => {
        unsubscribe();
      });
      unsubscribes.value = [];
      dispatch({ type: "stopped" });
    },
    notifyAppended: poke,
    async ownerKey() {
      return (await deps.account.current())?.key ?? null;
    },
    subscribe: store.subscribe,
    getSnapshot: store.getSnapshot,
    onSessionChanged(listener) {
      sessionListeners.value = [...sessionListeners.value, listener];
      return () => {
        sessionListeners.value = sessionListeners.value.filter((other) => other !== listener);
      };
    },
    countUnsent: () => countUnsent(deps),
  };
}
