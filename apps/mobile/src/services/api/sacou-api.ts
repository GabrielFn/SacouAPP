import type { EventEnvelope, SettingsLayer, SettingsTemplateKey } from "@sacou/match-engine";

import type { components } from "../../api/generated/schema";
import type { SessionIdentity } from "../auth/auth-session";
import type { ApiResult } from "./api-result";

type Schemas = components["schemas"];

/** The minimum native build, the store pages and the feature flags of the API (ADR 0084): no token, no person's data. */
export type AppConfig = Schemas["AppConfigResponse"];
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

/** The person's own profile; it has the level they suggest for themselves, so it is never persisted. */
export type MyProfile = Schemas["MyProfileResponse"];
export type SaveMyProfileBody = Schemas["SaveMyProfileRequest"];
export type PlayingPosition = Schemas["PlayingPosition"];
/** Everything the server keeps about the person (ADR 0056, D9): an open object, shared as a file. */
export type MyDataExport = Schemas["JsonObject"];
/** A group where the person is the only admin, with someone else in it (ADR 0056, D3 and D10). */
export type DeletionBlocker = Schemas["DeletionBlockerResponse"];

/** The person's own numbers of the season, total and per group: whole numbers only, never a rating (ADR 0047). */
export type MyStats = Schemas["MyStatsReport"];
export type MyStatsTotals = Schemas["MyStatsTotalsReport"];
export type MyStatsGroup = Schemas["MyStatsGroupReport"];

export type Round = Schemas["RoundResponse"];
export type RoundSummary = Schemas["RoundSummaryResponse"];
/** The numbers of a finished round, computed by the server (E3.9); the app only formats them (screen 12). */
export type RoundSummaryReport = Schemas["RoundSummaryReport"];
/** The instants the server marked when the round was closed (E3.18): `endsAt` moved to `closedAt`. */
export type CloseRoundAnswer = Schemas["CloseRoundResponse"];
/**
 * The MVP ballot of the person signed in (E3.18): the window, whether they may vote, their own vote and
 * the candidates without themselves. No count of votes exists in it (ADR 0048): never persisted (question 178).
 */
export type MvpBallot = Schemas["MvpBallotResponse"];
export type MvpCandidate = Schemas["MvpCandidateResponse"];
export type MvpVotingState = Schemas["MvpVotingState"];
/** The person's own vote: shown only to them, on screen 12a, and never logged nor shared. */
export type MvpVote = Schemas["MyMvpVoteResponse"];
export type CreateRoundBody = Schemas["CreateRoundRequest"];
export type UpdateRoundBody = Schemas["UpdateRoundRequest"];
export type AttendanceAnswer = Schemas["AttendanceAnswerResponse"];
export type AttendanceResponse = Schemas["AttendanceResponse"];
/** A guest without an account: a name of someone who accepted no terms, and a private level (ADR 0053). */
export type AddGuestBody = Schemas["AddGuestRequest"];
export type AddedGuest = Schemas["AddGuestResponse"];
/** The draw of screen 07: `together` locks and the queue of reserves the admin set (ADR 0055). */
export type DrawTeamsBody = Schemas["DrawTeamsRequest"];
/** Carries the admin's level of everyone confirmed: never cached, persisted nor logged (ADR 0047, 0061). */
export type DrawTeamsAnswer = Schemas["DrawTeamsResponse"];
/** The teams of "Confirmar e compartilhar" (R100, ADR 0078): member IDs only, never a level. */
export type ConfirmTeamsBody = Schemas["ConfirmTeamsRequest"];

/** A line of screen 28 (E3.11): the server renders the title and the subtitle from the ids, on reading. */
export type NotificationItem = Schemas["NotificationItem"];
export type NotificationKind = Schemas["NotificationItemKind"];
/** The list of screen 28 and the count of the dot of the bell: only in memory, never persisted (E3.11). */
export type NotificationList = Schemas["NotificationListResponse"];
export type PushDevicePlatform = Schemas["PushDevicePlatform"];

/**
 * The push device of this install (E3.11, Part 2 moved the id from the path into the body). The token is
 * never logged, cached nor shown.
 */
export interface RegisterPushDeviceBody {
  readonly installationId: string;
  readonly token: string;
  readonly platform: PushDevicePlatform;
}

export interface RemovePushDeviceBody {
  readonly installationId: string;
}

/** The stream of a court: the round it is in and the UUID the phone made when it opened (ADR 0060). */
export interface CourtStreamRef {
  readonly groupId: string;
  readonly roundId: string;
  readonly courtSessionId: string;
}

/** 200 of the court stream: the highest sequence of this device the server holds, and how many are new. */
export type AppendCourtEventsAnswer = Schemas["AppendCourtEventsResponse"];

/** Who writes the court of a round now, the count and the last score (ADR 0063, D5). Never cached on disk. */
export type CourtSessionSummary = Schemas["GetCourtSessionResponse"];
export type TakeOverCourtBody = Schemas["TakeOverCourtRequest"];
/** The batch this device writes from now on, and where the stream stood (ADR 0063, D2). */
export type TakeOverCourtAnswer = Schemas["TakeOverCourtResponse"];

/**
 * A page of the stream of a court, as the server sent it: every field is untrusted input until the
 * import parses it (E4.11, D5), so nothing here is typed as an event.
 */
export interface CourtEventsPage {
  readonly events: unknown;
  readonly lastPosition: unknown;
  readonly eventCount: unknown;
}

export interface MemberRef {
  readonly groupId: string;
  readonly memberId: string;
}

/**
 * One method per operation of the API, typed by the generated contract (E4.2, D4). Screens and hooks use
 * this, never `fetch` nor `openapi-fetch`. The ID token is not a parameter: the client adds it.
 */
export interface SacouApi {
  /** Anonymous (ADR 0084): asked before the sign-in, with no ID token. */
  getAppConfig(): Promise<ApiResult<AppConfig>>;
  signIn(): Promise<ApiResult<Schemas["SignInResponse"]>>;
  listMyGroups(): Promise<ApiResult<readonly MyGroup[]>>;
  createGroup(
    name: string,
    templateKey: SettingsTemplateKey,
    /** The rules typed with the name (day, time, venue...), saved in the same call; `null` for none. */
    settings?: SettingsLayer | null,
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
  /**
   * Ends the round now and opens the votation (E3.18). Idempotent; `WriteCourt`. 409
   * `sessions.round-not-started` before the start and `sessions.round-canceled` for a canceled one.
   */
  closeRound(groupId: string, roundId: string): Promise<ApiResult<CloseRoundAnswer>>;
  /** Marks another member (admin and co-admin only): the server decides the place. */
  setMemberAttendance(
    member: MemberRef & { readonly roundId: string },
    response: AttendanceResponse,
  ): Promise<ApiResult<AttendanceAnswer>>;
  /** Any member of the group. `finishedMatches: 0` for a round with no match finished (E4.12). */
  getRoundSummary(groupId: string, roundId: string): Promise<ApiResult<RoundSummaryReport>>;
  /** Screen 12a. 404 `stats.mvp-voting-off` when the group has the vote off. */
  getMvpVoting(groupId: string, roundId: string): Promise<ApiResult<MvpBallot>>;
  /** One final vote (`201`); refusals are `stats.mvp-*` codes that never name the candidate. */
  castMvpVote(
    groupId: string,
    roundId: string,
    candidateMemberId: string,
  ): Promise<ApiResult<MvpVote>>;
  /** 404 `identity.profile-not-found` before the quick profile (screen 27) is ever saved. */
  getMyProfile(): Promise<ApiResult<MyProfile>>;
  /** Replaces the whole profile: what is `null` in the body is cleared. */
  saveMyProfile(body: SaveMyProfileBody): Promise<ApiResult<MyProfile>>;
  /** Screen 14: the season of the server (`America/Sao_Paulo`), only of the person who is signed in. */
  getMyStats(): Promise<ApiResult<MyStats>>;
  /** Screen 30a: built on the spot, `no-store`; the answer lives only in the export, never in the cache. */
  exportMyData(): Promise<ApiResult<MyDataExport>>;
  /** Screen 30b: a preview only; the `DELETE` judges again under the locks of the groups. */
  getDeletionBlockers(): Promise<ApiResult<readonly DeletionBlocker[]>>;
  /**
   * 204 deletes the account on the server; 409 `identity.deletion-blocked` and 403
   * `identity.recent-login-required` change nothing (ADR 0056, D4 and D7).
   */
  deleteMyAccount(): Promise<ApiResult<null>>;
  /** The same `requestId` in the same group answers the same `memberId` (ADR 0053, D5). Admin and co-admin. */
  addGuest(groupId: string, body: AddGuestBody): Promise<ApiResult<AddedGuest>>;
  /** Admin and co-admin only (`DrawTeams`). Stores nothing on the server: each call is a new draw. */
  drawTeams(
    groupId: string,
    roundId: string,
    body: DrawTeamsBody,
  ): Promise<ApiResult<DrawTeamsAnswer>>;
  /**
   * Admin and co-admin only (`DrawTeams`): publishes the teams to every member, in the round's `teams`; the
   * answer is the round as the caller reads it. Replaces the earlier teams whole (ADR 0078).
   */
  confirmTeams(groupId: string, roundId: string, body: ConfirmTeamsBody): Promise<ApiResult<Round>>;
  /** Screen 28: the newest page and the count of unread ones; `no-store` on the server. */
  listNotifications(): Promise<ApiResult<NotificationList>>;
  /** 204, again 204; 404 for a notification of someone else. */
  markNotificationRead(notificationId: string): Promise<ApiResult<null>>;
  markAllNotificationsRead(): Promise<ApiResult<null>>;
  /** Upsert of this install: the same token only refreshes it; a token of another account moves here. */
  registerPushDevice(body: RegisterPushDeviceBody): Promise<ApiResult<null>>;
  /** The first step of the exit of the account (ADR 0057, D4, changed by E3.11): 204, again 204. */
  removePushDevice(body: RemovePushDeviceBody): Promise<ApiResult<null>>;
  /**
   * From 1 to 200 events of one device, all or nothing (ADR 0060). It leaves only with the token of
   * `account`: when another account is signed in by then, it answers `account-changed` and sends nothing
   * (ADR 0067, D8). The envelopes go as the log has them.
   */
  appendCourtEvents(
    ref: CourtStreamRef,
    envelopes: readonly EventEnvelope[],
    account: SessionIdentity,
  ): Promise<ApiResult<AppendCourtEventsAnswer>>;
  /**
   * 404 `court-session-not-found` when the round has no stream yet (ADR 0063, D5). Only with the token
   * of `account`, as the take-over that follows it (ADR 0067, D8).
   */
  getCourtSession(
    groupId: string,
    roundId: string,
    account: SessionIdentity,
  ): Promise<ApiResult<CourtSessionSummary>>;
  /** Only with the token of `account`: the batch is of the pair device and member (ADR 0063, D3). */
  takeOverCourt(
    ref: CourtStreamRef,
    body: TakeOverCourtBody,
    account: SessionIdentity,
  ): Promise<ApiResult<TakeOverCourtAnswer>>;
  /**
   * The envelopes after `after`, up to 500 or 1 MiB per page (ADR 0063, D7). Only with the token of
   * the account that took the court over: another one signed in meanwhile reads nothing (D8).
   */
  listCourtEvents(
    ref: CourtStreamRef,
    after: number,
    account: SessionIdentity,
  ): Promise<ApiResult<CourtEventsPage>>;
}

export type SacouApiOperation = keyof SacouApi;
