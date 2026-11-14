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
    // Each listener tells one half of the reading. A change before the first read is kept and the
    // first read fills only what no change has told yet, so a stale read never wins.
    const watch = {
      value: {
        reading: null as BatteryReading | null,
        told: {} as Partial<BatteryReading>,
        active: true,
      },
    };
    const emit = (reading: BatteryReading): void => {
      watch.value = { ...watch.value, reading };
      listener(reading);
    };
    const update = (change: Partial<BatteryReading>): void => {
      const { reading, told, active } = watch.value;
      if (!active) return;
      watch.value = { reading, told: { ...told, ...change }, active };
      if (reading !== null) emit({ ...reading, ...change });
    };
    void readBattery().then((read) => {
      if (!watch.value.active) return;
      emit({ ...read, ...watch.value.told });
    });
    const levelSub = addBatteryLevelListener(({ batteryLevel }) => {
      update({ level: levelOf(batteryLevel) });
    });
    const stateSub = addBatteryStateListener(({ batteryState }) => {
      update({ charging: isCharging(batteryState) });
    });
    return () => {
      watch.value = { ...watch.value, active: false };
      levelSub.remove();
      stateSub.remove();
    };
  },
};
