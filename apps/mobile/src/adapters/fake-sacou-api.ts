import type { ApiError } from "../services/api/api-error";
import { apiErr } from "../services/api/api-result";
import type { SacouApi, SacouApiOperation } from "../services/api/sacou-api";

type Answers = { readonly [K in SacouApiOperation]: Awaited<ReturnType<SacouApi[K]>> };

export interface FakeCall {
  readonly operation: SacouApiOperation;
  readonly args: readonly unknown[];
}

export interface FakeSacouApi {
  readonly api: SacouApi;
  /** What the operation answers from now on, until programmed again. */
  respond<K extends SacouApiOperation>(operation: K, answer: Answers[K]): void;
  /** Every call in order, with its arguments. There is no ID token here to record. */
  calls(): readonly FakeCall[];
}

/** An operation the test did not program answers like a server that does not exist. */
const NOT_PROGRAMMED: ApiError = { kind: "unexpected", status: 0 };

function defaults(): Answers {
  const none = apiErr(NOT_PROGRAMMED);
  return {
    getAppConfig: none,
    signIn: none,
    listMyGroups: none,
    createGroup: none,
    getGroup: none,
    renameGroup: none,
    getGroupSettings: none,
    updateGroupSettings: none,
    applyTemplate: none,
    listTemplates: none,
    saveTemplate: none,
    deleteTemplate: none,
    listMembers: none,
    changeMemberRole: none,
    changeMemberType: none,
    removeMember: none,
    leaveGroup: none,
    reportContent: none,
    listMemberLevels: none,
    setMemberLevel: none,
    setMemberLevels: none,
    createInvite: none,
    listInvites: none,
    revokeInvite: none,
    previewInvite: none,
    acceptInvite: none,
    listRounds: none,
    getRound: none,
    getRoundSummary: none,
    getMvpVoting: none,
    castMvpVote: none,
    createRound: none,
    updateRound: none,
    closeRound: none,
    respondAttendance: none,
    setMemberAttendance: none,
    getMyProfile: none,
    saveMyProfile: none,
    getMyStats: none,
    exportMyData: none,
    getDeletionBlockers: none,
    deleteMyAccount: none,
    addGuest: none,
    drawTeams: none,
    confirmTeams: none,
    appendCourtEvents: none,
    getCourtSession: none,
    takeOverCourt: none,
    listCourtEvents: none,
    listNotifications: none,
    markNotificationRead: none,
    markAllNotificationsRead: none,
    registerPushDevice: none,
    removePushDevice: none,
  };
}

/** The `SacouApi` of the tests: in memory, programmable per operation. */
export function createFakeSacouApi(): FakeSacouApi {
  const answers = { value: defaults() };
  const log = { value: [] as readonly FakeCall[] };

  function answer<K extends SacouApiOperation>(
    operation: K,
    args: readonly unknown[],
  ): ReturnType<SacouApi[K]> {
    log.value = [...log.value, { operation, args }];
    // Read as `unknown` first: the union of every answer is too large for the compiler to index.
    const programmed: Readonly<Record<SacouApiOperation, unknown>> = answers.value;
    return Promise.resolve(programmed[operation]) as ReturnType<SacouApi[K]>;
  }

  const api: SacouApi = {
    getAppConfig: () => answer("getAppConfig", []),
    signIn: () => answer("signIn", []),
    listMyGroups: () => answer("listMyGroups", []),
    createGroup: (name, templateKey, settings) =>
      answer("createGroup", [name, templateKey, settings ?? null]),
    getGroup: (groupId) => answer("getGroup", [groupId]),
    renameGroup: (groupId, name) => answer("renameGroup", [groupId, name]),
    getGroupSettings: (groupId) => answer("getGroupSettings", [groupId]),
    updateGroupSettings: (groupId, layer) => answer("updateGroupSettings", [groupId, layer]),
    applyTemplate: (groupId, choice) => answer("applyTemplate", [groupId, choice]),
    listTemplates: (groupId) => answer("listTemplates", [groupId]),
    saveTemplate: (groupId, name) => answer("saveTemplate", [groupId, name]),
    deleteTemplate: (groupId, templateId) => answer("deleteTemplate", [groupId, templateId]),
    listMembers: (groupId) => answer("listMembers", [groupId]),
    changeMemberRole: (member, role) => answer("changeMemberRole", [member, role]),
    changeMemberType: (member, type) => answer("changeMemberType", [member, type]),
    removeMember: (member) => answer("removeMember", [member]),
    leaveGroup: (groupId) => answer("leaveGroup", [groupId]),
    reportContent: (groupId, report) => answer("reportContent", [groupId, report]),
    listMemberLevels: (groupId) => answer("listMemberLevels", [groupId]),
    setMemberLevel: (member, level) => answer("setMemberLevel", [member, level]),
    setMemberLevels: (groupId, levels) => answer("setMemberLevels", [groupId, levels]),
    createInvite: (groupId) => answer("createInvite", [groupId]),
    listInvites: (groupId) => answer("listInvites", [groupId]),
    revokeInvite: (groupId, inviteId) => answer("revokeInvite", [groupId, inviteId]),
    previewInvite: (token) => answer("previewInvite", [token]),
    acceptInvite: (token) => answer("acceptInvite", [token]),
    listRounds: (groupId) => answer("listRounds", [groupId]),
    getRound: (groupId, roundId) => answer("getRound", [groupId, roundId]),
    getRoundSummary: (groupId, roundId) => answer("getRoundSummary", [groupId, roundId]),
    getMvpVoting: (groupId, roundId) => answer("getMvpVoting", [groupId, roundId]),
    castMvpVote: (groupId, roundId, candidateMemberId) =>
      answer("castMvpVote", [groupId, roundId, candidateMemberId]),
    createRound: (groupId, body) => answer("createRound", [groupId, body]),
    updateRound: (groupId, roundId, body) => answer("updateRound", [groupId, roundId, body]),
    closeRound: (groupId, roundId) => answer("closeRound", [groupId, roundId]),
    respondAttendance: (groupId, roundId, response) =>
      answer("respondAttendance", [groupId, roundId, response]),
    setMemberAttendance: (member, response) => answer("setMemberAttendance", [member, response]),
    getMyProfile: () => answer("getMyProfile", []),
    saveMyProfile: (body) => answer("saveMyProfile", [body]),
    getMyStats: () => answer("getMyStats", []),
    exportMyData: () => answer("exportMyData", []),
    getDeletionBlockers: () => answer("getDeletionBlockers", []),
    deleteMyAccount: () => answer("deleteMyAccount", []),
    addGuest: (groupId, body) => answer("addGuest", [groupId, body]),
    drawTeams: (groupId, roundId, body) => answer("drawTeams", [groupId, roundId, body]),
    confirmTeams: (groupId, roundId, body) => answer("confirmTeams", [groupId, roundId, body]),
    appendCourtEvents: (ref, envelopes, account) =>
      answer("appendCourtEvents", [ref, envelopes, account]),
    getCourtSession: (groupId, roundId, account) =>
      answer("getCourtSession", [groupId, roundId, account]),
    takeOverCourt: (ref, body, account) => answer("takeOverCourt", [ref, body, account]),
    listCourtEvents: (ref, after, account) => answer("listCourtEvents", [ref, after, account]),
    listNotifications: () => answer("listNotifications", []),
    markNotificationRead: (notificationId) => answer("markNotificationRead", [notificationId]),
    markAllNotificationsRead: () => answer("markAllNotificationsRead", []),
    registerPushDevice: (body) => answer("registerPushDevice", [body]),
    removePushDevice: (body) => answer("removePushDevice", [body]),
  };

  return {
    api,
    respond(operation, value) {
      answers.value = { ...answers.value, [operation]: value };
    },
    calls: () => log.value,
  };
}
