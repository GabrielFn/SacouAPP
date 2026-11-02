import { describe, expect, test } from "vitest";

import { ENVELOPE_FIELDS, MAX_PAYLOAD_DEPTH, MAX_PAYLOAD_NODES } from "./constants.data.js";
import { parseEventEnvelope } from "./parse-envelope.js";
import type { EventEnvelope } from "./types.js";

const VALID = {
  eventId: "e0000000-0000-4000-8000-000000000001",
  courtSessionId: "c0000000-0000-4000-8000-000000000001",
  deviceId: "d0000000-0000-4000-8000-000000000001",
  batch: 1,
  sequence: 1,
  schemaVersion: 1,
  type: "FixtureAppended",
  payload: { value: "a" },
};

/** The names that revision A4 forbids: an envelope must never carry personal data. */
const FORBIDDEN_NAMES = ["email", "name", "nickname", "phone", "pix", "photo", "userId"];

function expectInvalid(raw: unknown, field: string): void {
  expect(parseEventEnvelope(raw)).toStrictEqual({
    ok: false,
    error: { code: "invalid-envelope", field },
  });
}

function nested(levels: number): unknown {
  return Array.from({ length: levels - 1 }).reduce<unknown>((inner) => ({ inner }), {});
}

function parsedPayload(raw: unknown): EventEnvelope["payload"] {
  const parsed = parseEventEnvelope(raw);
  if (!parsed.ok) {
    throw new Error(`expected a valid envelope, got ${parsed.error.field}`);
  }
  return parsed.value.payload;
}

describe("closed schema (security review A4)", () => {
  test("the schema is exactly the eight agreed fields", () => {
    expect([...ENVELOPE_FIELDS].sort()).toStrictEqual(
      [
        "batch",
        "courtSessionId",
        "deviceId",
        "eventId",
        "payload",
        "schemaVersion",
        "sequence",
        "type",
      ].sort(),
    );
  });

  test("the valid envelope is accepted, so the rejections below are about the extra field", () => {
    expect(parseEventEnvelope(VALID)).toStrictEqual({ ok: true, value: VALID });
  });

  test.each(FORBIDDEN_NAMES)("rejects the forbidden field %s", (name) => {
    expect(ENVELOPE_FIELDS).not.toContain(name);
    expectInvalid({ ...VALID, [name]: "fictional" }, "unknown-field");
  });

  test.each(FORBIDDEN_NAMES)("rejects the forbidden field %s even when empty", (name) => {
    expectInvalid({ ...VALID, [name]: null }, "unknown-field");
  });

  test.each(["memberName", "Email", "USERID", "user_id", "memberId", "createdAt", ""])(
    "rejects the unknown field %j",
    (name) => {
      expectInvalid({ ...VALID, [name]: "x" }, "unknown-field");
    },
  );

  test("rejects unknown keys that JSON.parse makes own, like __proto__ and constructor", () => {
    ["__proto__", "constructor", "toString"].forEach((key) => {
      const raw: unknown = JSON.parse(`{ "${key}": {}, ${JSON.stringify(VALID).slice(1)}`);
      expectInvalid(raw, "unknown-field");
    });
  });

  test("rejects symbol and non-enumerable fields", () => {
    expectInvalid({ ...VALID, [Symbol("email")]: "x" }, "unknown-field");
    expectInvalid(Object.defineProperty({ ...VALID }, "email", { value: "x" }), "unknown-field");
  });

  test("never echoes the name of an unknown field", () => {
    const leakedName = "fictional.player@example.com";
    const result = parseEventEnvelope({ ...VALID, [leakedName]: 1 });
    expect(JSON.stringify(result)).not.toContain(leakedName);
  });
});

describe("parseEventEnvelope with values JSON cannot carry", () => {
  test.each([null, undefined, 1, "x", true, [], new Date(0), new Map(), () => VALID])(
    "rejects %j as an envelope",
    (raw) => {
      expectInvalid(raw, "envelope");
    },
  );

  test("rejects fields that are only inherited", () => {
    expectInvalid(Object.create(VALID), "envelope");
  });

  test.each([NaN, Infinity, -Infinity])("rejects %s in the integers", (value) => {
    (["batch", "sequence", "schemaVersion"] as const).forEach((field) => {
      expectInvalid({ ...VALID, [field]: value }, field);
    });
  });

  test.each([
    ["NaN", { value: NaN }],
    ["Infinity", { value: [Infinity] }],
    ["undefined", { value: undefined }],
    ["a function", { value: () => 1 }],
    ["a date", { value: new Date(0) }],
    ["a map", { value: new Map() }],
    ["a symbol key", { [Symbol("x")]: 1 }],
    ["a sparse array", { value: new Array<number>(1) }],
  ])("rejects a payload holding %s", (_label, payload) => {
    expectInvalid({ ...VALID, payload }, "payload");
  });

  test("rejects a payload that is a date or a map", () => {
    expectInvalid({ ...VALID, payload: new Date(0) }, "payload");
    expectInvalid({ ...VALID, payload: new Map() }, "payload");
  });

  test("limits the depth of the payload, cycles included", () => {
    expect(parseEventEnvelope({ ...VALID, payload: nested(MAX_PAYLOAD_DEPTH) }).ok).toBe(true);
    expectInvalid({ ...VALID, payload: nested(MAX_PAYLOAD_DEPTH + 1) }, "payload");

    const cycle: Record<string, unknown> = {};
    cycle["self"] = cycle;
    expectInvalid({ ...VALID, payload: cycle }, "payload");
  });

  test("a throwing getter fails closed, with no exception", () => {
    const raw = Object.defineProperty({ ...VALID }, "batch", {
      get: () => {
        throw new Error("fictional secret");
      },
    });
    expectInvalid(raw, "envelope");
  });

  test("a getter cannot change a value after it was checked", () => {
    let reads = 0;
    const raw = Object.defineProperty({ ...VALID }, "batch", {
      enumerable: true,
      get: () => {
        reads += 1;
        return reads === 1 ? 1 : -1;
      },
    });
    const parsed = parseEventEnvelope(raw);
    expect(parsed.ok && parsed.value.batch).toBe(1);
  });
});

describe("payload node budget", () => {
  const SHORT_TIME_MS = 1000;
  const HUGE_LENGTH = 2 ** 32 - 1;
  const WIDE_KEYS = 100_000;

  function dag(levels: number): unknown {
    return Array.from({ length: levels }).reduce<unknown>((inner) => [inner, inner], 0);
  }

  function selfReferencing(): unknown {
    const node: Record<string, unknown> = {};
    node["a"] = node;
    node["b"] = node;
    return node;
  }

  function wideSharedObjects(): unknown {
    const wide = Object.fromEntries(
      Array.from({ length: WIDE_KEYS }, (_, index) => [String(index), 0]),
    );
    return new Array<unknown>(MAX_PAYLOAD_NODES - 2).fill(wide);
  }

  test.each([
    ["a DAG of 24 levels", () => dag(24)],
    ["a DAG of 40 levels", () => dag(40)],
    ["a self-referencing object", selfReferencing],
    ["a huge empty array", () => new Array<unknown>(HUGE_LENGTH)],
    ["a wide object shared many times", wideSharedObjects],
  ])("rejects %s in a short time", (_label, build) => {
    const raw = { ...VALID, payload: { value: build() } };

    const startedAt = performance.now();
    const result = parseEventEnvelope(raw);
    const elapsed = performance.now() - startedAt;

    expect(result).toStrictEqual({
      ok: false,
      error: { code: "invalid-envelope", field: "payload" },
    });
    expect(elapsed).toBeLessThan(SHORT_TIME_MS);
  });

  test("accepts a small DAG, which stays a plain copy", () => {
    const payload = parsedPayload({ ...VALID, payload: { value: dag(2) } });

    expect(payload).toStrictEqual({
      value: [
        [0, 0],
        [0, 0],
      ],
    });
  });

  test("counts every value up to the exact limit", () => {
    const items = (count: number) => new Array<number>(count).fill(0);
    const atLimit = { value: items(MAX_PAYLOAD_NODES - 2) };
    const overLimit = { value: items(MAX_PAYLOAD_NODES - 1) };

    expect(parseEventEnvelope({ ...VALID, payload: atLimit }).ok).toBe(true);
    expectInvalid({ ...VALID, payload: overLimit }, "payload");
  });
});

describe("own fields only", () => {
  test("a polluted Object.prototype does not supply a missing field", () => {
    const { deviceId, ...withoutDevice } = VALID;
    const polluted = Object.prototype as Record<string, unknown>;
    polluted["deviceId"] = deviceId;
    try {
      expectInvalid(withoutDevice, "deviceId");
    } finally {
      delete polluted["deviceId"];
    }
  });
});

describe("key order", () => {
  test("the copy sorts keys by UTF-16 code unit at every level", () => {
    const payload = parsedPayload({
      ...VALID,
      payload: { b: 1, a: { d: 1, B: [{ z: 1, y: 2 }], c: 2 } },
    });

    expect(JSON.stringify(payload)).toBe('{"a":{"B":[{"y":2,"z":1}],"c":2,"d":1},"b":1}');
  });
});

describe("parseEventEnvelope output", () => {
  test("__proto__ in the payload stays a plain key and contaminates nothing", () => {
    const raw: unknown = JSON.parse(
      JSON.stringify(VALID).replace(
        '"payload":{"value":"a"}',
        '"payload":{"__proto__":{"polluted":true},"nested":[{"__proto__":{"polluted":true}}]}',
      ),
    );
    const payload = parsedPayload(raw);

    expect(Object.keys(payload)).toStrictEqual(["__proto__", "nested"]);
    expect(Object.getPrototypeOf(payload)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>)["polluted"]).toBeUndefined();
    expect((payload as Record<string, unknown>)["polluted"]).toBeUndefined();
  });

  test("detaches from the input and is frozen in depth", () => {
    const value = { list: [{ deep: 1 }] };
    const raw = { ...VALID, payload: { value } };
    const payload = parsedPayload(raw);
    value.list[0] = { deep: 2 };

    expect(payload).toStrictEqual({ value: { list: [{ deep: 1 }] } });
    expect(Object.isFrozen(payload)).toBe(true);
    expect(Object.isFrozen(payload["value"])).toBe(true);
  });

  test("keeps a frozen input intact", () => {
    const raw = Object.freeze({ ...VALID, payload: Object.freeze({ value: "a" }) });
    expect(parseEventEnvelope(raw)).toStrictEqual({ ok: true, value: VALID });
  });
});
