import type { EventEnvelope } from "@sacou/match-engine";
import { err, ok, type Result } from "@sacou/volley-rules";

import type { CourtCommand } from "./command-drafts";
import type { CourtSyncHooks } from "../ports/court-sync";
import { runCourtCommand, type CommandRunnerDeps } from "./command-runner";
import type { CommandError, LoadFailureCode } from "./court-errors";
import { loadCourtSession, type SessionSyncState, type WriteContext } from "./court-session-loader";
import { createSnapshotStore } from "./snapshot-store";
import {
  sessionOwnership,
  type SessionOwner,
  type SessionOwnership,
} from "../sync/session-ownership";

/** How the upload stands, and whose the session is for the account signed in (ADR 0067, D8). */
export interface CourtSyncStanding extends SessionSyncState {
  readonly ownership: SessionOwnership;
}

/**
 * `events` is exactly what the SQLite file holds: the screen reads it, never edits it. The state of
 * the match is the replay of these events, derived on demand.
 */
export type CourtSnapshot =
  | { readonly status: "loading" }
  | {
      readonly status: "ready";
      readonly courtSessionId: string;
      readonly events: readonly EventEnvelope[];
      readonly sync: CourtSyncStanding;
    }
  | { readonly status: "failed"; readonly code: LoadFailureCode };

/** The events a command wrote, in order: the screen reads their IDs (the point screen 31 asks about). */
export interface CommandOutcome {
  readonly written: readonly EventEnvelope[];
}

export type CommandResult = Result<CommandOutcome, CommandError>;

export interface CourtSessionController {
  /** For `useSyncExternalStore`. */
  readonly subscribe: (listener: () => void) => () => void;
  readonly getSnapshot: () => CourtSnapshot;
  /** One command at a time, in the order sent; each sees the log the one before left. */
  readonly dispatch: (command: CourtCommand) => Promise<CommandResult>;
  /** Resolves when everything sent so far is settled. */
  readonly whenIdle: () => Promise<void>;
  /**
   * Reads the log from the file again, in the queue: the way out of `failed` without reopening the
   * app. A log that is still broken stays `failed`, with nothing erased.
   */
  readonly retry: () => Promise<void>;
  /** Reads the file again without showing the loading state: the upload changed the session. */
  readonly reload: () => Promise<void>;
}

export interface CourtSessionControllerDeps extends CommandRunnerDeps {
  /**
   * Told after each write that committed, so the events leave right away (ADR 0067, D3), and asked
   * for the account signed in. Without it (benchmarks, tests) every session counts as this one's.
   */
  readonly sync?: Pick<CourtSyncHooks, "notifyAppended" | "ownerKey">;
}

const NOT_READY: CommandResult = err({ code: "not-ready" });

export function createCourtSessionController(
  deps: CourtSessionControllerDeps,
): CourtSessionController {
  const store = createSnapshotStore<CourtSnapshot>({ status: "loading" });
  const context: { current: WriteContext | null } = { current: null };
  const queue = { current: Promise.resolve() };

  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = queue.current.then(task);
    queue.current = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  async function ownershipOf(owner: SessionOwner): Promise<SessionOwnership> {
    return deps.sync === undefined ? "own" : sessionOwnership(owner, await deps.sync.ownerKey());
  }

  async function load(): Promise<void> {
    const loaded = await loadCourtSession(deps.log, deps.replayer, deps.courtSessionId);
    if (!loaded.ok) {
      store.set({ status: "failed", code: loaded.error });
      return;
    }
    context.current = loaded.value.context;
    store.set({
      status: "ready",
      courtSessionId: deps.courtSessionId,
      events: loaded.value.events,
      sync: { ...loaded.value.sync, ownership: await ownershipOf(loaded.value.owner) },
    });
  }

  async function run(command: CourtCommand): Promise<CommandResult> {
    const snapshot = store.getSnapshot();
    // The session of another account takes no command: its points would leave with that account.
    if (
      snapshot.status !== "ready" ||
      context.current === null ||
      snapshot.sync.ownership === "other-account"
    ) {
      return NOT_READY;
    }
    const outcome = await runCourtCommand(deps, context.current, snapshot.events, command);
    if (!outcome.ok) {
      if (outcome.error.code === "write-failed") {
        // The write may have committed before it failed: the file decides what the snapshot shows.
        await load();
      }
      return outcome;
    }
    store.set({ ...snapshot, events: outcome.value });
    deps.sync?.notifyAppended();
    return ok({ written: outcome.value.slice(snapshot.events.length) });
  }

  void enqueue(load);
  return {
    subscribe: store.subscribe,
    getSnapshot: store.getSnapshot,
    dispatch: (command) => enqueue(() => run(command)),
    whenIdle: () => queue.current,
    reload: () => enqueue(load),
    retry: () =>
      enqueue(() => {
        store.set({ status: "loading" });
        return load();
      }),
  };
}
