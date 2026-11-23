import type { PushSyncOutcome } from "../registration/push-registration";

/**
 * Where the outcome of a registration goes, so a silent `no-token` or `failed` can be seen on the phone
 * (R98, item 9). Only the outcome: the token never reaches it.
 */
export interface PushOutcomeLog {
  record(outcome: PushSyncOutcome): void;
}
