/**
 * One run at a time: a second call while the first is running gets the same promise, so a double tap
 * sends one request (a dispatch is seen only on the next render, too late for the same frame).
 */
export interface SingleFlight<T> {
  run(task: () => Promise<T>): Promise<T>;
}

export function createSingleFlight<T>(): SingleFlight<T> {
  const running: { current: Promise<T> | null } = { current: null };
  return {
    run(task) {
      running.current ??= task().finally(() => {
        running.current = null;
      });
      return running.current;
    },
  };
}
