import { parseEventEnvelope, type EventEnvelope } from "@sacou/match-engine";
import { describe, expect, test } from "vitest";

import { DEVICE, makeEnvelope } from "../persistence/log-envelopes.test.fixture";
import { BACKOFF_JITTER, backoffDelayMs, MAX_BACKOFF_MS } from "./backoff";
import {
  chunkForUpload,
  envelopeBytes,
  MAX_ENVELOPE_BYTES,
  MAX_EVENTS_PER_REQUEST,
  MAX_REQUEST_BYTES,
  utf8Length,
} from "./chunk-for-upload";
import { countPoints, pendingEvents } from "./pending-events";

const OTHER_DEVICE = "d0000000-0000-4000-8000-000000000002";

function events(count: number, deviceId = DEVICE): readonly EventEnvelope[] {
  return Array.from({ length: count }, (_, index) =>
    makeEnvelope({ deviceId, sequence: index + 1, eventNumber: index + 1 }),
  );
}

/** An envelope with a payload of about `bytes` bytes, to test the size limits. */
function sized(sequence: number, bytes: number): EventEnvelope {
  const base = makeEnvelope({ sequence, eventNumber: sequence });
  const padding = "x".repeat(Math.max(0, bytes - envelopeBytes(base) - '"pad":"",'.length));
  const parsed = parseEventEnvelope({ ...base, payload: { ...base.payload, pad: padding } });
  if (!parsed.ok) throw new Error("invalid envelope");
  return parsed.value;
}

describe("pendingEvents (P1)", () => {
  test("without anything confirmed, every event of this device in its batch", () => {
    expect(pendingEvents(events(3), { deviceId: DEVICE, batch: 1, ackedSequence: 0 })).toHaveLength(
      3,
    );
  });

  test("only what is above the confirmed cursor, in order", () => {
    const pending = pendingEvents(events(5), { deviceId: DEVICE, batch: 1, ackedSequence: 3 });
    expect(pending.map((event) => event.sequence)).toEqual([4, 5]);
  });

  test("events of another device and of an older batch never go", () => {
    const log = [...events(2, OTHER_DEVICE), ...events(2)];
    expect(pendingEvents(log, { deviceId: DEVICE, batch: 1, ackedSequence: 0 })).toEqual(events(2));
    expect(pendingEvents(log, { deviceId: DEVICE, batch: 2, ackedSequence: 0 })).toEqual([]);
  });

  test("countPoints counts only the points", () => {
    expect(countPoints(events(4))).toBe(4);
    expect(countPoints([])).toBe(0);
  });
});

describe("chunkForUpload (P2)", () => {
  test("450 events go in 200, 200 and 50", () => {
    const chunks = chunkForUpload(events(450));
    expect(chunks.ok && chunks.value.map((chunk) => chunk.length)).toEqual([200, 200, 50]);
  });

  test("an empty list makes no request", () => {
    expect(chunkForUpload([])).toEqual({ ok: true, value: [] });
  });

  test("large envelopes are cut before 192 KiB, never above it", () => {
    const large = Array.from({ length: 200 }, (_, index) => sized(index + 1, MAX_ENVELOPE_BYTES));
    const chunks = chunkForUpload(large);
    if (!chunks.ok) throw new Error("expected chunks");
    expect(chunks.value.length).toBeGreaterThan(1);
    chunks.value.forEach((chunk) => {
      expect(utf8Length(JSON.stringify({ events: chunk }))).toBeLessThanOrEqual(MAX_REQUEST_BYTES);
    });
    expect(chunks.value.flat()).toEqual(large);
  });

  test("an envelope over 16 KiB is never sent", () => {
    expect(chunkForUpload([sized(1, MAX_ENVELOPE_BYTES + 1)])).toEqual({
      ok: false,
      error: "event-too-large",
    });
  });

  test("the size is counted in UTF-8, as the server counts it", () => {
    expect(utf8Length("a")).toBe(1);
    expect(utf8Length("ç")).toBe(2);
    expect(utf8Length("€")).toBe(3);
    expect(utf8Length("🏐")).toBe(4);
  });

  test("a smaller limit cuts smaller requests", () => {
    const chunks = chunkForUpload(events(5), 2);
    expect(chunks.ok && chunks.value.map((chunk) => chunk.length)).toEqual([2, 2, 1]);
    expect(MAX_EVENTS_PER_REQUEST).toBe(200);
  });
});

describe("backoffDelayMs", () => {
  test("2, 4, 8, 16, 32 and then 60 s, without variation in the middle of the range", () => {
    const middle = 0.5;
    expect([1, 2, 3, 4, 5, 6, 7].map((attempt) => backoffDelayMs(attempt, middle))).toEqual([
      2_000, 4_000, 8_000, 16_000, 32_000, 60_000, 60_000,
    ]);
  });

  test("the variation stays within ±20% and never passes the ceiling", () => {
    expect(backoffDelayMs(1, 0)).toBe(2_000 * (1 - BACKOFF_JITTER));
    expect(backoffDelayMs(1, 0.999_999)).toBeLessThanOrEqual(2_000 * (1 + BACKOFF_JITTER));
    expect(backoffDelayMs(10, 0.999_999)).toBe(MAX_BACKOFF_MS);
  });
});
