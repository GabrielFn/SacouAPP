/** The shape `useSyncExternalStore` wants: a snapshot that changes only by being replaced. */
export interface SnapshotStore<T> {
  readonly getSnapshot: () => T;
  readonly set: (next: T) => void;
  readonly subscribe: (listener: () => void) => () => void;
}

type Listener = () => void;

export function createSnapshotStore<T>(initial: T): SnapshotStore<T> {
  const current = { value: initial };
  const listeners = { value: [] as readonly Listener[] };
  return {
    getSnapshot: () => current.value,
    set: (next) => {
      current.value = next;
      listeners.value.forEach((listener) => {
        listener();
      });
    },
    subscribe: (listener) => {
      listeners.value = [...listeners.value, listener];
      return () => {
        listeners.value = listeners.value.filter((other) => other !== listener);
      };
    },
  };
}
