import { MutationObserver } from "@tanstack/react-query";
import { describe, expect, test } from "vitest";

import { createFakeSacouApi } from "../../../adapters/fake-sacou-api";
import { apiErr, apiOk } from "../../../services/api/api-result";
import { createSacouQueryClient } from "../../../services/query/query-client";
import { reportTargetOf } from "../hooks/use-members-screen";
import { reportContentMutation } from "../queries/report-mutations";
import { initialMembersScreenState, membersScreenReducer } from "./members-screen.reducer";
import { GROUP, member } from "./members.test.fixture";
import { canReportGroup, reportBody, reportTitle } from "./report";

describe("the body of a report (E6.6)", () => {
  test("a member goes by its id, the group with null; never a name", () => {
    expect(reportBody({ kind: "member", memberId: "m", name: "Bia" }, "spam")).toEqual({
      reportedMemberId: "m",
      reason: "spam",
    });
    expect(reportBody({ kind: "group" }, "offensiveName")).toEqual({
      reportedMemberId: null,
      reason: "offensiveName",
    });
    expect(reportTitle({ kind: "member", memberId: "m", name: "Bia" })).toBe("Denunciar Bia");
  });
});

describe("Denunciar grupo on screen 18 (E6.6, criterion 13)", () => {
  const admin = member("a", "admin");
  test.each(["coAdmin", "scorekeeper", "player"] as const)("%s sees the line", (role) => {
    expect(canReportGroup([admin, member("me", role, { isMe: true })])).toBe(true);
  });

  test("the only admin does not; an admin with another admin does", () => {
    const me = member("me", "admin", { isMe: true });
    expect(canReportGroup([me, member("p", "player")])).toBe(false);
    expect(canReportGroup([me, admin])).toBe(true);
  });

  test("hidden until the members are known", () => {
    expect(canReportGroup(undefined)).toBe(false);
    expect(canReportGroup([admin])).toBe(false);
  });
});

describe("the report on screen 19 (E6.6)", () => {
  test("asking opens only the report sheet, closing clears it", () => {
    const options = membersScreenReducer(initialMembersScreenState, {
      type: "sheet-opened",
      memberId: "b",
    });
    const asked = membersScreenReducer(options, {
      type: "member-confirm-asked",
      kind: "report",
      memberId: "b",
    });
    expect(asked).toEqual({
      sheetMemberId: null,
      level: null,
      confirm: { kind: "report", memberId: "b" },
    });
    expect(membersScreenReducer(asked, { type: "confirm-closed" }).confirm).toBeNull();
  });

  test("the target is read again from the members: the nickname, or nothing once gone", () => {
    const bia = { ...member("b", "player"), nickname: "Bia" };
    const confirm = { kind: "report", memberId: "b" } as const;
    expect(reportTargetOf([bia], confirm)).toEqual({ kind: "member", memberId: "b", name: "Bia" });
    expect(reportTargetOf([], confirm)).toBeNull();
    expect(reportTargetOf([bia], { kind: "leave" })).toBeNull();
    expect(reportTargetOf(undefined, confirm)).toBeNull();
  });
});

describe("reportContentMutation (E6.6)", () => {
  test("calls the port with the group and the body, and its status is the sheet's", async () => {
    const fake = createFakeSacouApi();
    fake.respond("reportContent", apiOk(null));
    const observer = new MutationObserver(
      createSacouQueryClient(),
      reportContentMutation(fake.api, GROUP),
    );
    await observer.mutate({ reportedMemberId: null, reason: "spam" });
    expect(fake.calls()).toEqual([
      { operation: "reportContent", args: [GROUP, { reportedMemberId: null, reason: "spam" }] },
    ]);
    expect(observer.getCurrentResult().isSuccess).toBe(true);
  });

  test("a refusal is an error of the mutation", async () => {
    const fake = createFakeSacouApi();
    fake.respond(
      "reportContent",
      apiErr({ kind: "problem", status: 400, code: "groups.report-self" }),
    );
    const observer = new MutationObserver(
      createSacouQueryClient(),
      reportContentMutation(fake.api, GROUP),
    );
    await expect(observer.mutate({ reportedMemberId: "m", reason: "spam" })).rejects.toThrow();
    expect(observer.getCurrentResult().isError).toBe(true);
  });
});
