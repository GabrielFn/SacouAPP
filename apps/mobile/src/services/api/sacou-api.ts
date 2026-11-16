import type { SettingsLayer, SettingsTemplateKey } from "@sacou/match-engine";

import type { components } from "../../api/generated/schema";
import type { ApiResult } from "./api-result";

type Schemas = components["schemas"];

export type MyGroup = Schemas["MyGroupResponse"];
export type Group = Schemas["GroupResponse"];
export type Member = Schemas["MemberResponse"];
export type Invite = Schemas["InviteResponse"];
export type GroupRole = Schemas["GroupRole"];
export type MemberType = Schemas["MemberType"];
export type PrimaryPosition = Schemas["PrimaryPosition"];
export type GroupSettingsDocument = Schemas["GroupSettingsResponse"];
export type SavedTemplate = Schemas["SavedTemplateResponse"];
/** The admin's level of a member and its own suggestion: private, admin and co-admin only (ADR 0047). */
export type MemberLevel = Schemas["MemberLevelResponse"];
export type MemberLevelSet = Schemas["MemberLevelSetResponse"];
/** A level on the wire: 1.0 to 5.0 by half points, or `null` for "Não sei" (`perfil-e-nota.md`). */
export type MemberLevelItem = Schemas["SetMemberLevelItem"];

/** The template to copy onto the group: one of the ready-made ones, or one the group saved. */
export type TemplateChoice =
  | { readonly kind: "ready"; readonly key: SettingsTemplateKey }
  | { readonly kind: "saved"; readonly templateId: string };

export type Round = Schemas["RoundResponse"];
export type RoundSummary = Schemas["RoundSummaryResponse"];
export type CreateRoundBody = Schemas["CreateRoundRequest"];
export type UpdateRoundBody = Schemas["UpdateRoundRequest"];
export type AttendanceAnswer = Schemas["AttendanceAnswerResponse"];
export type AttendanceResponse = Schemas["AttendanceResponse"];
/** A guest without an account: a name of someone who accepted no terms, and a private level (ADR 0053). */
export type AddGuestBody = Schemas["AddGuestRequest"];
export type AddedGuest = Schemas["AddGuestResponse"];

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
  createGroup(
    name: string,
    templateKey: SettingsTemplateKey,
  ): Promise<ApiResult<Schemas["CreateGroupResponse"]>>;
  getGroup(groupId: string): Promise<ApiResult<Group>>;
  renameGroup(groupId: string, name: string): Promise<ApiResult<Schemas["RenameGroupResponse"]>>;
  getGroupSettings(groupId: string): Promise<ApiResult<GroupSettingsDocument>>;
  /** A partial layer: the server merges it leaf by leaf and answers the whole document. */
  updateGroupSettings(
    groupId: string,
    layer: SettingsLayer,
  ): Promise<ApiResult<GroupSettingsDocument>>;
  applyTemplate(groupId: string, choice: TemplateChoice): Promise<ApiResult<GroupSettingsDocument>>;
  listTemplates(groupId: string): Promise<ApiResult<readonly SavedTemplate[]>>;
  saveTemplate(groupId: string, name: string): Promise<ApiResult<SavedTemplate>>;
  deleteTemplate(groupId: string, templateId: string): Promise<ApiResult<null>>;
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
  /** Admin and co-admin only (403 for the others): never asked for them, never persisted (ADR 0047). */
  listMemberLevels(groupId: string): Promise<ApiResult<readonly MemberLevel[]>>;
  setMemberLevel(member: MemberRef, level: number | null): Promise<ApiResult<MemberLevelSet>>;
  /** From 1 to 50 members, all or nothing. */
  setMemberLevels(
    groupId: string,
    levels: readonly MemberLevelItem[],
  ): Promise<ApiResult<readonly MemberLevelSet[]>>;
  /** The invite token comes back only here, in the result of the mutation, never in a query. */
  createInvite(groupId: string): Promise<ApiResult<Schemas["CreateInviteResponse"]>>;
  listInvites(groupId: string): Promise<ApiResult<readonly Invite[]>>;
  revokeInvite(groupId: string, inviteId: string): Promise<ApiResult<null>>;
  previewInvite(token: string): Promise<ApiResult<Schemas["PreviewInviteResponse"]>>;
  acceptInvite(token: string): Promise<ApiResult<Schemas["AcceptInviteResponse"]>>;
  listRounds(groupId: string): Promise<ApiResult<readonly RoundSummary[]>>;
  getRound(groupId: string, roundId: string): Promise<ApiResult<Round>>;
  createRound(groupId: string, body: CreateRoundBody): Promise<ApiResult<Round>>;
  updateRound(groupId: string, roundId: string, body: UpdateRoundBody): Promise<ApiResult<Round>>;
  respondAttendance(
    groupId: string,
    roundId: string,
    response: AttendanceResponse,
  ): Promise<ApiResult<AttendanceAnswer>>;
  /** Marks another member (admin and co-admin only): the server decides the place. */
  setMemberAttendance(
    member: MemberRef & { readonly roundId: string },
    response: AttendanceResponse,
  ): Promise<ApiResult<AttendanceAnswer>>;
  /** The same `requestId` in the same group answers the same `memberId` (ADR 0053, D5). Admin and co-admin. */
  addGuest(groupId: string, body: AddGuestBody): Promise<ApiResult<AddedGuest>>;
}

export type SacouApiOperation = keyof SacouApi;
