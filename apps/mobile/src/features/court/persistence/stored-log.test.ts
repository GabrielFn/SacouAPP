import { describe, expect, test } from "vitest";

import {
  makeEnvelope,
  openMigratedDatabase,
  repositoryOn,
  SESSION_A,
} from "./log-envelopes.test.fixture";

const EXPECTED_COLUMNS = {
  device: ["singleton", "device_id"],
  court_sessions: [
    "court_session_id",
    "status",
    "batch",
    "group_id",
    "round_id",
    "acked_sequence",
    "taken_over_batch",
    "sync_halt",
    // A hash of the account, never the UID nor a name (ADR 0067, D8).
    "owner_key",
  ],
  court_events: [
    "court_session_id",
    "position",
    "event_id",
    "device_id",
    "batch",
    "sequence",
    "schema_version",
    "type",
    "payload",
  ],
  court_refused_events: [
    "court_session_id",
    "position",
    "event_id",
    "device_id",
    "batch",
    "sequence",
    "schema_version",
    "type",
    "payload",
    "refused_at_batch",
    "seen",
  ],
};

const SECRET_TEXT = "Pedro-Silva-secret";

async function storedWith(replacement: string, column: string) {
  const sqlite = await openMigratedDatabase();
  const log = repositoryOn(sqlite);
  await log.openSession(SESSION_A);
  await log.append(SESSION_A, [makeEnvelope({ sequence: 1 })]);
  sqlite.raw.prepare(`UPDATE court_events SET ${column} = ?`).run(replacement);
  return log.load(SESSION_A);
}

describe("load", () => {
  test("keeps the payload keys sorted in the file, so a resend writes the same text", async () => {
    const sqlite = await openMigratedDatabase();
    const log = repositoryOn(sqlite);
    await log.openSession(SESSION_A);

    await log.append(SESSION_A, [makeEnvelope({ sequence: 1 })]);

    const stored = sqlite.raw.prepare("SELECT payload FROM court_events").get();
    expect(stored?.["payload"]).toBe(
      '{"matchId":"f0000000-0000-4000-8000-000000000001","setNumber":1,"team":"a"}',
    );
  });

  test.each([
    ["payload", "not json at all"],
    ["payload", "[1, 2]"],
    ["payload", `{"leak":"${SECRET_TEXT}",`],
    ["type", ""],
    ["event_id", "NOT-A-UUID"],
    ["device_id", `${SECRET_TEXT}-imei`],
  ])(
    "a row with a bad %s is a corrupted log, with no partial state and no echo",
    async (column, value) => {
      const result = await storedWith(value, column);

      expect(result).toEqual({ ok: false, error: { code: "corrupted-log" } });
      expect(JSON.stringify(result)).not.toContain(SECRET_TEXT);
    },
  );

  test("sequences of a device that skip a number are a corrupted log", async () => {
    const sqlite = await openMigratedDatabase();
    const log = repositoryOn(sqlite);
    await log.openSession(SESSION_A);
    await log.append(SESSION_A, [makeEnvelope({ sequence: 1 }), makeEnvelope({ sequence: 2 })]);
    sqlite.raw.exec("UPDATE court_events SET sequence = 5 WHERE position = 2");

    expect(await log.load(SESSION_A)).toEqual({ ok: false, error: { code: "corrupted-log" } });
  });

  test("sequences out of the order of the positions are a corrupted log", async () => {
    const sqlite = await openMigratedDatabase();
    const log = repositoryOn(sqlite);
    await log.openSession(SESSION_A);
    await log.append(SESSION_A, [makeEnvelope({ sequence: 1 }), makeEnvelope({ sequence: 2 })]);
    sqlite.raw.exec(
      "UPDATE court_events SET position = 99 WHERE position = 1; UPDATE court_events SET position = 1 WHERE position = 2; UPDATE court_events SET position = 2 WHERE position = 99",
    );

    expect(await log.load(SESSION_A)).toEqual({ ok: false, error: { code: "corrupted-log" } });
  });

  test("an unknown session cannot be loaded", async () => {
    const sqlite = await openMigratedDatabase();

    expect(await repositoryOn(sqlite).load(SESSION_A)).toEqual({
      ok: false,
      error: { code: "session-not-found" },
    });
  });
});

describe("the schema", () => {
  test("has only ids, numbers and the payload: no column can hold a name", async () => {
    const sqlite = await openMigratedDatabase();

    const found = Object.fromEntries(
      Object.keys(EXPECTED_COLUMNS).map((table) => [
        table,
        sqlite.raw
          .prepare(`SELECT name FROM pragma_table_info('${table}')`)
          .all()
          .map((row) => row["name"]),
      ]),
    );

    expect(found).toEqual(EXPECTED_COLUMNS);
  });
});
