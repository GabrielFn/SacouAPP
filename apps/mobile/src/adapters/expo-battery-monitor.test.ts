import { beforeEach, describe, expect, test, vi } from "vitest";
import { expoBatteryMonitor } from "./expo-battery-monitor";

const battery = vi.hoisted(() => ({
  level: -1,
  state: 1,
  failing: false,
  gate: null as Promise<void> | null,
  levelListener: null as ((event: { batteryLevel: number }) => void) | null,
  stateListener: null as ((event: { batteryState: number }) => void) | null,
}));

vi.mock("expo-battery", () => ({
  BatteryState: { UNKNOWN: 0, UNPLUGGED: 1, CHARGING: 2, FULL: 3 },
  getBatteryLevelAsync: async () => {
    await battery.gate;
    return battery.failing ? Promise.reject(new Error("no battery")) : battery.level;
  },
  getBatteryStateAsync: () => Promise.resolve(battery.state),
  addBatteryLevelListener: (fn: (event: { batteryLevel: number }) => void) => {
    battery.levelListener = fn;
    return { remove: () => undefined };
  },
  addBatteryStateListener: (fn: (event: { batteryState: number }) => void) => {
    battery.stateListener = fn;
    return { remove: () => undefined };
  },
}));

describe("expoBatteryMonitor.read", () => {
  beforeEach(() => {
    battery.level = 0.5;
    battery.state = 1;
    battery.failing = false;
    battery.gate = null;
  });

  test("an emulator level of -1 is an unknown level, not a real zero", async () => {
    battery.level = -1;
    expect((await expoBatteryMonitor.read()).level).toBeNull();
  });

  test("a real level of 0 and 0.5 pass through", async () => {
    battery.level = 0;
    expect((await expoBatteryMonitor.read()).level).toBe(0);
    battery.level = 0.5;
    expect((await expoBatteryMonitor.read()).level).toBe(0.5);
  });

  test("charging and full count as charging; unplugged and unknown do not", async () => {
    const charging = async (state: number) => {
      battery.state = state;
      return (await expoBatteryMonitor.read()).charging;
    };
    expect(await charging(2)).toBe(true);
    expect(await charging(3)).toBe(true);
    expect(await charging(1)).toBe(false);
    expect(await charging(0)).toBe(false);
  });

  test("a failing read means nothing to warn about", async () => {
    battery.failing = true;
    expect(await expoBatteryMonitor.read()).toEqual({ level: null, charging: false });
  });
});

describe("expoBatteryMonitor.subscribe", () => {
  test("a change before the first read is applied and the stale read does not overwrite it", async () => {
    battery.level = 0.5;
    battery.state = 1;
    const release: { open: () => void } = { open: () => undefined };
    battery.gate = new Promise<void>((resolve) => {
      release.open = () => {
        resolve();
      };
    });
    const readings: unknown[] = [];
    const stop = expoBatteryMonitor.subscribe((reading) => readings.push(reading));
    battery.levelListener?.({ batteryLevel: 0.1 });
    battery.stateListener?.({ batteryState: 2 });
    expect(readings).toEqual([]);
    release.open();
    await vi.waitFor(() => {
      expect(readings).toEqual([{ level: 0.1, charging: true }]);
    });
    battery.levelListener?.({ batteryLevel: 0.09 });
    expect(readings.at(-1)).toEqual({ level: 0.09, charging: true });
    stop();
  });
});
