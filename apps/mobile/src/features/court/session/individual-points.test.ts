import { describe, expect, test } from "vitest";

import { createFakeCourtEventLog } from "../../../adapters/fake-court-event-log";
import { createFakeCourtRoundSettings } from "../../../adapters/fake-court-round-settings";
import { createSequentialIdGenerator } from "../../../adapters/fake-sequential-id-generator";
import { findSessionOrigin, isIndividualPoints } from "./individual-points";

const ROUND_ON = "round-on";

async function readIndividualPoints(
  log: Parameters<typeof findSessionOrigin>[0],
  settings: Parameters<typeof isIndividualPoints>[1],
  courtSessionId: string,
): Promise<boolean> {
  return isIndividualPoints(await findSessionOrigin(log, courtSessionId), settings);
}

async function logWith() {
  const log = createFakeCourtEventLog(createSequentialIdGenerator());
  await log.openSession("from-round-on", { groupId: "g1", roundId: ROUND_ON });
  await log.openSession("from-round-off", { groupId: "g1", roundId: "round-off" });
  await log.openSession("sample");
  return log;
}

describe("whether screen 31 opens in a session (D10)", () => {
  const settings = createFakeCourtRoundSettings([ROUND_ON]);

  test("only a session of a round with the option on", async () => {
    const log = await logWith();
    expect(await readIndividualPoints(log, settings, "from-round-on")).toBe(true);
    expect(await readIndividualPoints(log, settings, "from-round-off")).toBe(false);
  });

  test("a sample session, an unknown one and a log that fails are off", async () => {
    const log = await logWith();
    expect(await readIndividualPoints(log, settings, "sample")).toBe(false);
    expect(await readIndividualPoints(log, settings, "unknown")).toBe(false);
    const failing = {
      findSessionOrigin: () =>
        Promise.resolve({ ok: false, error: { code: "storage-failed" } } as const),
    };
    expect(await readIndividualPoints(failing, settings, "from-round-on")).toBe(false);
  });
});
