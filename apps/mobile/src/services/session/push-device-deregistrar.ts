/** The step of the exit of the account that comes before the SDK (ADR 0057, D4, changed by E3.11). */
export interface PushDeviceDeregistrar {
  /** The server first, for at most 2 s and never blocking the exit; then this phone. */
  deregister(): Promise<void>;
  /** Only this phone: the server already forgot the account (screen 30b) or the session fell elsewhere. */
  forgetLocally(): Promise<void>;
}
