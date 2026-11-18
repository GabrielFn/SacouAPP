import { describe, expect, test } from "vitest";

import { strings } from "../../../strings/pt-BR";
import { withUploadNotice } from "../model/hint-line";
import { uploadStoppedText } from "../model/screen-texts";
import { selectSyncNotice } from "./sync-notice";

const SENDING = { takenOver: false, syncHalt: null, otherAccount: false };

describe("selectSyncNotice (question 85, D7)", () => {
  test("nothing while the upload goes on", () => {
    expect(selectSyncNotice(SENDING)).toBeNull();
  });

  test("taken over comes first, then the halt, then the account", () => {
    expect(
      selectSyncNotice({ takenOver: true, syncHalt: "event-refused", otherAccount: true }),
    ).toEqual({ kind: "taken-over" });
    expect(
      selectSyncNotice({ ...SENDING, syncHalt: "round-canceled", otherAccount: true }),
    ).toEqual({ kind: "stopped", reason: "round-canceled" });
    expect(selectSyncNotice({ ...SENDING, otherAccount: true })).toEqual({
      kind: "stopped",
      reason: "other-account",
    });
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
  });

  test("says the reason when it is simple, the generic line otherwise", () => {
    const { upload } = strings.court;
    expect(uploadStoppedText("round-canceled")).toBe(upload.roundCanceled);
    expect(uploadStoppedText("other-account")).toBe(upload.otherAccount);
    expect(uploadStoppedText("no-permission")).toBe(upload.noPermission);
    expect(uploadStoppedText("stream-diverged")).toBe(upload.stopped);
    expect(uploadStoppedText("event-refused")).toBe(upload.stopped);
  });
});
