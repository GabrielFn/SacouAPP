import { describe, expect, test } from "vitest";

import { strings } from "../../../strings/pt-BR";
import { withUploadNotice } from "../model/hint-line";
import { uploadStoppedText } from "../model/screen-texts";
import { selectSyncNotice } from "./sync-notice";

const SENDING = { takenOver: false, syncHalt: null, ownership: "own" } as const;

describe("selectSyncNotice (question 85, D7, D8)", () => {
  test("nothing while the upload goes on", () => {
    expect(selectSyncNotice(SENDING)).toBeNull();
  });

  test("taken over comes first, then another account, then the halt", () => {
    expect(
      selectSyncNotice({ takenOver: true, syncHalt: "event-refused", ownership: "other-account" }),
    ).toEqual({ kind: "taken-over" });
    expect(
      selectSyncNotice({ ...SENDING, syncHalt: "round-canceled", ownership: "other-account" }),
    ).toEqual({ kind: "other-account" });
    expect(selectSyncNotice({ ...SENDING, syncHalt: "round-canceled" })).toEqual({
      kind: "stopped",
      reason: "round-canceled",
    });
  });

  test("a session without an owner says the generic line of a stop (S4, R5)", () => {
    expect(selectSyncNotice({ ...SENDING, ownership: "unowned" })).toEqual({
      kind: "stopped",
      reason: "unowned",
    });
    expect(uploadStoppedText("unowned")).toBe(strings.court.upload.stopped);
  });
});

describe("the line of the middle strip with the upload stopped", () => {
  test("takes the place of any other line, and leaves it when the upload goes on", () => {
    const hint = { kind: "next-point-closes" } as const;
    expect(withUploadNotice(hint, { kind: "stopped", reason: "not-found" })).toEqual({
      kind: "upload-stopped",
      reason: "not-found",
    });
    expect(withUploadNotice(hint, null)).toBe(hint);
    expect(withUploadNotice(hint, { kind: "taken-over" })).toBe(hint);
    expect(withUploadNotice(hint, { kind: "other-account" })).toBe(hint);
  });

  test("says the reason when it is simple, the generic line otherwise", () => {
    const { upload } = strings.court;
    expect(uploadStoppedText("round-canceled")).toBe(upload.roundCanceled);
    expect(uploadStoppedText("no-permission")).toBe(upload.noPermission);
    expect(uploadStoppedText("stream-diverged")).toBe(upload.stopped);
    expect(uploadStoppedText("event-refused")).toBe(upload.stopped);
  });
});
