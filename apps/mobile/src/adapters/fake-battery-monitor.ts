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
    value: {
      reading: initial,
      listeners: [] as readonly ((reading: BatteryReading) => void)[],
    },
  };
  return {
    read: () => Promise.resolve(state.value.reading),
    subscribe(listener) {
      state.value = { ...state.value, listeners: [...state.value.listeners, listener] };
      listener(state.value.reading);
      return () => {
        state.value = {
          ...state.value,
          listeners: state.value.listeners.filter((other) => other !== listener),
        };
      };
    },
    set(reading) {
      state.value = { ...state.value, reading };
      state.value.listeners.forEach((listener) => {
        listener(reading);
      });
    },
    listenerCount: () => state.value.listeners.length,
  };
}
