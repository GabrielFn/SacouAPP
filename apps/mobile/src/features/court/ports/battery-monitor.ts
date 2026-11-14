/** `level` goes from 0 to 1; `null` is a level the phone does not know (an emulator answers -1). */
export interface BatteryReading {
  readonly level: number | null;
  readonly charging: boolean;
}

/** Reads the battery and tells when it changes. The reading never leaves the phone. */
export interface BatteryMonitor {
  read(): Promise<BatteryReading>;
  /** Returns the function that stops listening. */
  subscribe(listener: (reading: BatteryReading) => void): () => void;
}
