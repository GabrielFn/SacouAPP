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
    createInvite: none,
    listInvites: none,
    revokeInvite: none,
    previewInvite: none,
    acceptInvite: none,
  };
}

/** The `SacouApi` of the tests: in memory, programmable per operation. */
export function createFakeSacouApi(): FakeSacouApi {
  const answers = { value: defaults() };
  const log = { value: [] as readonly FakeCall[] };

  function answer<K extends SacouApiOperation>(
    operation: K,
    args: readonly unknown[],
  ): Promise<Answers[K]> {
    log.value = [...log.value, { operation, args }];
    return Promise.resolve(answers.value[operation]);
  }

  const api: SacouApi = {
    signIn: () => answer("signIn", []),
    listMyGroups: () => answer("listMyGroups", []),
    createGroup: (name, templateKey) => answer("createGroup", [name, templateKey]),
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
    createInvite: (groupId) => answer("createInvite", [groupId]),
    listInvites: (groupId) => answer("listInvites", [groupId]),
    revokeInvite: (groupId, inviteId) => answer("revokeInvite", [groupId, inviteId]),
    previewInvite: (token) => answer("previewInvite", [token]),
    acceptInvite: (token) => answer("acceptInvite", [token]),
  };

  return {
    api,
    respond(operation, value) {
      answers.value = { ...answers.value, [operation]: value };
    },
    calls: () => log.value,
  };
}
