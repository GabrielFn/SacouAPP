import { describe, expect, test } from "vitest";

import { createFakeSacouApi } from "../../../adapters/fake-sacou-api";
import { apiOk } from "../../../services/api/api-result";
import { SESSION_A } from "../persistence/log-envelopes.test.fixture";
import { createCourtReplayer } from "../session/court-replay";
import { ROUND } from "../sync/court-sync.test.fixture";
import { MAX_IMPORTED_BYTES, MAX_IMPORTED_EVENTS, readServerStream } from "./import-stream";

const REF = { ...ROUND, courtSessionId: SESSION_A };

function deps() {
  const fake = createFakeSacouApi();
  return {
    fake,
    deps: { api: fake.api, replayer: createCourtReplayer(), wait: () => Promise.resolve() },
  };
}

describe("readServerStream ceilings (ADR 0060, D5)", () => {
  test("more events than a stream may hold fail before any call", async () => {
    const { fake, deps: importDeps } = deps();

    const read = await readServerStream(importDeps, {
      ref: REF,
      eventsBefore: MAX_IMPORTED_EVENTS + 1,
      onProgress: () => undefined,
    });

    expect(read).toEqual({ ok: false, error: "import-invalid" });
    expect(fake.calls()).toEqual([]);
  });

  test("pages that add up past 8 MiB fail closed, before any parse", async () => {
    const { fake, deps: importDeps } = deps();
    fake.respond(
      "listCourtEvents",
      apiOk({ events: [{ pad: "x".repeat(MAX_IMPORTED_BYTES) }], lastPosition: 1, eventCount: 2 }),
    );

    const read = await readServerStream(importDeps, {
      ref: REF,
      eventsBefore: 2,
      onProgress: () => undefined,
    });

    expect(read).toEqual({ ok: false, error: "import-invalid" });
    expect(fake.calls()).toHaveLength(1);
  });

  test("an empty stream reads nothing and is valid", async () => {
    const { fake, deps: importDeps } = deps();

    const read = await readServerStream(importDeps, {
      ref: REF,
      eventsBefore: 0,
      onProgress: () => undefined,
    });

    expect(read).toEqual({ ok: true, value: [] });
    expect(fake.calls()).toEqual([]);
  });

  test("no network: a code, not a broken stream", async () => {
    const { fake, deps: importDeps } = deps();
    fake.respond("listCourtEvents", { ok: false, error: { kind: "offline" } });

    expect(
      await readServerStream(importDeps, {
        ref: REF,
        eventsBefore: 1,
        onProgress: () => undefined,
      }),
    ).toEqual({ ok: false, error: "offline" });
  });
});
