import type { PushOutcomeLog } from "../features/notifications/ports/push-outcome-log";

/** The line of the Metro log: the outcome only, never the token nor the installation id. */
export function pushOutcomeLine(outcome: string): string {
  return `[push] registration: ${outcome}`;
}

/**
 * In development the outcome of each registration goes to the Metro log (R98, item 9); a release build
 * writes nothing. `write` is the console by default and a list in the tests.
 */
export function createDevPushOutcomeLog(
  isDevelopment: boolean,
  write: (line: string) => void = (line) => {
    console.info(line);
  },
): PushOutcomeLog {
  return {
    record(outcome) {
      if (isDevelopment) write(pushOutcomeLine(outcome));
    },
  };
}
