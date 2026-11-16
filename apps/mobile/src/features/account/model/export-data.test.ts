import { describe, expect, test } from "vitest";

import { createFakeFileShare, createFakeTempFileSdk } from "../../../adapters/fake-file-share";
import { createFakeSacouApi } from "../../../adapters/fake-sacou-api";
import { createTempFileShare } from "../../../adapters/temp-file-share";
import { apiErr, apiOk } from "../../../services/api/api-result";
import { isPersistedKey } from "../../../services/query/persist-policy";
import { queryKeys } from "../../../services/query/query-keys";
import { apiErrorKindTexts } from "../../../strings/api-errors.pt-BR";
import { strings } from "../../../strings/pt-BR";
import { exportDataMutation } from "../queries/account-queries";
import {
  exportFailureText,
  exportFileName,
  exportMyData,
  removeExportLeftovers,
} from "./export-data";

const NOW = new Date(2026, 10, 15, 21, 30);
const DOCUMENT = {
  format: "sacou-personal-data",
  version: 1,
  profile: { nickname: "João", otherPositions: ["opposite"] },
  groups: [{ groupName: "Racha de terça", role: "admin" }],
};

function setup() {
  const fake = createFakeSacouApi();
  const fileShare = createFakeFileShare();
  return { fake, fileShare, deps: { api: fake.api, fileShare, now: () => NOW } };
}

describe("sheet 30a: exporting my data (E4.3, D9)", () => {
  test("the file is named by the day on the phone, with nothing of the person", () => {
    expect(exportFileName(NOW)).toBe("sacou-meus-dados-2026-11-15.json");
    expect(exportFileName(new Date(2027, 0, 3, 0, 5))).toBe("sacou-meus-dados-2027-01-03.json");
  });

  test("success shares the answer once, as the file's whole content", async () => {
    const { fake, fileShare, deps } = setup();
    fake.respond("exportMyData", apiOk(DOCUMENT));
    expect(await exportMyData(deps)).toEqual({ ok: true, value: null });
    const [file, ...more] = fileShare.shared();
    expect(more).toHaveLength(0);
    expect(file?.name).toBe("sacou-meus-dados-2026-11-15.json");
    expect(JSON.parse(file?.text ?? "null")).toEqual(DOCUMENT);
  });

  test("nothing is asked before the tap: the mutation calls only when run", async () => {
    const { fake, fileShare, deps } = setup();
    fake.respond("exportMyData", apiOk(DOCUMENT));
    const mutation = exportDataMutation(deps);
    expect(fake.calls()).toHaveLength(0);
    const result = await mutation.mutationFn();
    expect(fake.calls().map((call) => call.operation)).toEqual(["exportMyData"]);
    // The result is only ok or a failure kind: the document never reaches the mutation state.
    expect(JSON.stringify(result)).not.toContain("João");
    expect(mutation.gcTime).toBe(0);
    expect(fileShare.shared()).toHaveLength(1);
  });

  test("the preview and the export live under ['me']: never persisted", () => {
    expect(isPersistedKey(queryKeys.deletionBlockers())).toBe(false);
    expect(isPersistedKey(queryKeys.me())).toBe(false);
  });

  test.each([
    ["offline", { kind: "offline" } as const, apiErrorKindTexts.offline],
    ["a 5xx", { kind: "unexpected", status: 500 } as const, apiErrorKindTexts.unexpected],
  ])("%s shows its text and shares nothing", async (_name, error, text) => {
    const { fake, fileShare, deps } = setup();
    fake.respond("exportMyData", apiErr(error));
    const result = await exportMyData(deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(exportFailureText(result.error)).toBe(text);
    expect(fileShare.shared()).toHaveLength(0);
  });

  test("a phone that cannot share shows the share text", async () => {
    const { fake, fileShare, deps } = setup();
    fake.respond("exportMyData", apiOk(DOCUMENT));
    fileShare.fail("unavailable");
    const result = await exportMyData(deps);
    expect(result.ok ? null : exportFailureText(result.error)).toBe(
      strings.account.exportSheet.shareUnavailable,
    );
  });
});

describe("the temporary file (createTempFileShare)", () => {
  test("written, shared and deleted after the sheet closes", async () => {
    const sdk = createFakeTempFileSdk();
    const share = createTempFileShare(sdk);
    expect(await share.shareJsonFile("sacou-meus-dados-2026-11-15.json", "{}")).toEqual({
      ok: true,
      value: null,
    });
    const uri = "file:///cache/sacou-meus-dados-2026-11-15.json";
    expect(sdk.log()).toEqual([
      "create:sacou-meus-dados-2026-11-15.json",
      `write:${uri}`,
      `share:${uri}`,
      `remove:${uri}`,
    ]);
    expect(sdk.files().size).toBe(0);
  });

  test("deleted also when sharing fails, and the reason (with the path) does not go on", async () => {
    const sdk = createFakeTempFileSdk({ shareFails: true });
    const result = await createTempFileShare(sdk).shareJsonFile("a.json", "{}");
    expect(result).toEqual({ ok: false, error: "failed" });
    expect(JSON.stringify(result)).not.toContain("cache");
    expect(sdk.files().size).toBe(0);
  });

  test("a write that fails after the file was created deletes it too", async () => {
    const sdk = createFakeTempFileSdk({ writeFails: true });
    const result = await createTempFileShare(sdk).shareJsonFile("sacou-meus-dados-x.json", "{}");
    expect(result).toEqual({ ok: false, error: "failed" });
    expect(sdk.log()).toContain("remove:file:///cache/sacou-meus-dados-x.json");
    expect(sdk.files().size).toBe(0);
  });

  test("when the app opens, the exports left behind go and the other files stay", async () => {
    const left = "file:///cache/sacou-meus-dados-2026-11-14.json";
    const other = "file:///cache/sacou-cache.db";
    const sdk = createFakeTempFileSdk({
      existing: new Map([
        [left, "{}"],
        [other, "x"],
      ]),
    });
    await removeExportLeftovers(createTempFileShare(sdk));
    expect([...sdk.files().keys()]).toEqual([other]);
  });

  test("a phone without sharing writes nothing", async () => {
    const sdk = createFakeTempFileSdk({ canShare: false });
    expect(await createTempFileShare(sdk).shareJsonFile("a.json", "{}")).toEqual({
      ok: false,
      error: "unavailable",
    });
    expect(sdk.log()).toEqual([]);
  });
});
