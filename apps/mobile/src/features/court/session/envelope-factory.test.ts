import { describe, expect, test } from "vitest";

import { createSequentialIdGenerator } from "../../../adapters/fake-sequential-id-generator";
import { buildEnvelopes, type EnvelopeContext } from "./envelope-factory";

const CONTEXT: EnvelopeContext = {
  courtSessionId: "c0000000-0000-4000-8000-0000000000c1",
  deviceId: "d0000000-0000-4000-8000-000000000001",
  batch: 1,
  firstSequence: 1,
  ids: createSequentialIdGenerator(),
};

const VALID = { type: "PointScored", payload: { team: "a" } };

describe("buildEnvelopes", () => {
  test("numbers the drafts from the first sequence", () => {
    const built = buildEnvelopes([VALID, VALID], { ...CONTEXT, firstSequence: 7 });

    expect(built.ok && built.value.map((envelope) => envelope.sequence)).toEqual([7, 8]);
  });

  test.each([
    ["an empty type", { type: "", payload: {} }, "type"],
    ["a payload that is not an object", { type: "PointScored", payload: [1] }, "payload"],
    ["a payload with NaN", { type: "PointScored", payload: { n: Number.NaN } }, "payload"],
    ["a missing payload", { type: "PointScored", payload: undefined }, "payload"],
  ])("refuses %s before anything is stored", (_name, draft, field) => {
    const built = buildEnvelopes([VALID, draft], CONTEXT);

    expect(built).toEqual({ ok: false, error: { code: "invalid-envelope", field } });
  });

  test("refuses an id that is not a UUID", () => {
    const built = buildEnvelopes([VALID], { ...CONTEXT, ids: { newId: () => "not-a-uuid" } });

    expect(built).toEqual({ ok: false, error: { code: "invalid-envelope", field: "eventId" } });
  });
});
