/** The shape `useSyncExternalStore` wants: a snapshot that changes only by being replaced. */
export interface SnapshotStore<T> {
  getSnapshot(): T;
  set(next: T): void;
  subscribe(listener: () => void): () => void;
}

export function createSnapshotStore<T>(initial: T): SnapshotStore<T> {
  const current = { value: initial };
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => current.value,
    set(next) {
      current.value = next;
      listeners.forEach((listener) => {
        listener();
      });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
