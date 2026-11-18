import { describe, expect, test } from "vitest";

import { createFakeSacouApi } from "../../../adapters/fake-sacou-api";
import { apiOk } from "../../../services/api/api-result";
import type { SessionIdentity } from "../../../services/auth/auth-session";
import { SESSION_A } from "../persistence/log-envelopes.test.fixture";
import { createCourtReplayer } from "../session/court-replay";
import { ROUND } from "../sync/court-sync.test.fixture";
import { MAX_IMPORTED_BYTES, MAX_IMPORTED_EVENTS, readServerStream } from "./import-stream";

const REF = { ...ROUND, courtSessionId: SESSION_A };
const ACCOUNT: SessionIdentity = Object.freeze({ opaque: Symbol("account") });
/** "é" is one character and two UTF-8 bytes. */
const TWO_BYTE_CHAR = "é";

function request(eventsBefore: number) {
  return { ref: REF, eventsBefore, account: ACCOUNT, onProgress: () => undefined };
}

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

    const read = await readServerStream(importDeps, request(MAX_IMPORTED_EVENTS + 1));

    expect(read).toEqual({ ok: false, error: "import-invalid" });
    expect(fake.calls()).toEqual([]);
  });

  test("pages that add up past 8 MiB fail closed, before any parse", async () => {
    const { fake, deps: importDeps } = deps();
    fake.respond(
      "listCourtEvents",
      apiOk({ events: [{ pad: "x".repeat(MAX_IMPORTED_BYTES) }], lastPosition: 1, eventCount: 2 }),
    );

    const read = await readServerStream(importDeps, request(2));

    expect(read).toEqual({ ok: false, error: "import-invalid" });
    expect(fake.calls()).toHaveLength(1);
  });

  test("the ceiling counts UTF-8 bytes: accented text past 8 MiB fails though it has fewer characters", async () => {
    const { fake, deps: importDeps } = deps();
    const pad = TWO_BYTE_CHAR.repeat(MAX_IMPORTED_BYTES / 2 + 1);
    expect(JSON.stringify({ pad }).length).toBeLessThan(MAX_IMPORTED_BYTES);
    fake.respond("listCourtEvents", apiOk({ events: [{ pad }], lastPosition: 1, eventCount: 2 }));

    expect(await readServerStream(importDeps, request(2))).toEqual({
      ok: false,
      error: "import-invalid",
    });
    expect(fake.calls()).toHaveLength(1);
  });

  test("each page goes with the token of the account that took the court over", async () => {
    const { fake, deps: importDeps } = deps();
    fake.respond("listCourtEvents", { ok: false, error: { kind: "offline" } });

    await readServerStream(importDeps, request(1));

    expect(fake.calls()).toEqual([{ operation: "listCourtEvents", args: [REF, 0, ACCOUNT] }]);
  });

  test("an empty stream reads nothing and is valid", async () => {
    const { fake, deps: importDeps } = deps();

    const read = await readServerStream(importDeps, request(0));

    expect(read).toEqual({ ok: true, value: [] });
    expect(fake.calls()).toEqual([]);
  });

  test("no network: a code, not a broken stream", async () => {
    const { fake, deps: importDeps } = deps();
    fake.respond("listCourtEvents", { ok: false, error: { kind: "offline" } });

    expect(await readServerStream(importDeps, request(1))).toEqual({ ok: false, error: "offline" });
  });
});
