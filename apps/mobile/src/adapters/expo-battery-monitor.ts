import {
  BatteryState,
  addBatteryLevelListener,
  addBatteryStateListener,
  getBatteryLevelAsync,
  getBatteryStateAsync,
} from "expo-battery";

import type { BatteryMonitor, BatteryReading } from "../features/court/ports/battery-monitor";

const LOWEST_KNOWN_LEVEL = 0;

/** An emulator answers -1: that is a level the phone does not know. */
function levelOf(raw: number): number | null {
  return raw < LOWEST_KNOWN_LEVEL ? null : raw;
}

function isCharging(state: BatteryState): boolean {
  return state === BatteryState.CHARGING || state === BatteryState.FULL;
}

async function readBattery(): Promise<BatteryReading> {
  try {
    const [level, state] = await Promise.all([getBatteryLevelAsync(), getBatteryStateAsync()]);
    return { level: levelOf(level), charging: isCharging(state) };
  } catch {
    // A phone that cannot tell its battery has nothing to warn about.
    return { level: null, charging: false };
  }
}

export const expoBatteryMonitor: BatteryMonitor = {
  read: readBattery,
  subscribe(listener) {
    // Each listener tells one half of the reading: nothing is emitted before both halves are known.
    const watch = { reading: null as BatteryReading | null, active: true };
    const update = (change: Partial<BatteryReading>): void => {
      if (!watch.active || watch.reading === null) return;
      watch.reading = { ...watch.reading, ...change };
      listener(watch.reading);
    };
    void readBattery().then((reading) => {
      if (!watch.active) return;
      watch.reading = reading;
      listener(reading);
    });
    const levelSub = addBatteryLevelListener(({ batteryLevel }) => {
      update({ level: levelOf(batteryLevel) });
    });
    const stateSub = addBatteryStateListener(({ batteryState }) => {
      update({ charging: isCharging(batteryState) });
    });
    return () => {
      watch.active = false;
      levelSub.remove();
      stateSub.remove();
    };
  },
};
