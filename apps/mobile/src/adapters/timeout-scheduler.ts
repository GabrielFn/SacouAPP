import type { Scheduler } from "../services/scheduler/scheduler";

/** The timers of React Native behind the port. */
export const timeoutScheduler: Scheduler = {
  after(delayMs, task) {
    const handle = setTimeout(task, delayMs);
    return () => {
      clearTimeout(handle);
    };
  },
};
