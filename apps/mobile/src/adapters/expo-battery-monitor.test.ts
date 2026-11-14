import { beforeEach, describe, expect, test, vi } from "vitest";
import { expoBatteryMonitor } from "./expo-battery-monitor";

const battery = vi.hoisted(() => ({
  level: -1,
  state: 1,
  failing: false,
}));

vi.mock("expo-battery", () => ({
  BatteryState: { UNKNOWN: 0, UNPLUGGED: 1, CHARGING: 2, FULL: 3 },
  getBatteryLevelAsync: () =>
    battery.failing ? Promise.reject(new Error("no battery")) : Promise.resolve(battery.level),
  getBatteryStateAsync: () => Promise.resolve(battery.state),
  addBatteryLevelListener: () => ({ remove: () => undefined }),
  addBatteryStateListener: () => ({ remove: () => undefined }),
}));

describe("expoBatteryMonitor.read", () => {
  beforeEach(() => {
    battery.level = 0.5;
    battery.state = 1;
    battery.failing = false;
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
