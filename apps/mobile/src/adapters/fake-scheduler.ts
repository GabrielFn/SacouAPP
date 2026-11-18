import type { Scheduler } from "../features/court/ports/scheduler";
import type { FakeClock } from "./fake-clock";

interface Pending {
  readonly dueMs: number;
  readonly task: () => void;
  readonly id: number;
}

/** A scheduler on a fake clock: tasks run only when the test moves the time. */
export interface FakeScheduler extends Scheduler {
  /** Moves the clock and runs, in order, every task due by then. */
  advance(milliseconds: number): void;
  /** The waits not run yet, in milliseconds from now. */
  pendingDelays(): readonly number[];
}

export function createFakeScheduler(clock: FakeClock): FakeScheduler {
  const tasks = { value: [] as readonly Pending[] };
  const made = { value: 0 };

  function runDue(): void {
    const due = tasks.value
      .filter((pending) => pending.dueMs <= clock.now())
      .sort((a, b) => a.dueMs - b.dueMs);
    tasks.value = tasks.value.filter((pending) => !due.includes(pending));
    due.forEach((pending) => {
      pending.task();
    });
  }

  return {
    after(delayMs, task) {
      made.value += 1;
      const pending: Pending = { dueMs: clock.now() + delayMs, task, id: made.value };
      tasks.value = [...tasks.value, pending];
      return () => {
        tasks.value = tasks.value.filter((other) => other.id !== pending.id);
      };
    },
    advance(milliseconds) {
      clock.advance(milliseconds);
      runDue();
    },
    pendingDelays: () => tasks.value.map((pending) => pending.dueMs - clock.now()),
  };
}
