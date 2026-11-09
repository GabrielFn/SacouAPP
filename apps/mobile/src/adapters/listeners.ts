/** A list of listeners that can be added, removed and told: what a store needs to be subscribed to. */
export interface Listeners {
  /** Adds one; the returned function removes it. */
  readonly add: (listener: () => void) => () => void;
  readonly notify: () => void;
}

export function createListeners(): Listeners {
  const known = { value: [] as readonly (() => void)[] };
  return {
    add(listener) {
      known.value = [...known.value, listener];
      return () => {
        known.value = known.value.filter((other) => other !== listener);
      };
    },
    notify() {
      known.value.forEach((listener) => {
        listener();
      });
    },
  };
}
