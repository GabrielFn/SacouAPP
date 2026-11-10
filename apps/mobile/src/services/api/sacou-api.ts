import type { components } from "../../api/generated/schema";
import type { ApiResult } from "./api-result";

type Schemas = components["schemas"];

export type MyGroup = Schemas["MyGroupResponse"];
export type Group = Schemas["GroupResponse"];
export type Member = Schemas["MemberResponse"];
export type Invite = Schemas["InviteResponse"];
export type GroupRole = Schemas["GroupRole"];
export type MemberType = Schemas["MemberType"];

export interface MemberRef {
  readonly groupId: string;
  readonly memberId: string;
}

/**
 * One method per operation of the API, typed by the generated contract (E4.2, D4). Screens and hooks use
 * this, never `fetch` nor `openapi-fetch`. The ID token is not a parameter: the client adds it.
 */
export interface SacouApi {
  signIn(): Promise<ApiResult<Schemas["SignInResponse"]>>;
  listMyGroups(): Promise<ApiResult<readonly MyGroup[]>>;
  createGroup(name: string): Promise<ApiResult<Schemas["CreateGroupResponse"]>>;
  getGroup(groupId: string): Promise<ApiResult<Group>>;
  renameGroup(groupId: string, name: string): Promise<ApiResult<Schemas["RenameGroupResponse"]>>;
  listMembers(groupId: string): Promise<ApiResult<readonly Member[]>>;
  changeMemberRole(
    member: MemberRef,
    role: GroupRole,
  ): Promise<ApiResult<Schemas["ChangeMemberRoleResponse"]>>;
  changeMemberType(
    member: MemberRef,
    memberType: MemberType,
  ): Promise<ApiResult<Schemas["ChangeMemberTypeResponse"]>>;
  removeMember(member: MemberRef): Promise<ApiResult<null>>;
  leaveGroup(groupId: string): Promise<ApiResult<null>>;
  /** The invite token comes back only here, in the result of the mutation, never in a query. */
  createInvite(groupId: string): Promise<ApiResult<Schemas["CreateInviteResponse"]>>;
  listInvites(groupId: string): Promise<ApiResult<readonly Invite[]>>;
  revokeInvite(groupId: string, inviteId: string): Promise<ApiResult<null>>;
  previewInvite(token: string): Promise<ApiResult<Schemas["PreviewInviteResponse"]>>;
  acceptInvite(token: string): Promise<ApiResult<Schemas["AcceptInviteResponse"]>>;
}

export type SacouApiOperation = keyof SacouApi;
