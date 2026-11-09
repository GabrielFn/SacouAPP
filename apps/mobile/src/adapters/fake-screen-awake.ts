import type { ScreenAwake } from "../features/court/ports/screen-awake";

export interface FakeScreenAwake extends ScreenAwake {
  /** Tags that are on right now. */
  active(): readonly string[];
  /** Every call in order, as `activate:tag` or `deactivate:tag`. */
  calls(): readonly string[];
}

interface Record_ {
  readonly calls: readonly string[];
  readonly active: readonly string[];
}

export function createFakeScreenAwake(): FakeScreenAwake {
  const record = { value: { calls: [], active: [] } as Record_ };
  return {
    activate(tag) {
      const { calls, active } = record.value;
      record.value = { calls: [...calls, `activate:${tag}`], active: [...active, tag] };
    },
    deactivate(tag) {
      const { calls, active } = record.value;
      record.value = {
        calls: [...calls, `deactivate:${tag}`],
        active: active.filter((on) => on !== tag),
      };
    },
    active: () => record.value.active,
    calls: () => record.value.calls,
  };
}
