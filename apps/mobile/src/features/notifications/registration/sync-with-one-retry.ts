import type { Scheduler } from "../../../services/scheduler/scheduler";
import type { PushOutcomeLog } from "../ports/push-outcome-log";
import type { PushRegistration, PushSyncOutcome } from "./push-registration";

/** How long a failed registration waits for its one more try (R98, item 9). */
export const PUSH_RETRY_AFTER_FAILURE_MS = 30_000;

export interface SyncWithOneRetryDeps {
  readonly devices: Pick<PushRegistration, "sync">;
  readonly scheduler: Scheduler;
  readonly log: PushOutcomeLog;
  readonly retryAfterMs?: number;
}

/**
 * One registration and, when it fails, a single try more after a wait: never a loop (PR #209), so a
 * second failure waits for the next opening. Every outcome goes to the log. The returned function
 * cancels the try still waiting (the session ended, the screen left).
 */
export function syncWithOneRetry(deps: SyncWithOneRetryDeps): () => void {
  const retryAfterMs = deps.retryAfterMs ?? PUSH_RETRY_AFTER_FAILURE_MS;
  const cancelled = { value: false };
  const cancelRetry: { current: () => void } = { current: () => undefined };

  function sync(): Promise<PushSyncOutcome> {
    return deps.devices.sync().then((outcome) => {
      if (!cancelled.value) deps.log.record(outcome);
      return outcome;
    });
  }

  void sync().then((outcome) => {
    if (outcome !== "failed" || cancelled.value) return;
    cancelRetry.current = deps.scheduler.after(retryAfterMs, () => {
      if (!cancelled.value) void sync();
    });
  });

  return () => {
    cancelled.value = true;
    cancelRetry.current();
  };
}
