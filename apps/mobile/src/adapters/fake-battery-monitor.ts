import type { BatteryMonitor, BatteryReading } from "../features/court/ports/battery-monitor";

export interface FakeBatteryMonitor extends BatteryMonitor {
  /** Sets the reading and tells every listener. */
  set(reading: BatteryReading): void;
  listenerCount(): number;
}

export function createFakeBatteryMonitor(
  initial: BatteryReading = { level: 1, charging: false },
): FakeBatteryMonitor {
  const state = {
    reading: initial,
    listeners: [] as readonly ((reading: BatteryReading) => void)[],
  };
  return {
    read: () => Promise.resolve(state.reading),
    subscribe(listener) {
      state.listeners = [...state.listeners, listener];
      listener(state.reading);
      return () => {
        state.listeners = state.listeners.filter((other) => other !== listener);
      };
    },
    set(reading) {
      state.reading = reading;
      state.listeners.forEach((listener) => {
        listener(reading);
      });
    },
    listenerCount: () => state.listeners.length,
  };
}
