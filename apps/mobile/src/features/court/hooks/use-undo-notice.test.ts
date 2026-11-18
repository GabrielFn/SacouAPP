import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { UNDO_NOTICE_MS } from "../court.data";
import { useUndoNotice } from "./use-undo-notice";

const hookUnderTest: typeof useUndoNotice = useUndoNotice;

// A tiny hook runtime: state lives in slots and effects run after each render.
interface Runtime {
  slots: unknown[];
  index: number;
  effects: (() => (() => void) | undefined)[];
  cleanups: (() => void)[];
  deps: (readonly unknown[] | undefined)[];
  dirty: boolean;
}
const runtime: Runtime = { slots: [], index: 0, effects: [], cleanups: [], deps: [], dirty: false };

vi.mock("react", () => ({
  useState: (initial: unknown) => {
    const i = runtime.index++;
    if (!(i in runtime.slots)) runtime.slots[i] = initial;
    const set = (next: unknown) => {
      runtime.slots[i] =
        typeof next === "function" ? (next as (v: unknown) => unknown)(runtime.slots[i]) : next;
      runtime.dirty = true;
    };
    return [runtime.slots[i], set];
  },
  useCallback: (fn: unknown) => fn,
  useEffect: (effect: () => (() => void) | undefined, deps: readonly unknown[]) => {
    const i = runtime.index++;
    const previous = runtime.deps[i];
    const same = previous !== undefined && previous.every((value, k) => Object.is(value, deps[k]));
    if (!same) {
      runtime.deps[i] = deps;
      runtime.effects.push(() => {
        runtime.cleanups[i]?.();
        runtime.cleanups[i] = effect() ?? (() => undefined);
        return undefined;
      });
    }
  },
}));

function render() {
  runtime.index = 0;
  const value = hookUnderTest();
  for (const run of runtime.effects.splice(0)) run();
  return value;
}

function settle() {
  let value = render();
  while (runtime.dirty) {
    runtime.dirty = false;
    value = render();
  }
  return value;
}

beforeEach(() => {
  vi.useFakeTimers();
  Object.assign(runtime, {
    slots: [],
    index: 0,
    effects: [],
    cleanups: [],
    deps: [],
    dirty: false,
  });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("the Desfeito line", () => {
  test("shows, stays until the time ends and then disappears", () => {
    settle().show("Desfeito: ponto");
    expect(settle().text).toBe("Desfeito: ponto");
    vi.advanceTimersByTime(UNDO_NOTICE_MS - 1);
    expect(settle().text).toBe("Desfeito: ponto");
    vi.advanceTimersByTime(1);
    expect(settle().text).toBeNull();
  });

  test("a second equal line restarts the time", () => {
    settle().show("Desfeito: ponto");
    settle();
    vi.advanceTimersByTime(UNDO_NOTICE_MS - 100);
    settle().show("Desfeito: ponto");
    settle();
    vi.advanceTimersByTime(UNDO_NOTICE_MS - 100);
    expect(settle().text).toBe("Desfeito: ponto");
    vi.advanceTimersByTime(100);
    expect(settle().text).toBeNull();
  });
});
