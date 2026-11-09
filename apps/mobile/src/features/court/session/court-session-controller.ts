import type { EventEnvelope } from "@sacou/match-engine";
import { err, ok, type Result } from "@sacou/volley-rules";

import type { CourtCommand } from "./command-drafts";
import { runCourtCommand, type CommandRunnerDeps } from "./command-runner";
import type { CommandError, LoadFailureCode } from "./court-errors";
import { loadCourtSession, type WriteContext } from "./court-session-loader";
import { createSnapshotStore } from "./snapshot-store";

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
    }
  | { readonly status: "failed"; readonly code: LoadFailureCode };

export type CommandResult = Result<void, CommandError>;

export interface CourtSessionController {
  /** For `useSyncExternalStore`. */
  subscribe(listener: () => void): () => void;
  getSnapshot(): CourtSnapshot;
  /** One command at a time, in the order sent; each sees the log the one before left. */
  dispatch(command: CourtCommand): Promise<CommandResult>;
  /** Resolves when everything sent so far is settled. */
  whenIdle(): Promise<void>;
}

export type CourtSessionControllerDeps = CommandRunnerDeps;

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
    });
  }

  async function run(command: CourtCommand): Promise<CommandResult> {
    const snapshot = store.getSnapshot();
    if (snapshot.status !== "ready" || context.current === null) {
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
    return ok(undefined);
  }

  void enqueue(load);
  return {
    subscribe: store.subscribe,
    getSnapshot: store.getSnapshot,
    dispatch: (command) => enqueue(() => run(command)),
    whenIdle: () => queue.current,
  };
}
