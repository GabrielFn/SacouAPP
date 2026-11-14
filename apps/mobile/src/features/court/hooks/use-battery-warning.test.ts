import { describe, expect, test, vi } from "vitest";

import { createFakeBatteryMonitor } from "../../../adapters/fake-battery-monitor";
import type { BatteryWarningAction } from "../model/battery-warning.reducer";
import { watchBattery } from "./use-battery-warning";

vi.mock("../../../services/services-context", () => ({ useServices: () => ({}) }));

describe("watchBattery", () => {
  test("turns each reading into an action and lets go of the monitor when stopped", () => {
    const monitor = createFakeBatteryMonitor({ level: 0.5, charging: false });
    const actions: BatteryWarningAction[] = [];
    const stop = watchBattery(monitor, (action) => actions.push(action));
    expect(monitor.listenerCount()).toBe(1);
    monitor.set({ level: 0.1, charging: false });
    expect(actions.at(-1)).toEqual({ type: "reading-received", level: 0.1, charging: false });
    stop();
    expect(monitor.listenerCount()).toBe(0);
  });
});
