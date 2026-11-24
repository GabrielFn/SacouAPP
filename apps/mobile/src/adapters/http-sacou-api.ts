import createClient from "openapi-fetch";

import type { paths } from "../api/generated/schema";
import type { ApiError } from "../services/api/api-error";
import {
  finalError,
  isAccountDeleted,
  nextStep,
  type AttemptState,
} from "../services/api/api-policy";
import type { AppBuild } from "../features/app-config/app-build";
import { createGuardedFetch, NetworkFailure, refuseEverything } from "./http-guarded-fetch";
import { authInit, NOT_SENT, readOutcome, type Call } from "./http-outcome";
import { createAccountOperations } from "./http-account-operations";
import { createCourtOperations } from "./http-court-operations";
import { createLevelOperations } from "./http-level-operations";
import { createNotificationOperations } from "./http-notification-operations";
import { group, member } from "./http-path-params";
import { createProfileOperations } from "./http-profile-operations";
import { createRoundOperations } from "./http-round-operations";
import { createStatsOperations } from "./http-stats-operations";
import { apiErr, apiOk, type ApiResult } from "../services/api/api-result";
import type { HttpTransport } from "../services/api/http-transport";
import type { IdTokenProvider } from "../services/api/id-token-provider";
import type { SessionIdentity } from "../services/auth/auth-session";
import type { SacouApi } from "../services/api/sacou-api";

/** A request that takes longer is treated as no network (E4.2, D5). */
export const REQUEST_TIMEOUT_MS = 15_000;

export interface HttpSacouApiOptions {
  /** `null` when the build has no API: nothing is sent and every call is `unexpected`. */
  readonly baseUrl: string | null;
  readonly transport: HttpTransport;
  readonly idTokens: IdTokenProvider;
  readonly now?: () => number;
  readonly timeoutMs?: number;
  /** The native build, sent in two headers on every request; without one, none is sent (ADR 0084). */
  readonly appBuild?: AppBuild;
}

export type { Call };

const ACCOUNT_CHANGED: ApiError = { kind: "account-changed" };

/**
 * The real `SacouApi` over `openapi-fetch`, typed by the generated `paths` (E4.2, D4 and D7). It builds the
 * request and reads the answer; when to repeat is `api-policy`. It logs nothing.
 */
export function createHttpSacouApi(options: HttpSacouApiOptions): SacouApi {
  const { baseUrl, transport, idTokens } = options;
  const now = options.now ?? Date.now;
  const client = createClient<paths>({
    baseUrl: baseUrl ?? "",
    redirect: "manual",
    fetch:
      baseUrl === null
        ? refuseEverything
        : createGuardedFetch(
            baseUrl,
            transport,
            options.timeoutMs ?? REQUEST_TIMEOUT_MS,
            options.appBuild,
          ),
  });
  // Calls refused at the same time share one renewal (D5).
  const renewal: { current: Promise<string | null> | null } = { current: null };

  function renewToken(): Promise<string | null> {
    renewal.current ??= idTokens.getIdToken({ forceRefresh: true }).finally(() => {
      renewal.current = null;
    });
    return renewal.current;
  }

  /** `token` is `null` only for the anonymous app config (ADR 0084): no Authorization header. */
  async function attempt<T>(call: Call<T>, token: string | null): Promise<ApiResult<T>> {
    try {
      return readOutcome(baseUrl ?? "", await call(authInit(token)), now());
    } catch (error) {
      return apiErr(error instanceof NetworkFailure ? { kind: "offline" } : NOT_SENT);
    }
  }

  function giveUp<T>(error: ApiError): ApiResult<T> {
    if (error.kind === "session-expired") idTokens.onSessionExpired();
    return apiErr(finalError(error));
  }

  const signInCall: Call<unknown> = (init) => client.POST("/v1/me", init);

  async function tokenFor(state: AttemptState): Promise<ApiResult<string | null>> {
    try {
      return apiOk(
        state.renewedToken
          ? await renewToken()
          : await idTokens.getIdToken({ forceRefresh: false }),
      );
    } catch {
      // Only no network rejects (the SDK's other refusals give `null`, which ends the session below):
      // the session is not over (ADR 0057, D5).
      return apiErr({ kind: "offline" });
    }
  }

  /** A call tied to an account leaves only while that account is signed in (ADR 0067, D8). */
  function switchedFrom(account: SessionIdentity | null): boolean {
    return account !== null && idTokens.currentSession() !== account;
  }

  async function tokenOf(
    state: AttemptState,
    account: SessionIdentity | null,
  ): Promise<ApiResult<string | null>> {
    if (switchedFrom(account)) return apiErr(ACCOUNT_CHANGED);
    const token = await tokenFor(state);
    // The token was read while waiting: the account may have changed meanwhile.
    return token.ok && switchedFrom(account) ? apiErr(ACCOUNT_CHANGED) : token;
  }

  async function run<T>(
    call: Call<T>,
    state: AttemptState,
    account: SessionIdentity | null,
  ): Promise<ApiResult<T>> {
    const session = idTokens.currentSession();
    const tokenResult = await tokenOf(state, account);
    if (!tokenResult.ok) return tokenResult;
    const token = tokenResult.value;
    if (token === null) return giveUp({ kind: "session-expired" });
    const result = await attempt(call, token);
    if (result.ok) return result;
    switch (nextStep(result.error, state)) {
      case "renew-token":
        return run(call, { ...state, renewedToken: true }, account);
      case "sign-in": {
        const signed = await attempt(signInCall, token);
        if (signed.ok) return run(call, { ...state, signedIn: true }, account);
        if (isAccountDeleted(signed.error) && session !== null) idTokens.onAccountDeleted(session);
        return giveUp(signed.error);
      }
      case "give-up":
        return giveUp(result.error);
    }
  }

  function executeAs<T>(call: Call<T>, account: SessionIdentity | null): Promise<ApiResult<T>> {
    if (baseUrl === null) return Promise.resolve(apiErr(NOT_SENT));
    return run(call, { renewedToken: false, signedIn: false }, account);
  }

  function execute<T>(call: Call<T>): Promise<ApiResult<T>> {
    return executeAs(call, null);
  }

  async function executeEmpty(call: Call<unknown>): Promise<ApiResult<null>> {
    const result = await execute(call);
    return result.ok ? apiOk(null) : result;
  }

  return {
    getAppConfig: () => attempt((init) => client.GET("/v1/app-config", init), null),
    signIn: () => execute((init) => client.POST("/v1/me", init)),
    listMyGroups: () => execute((init) => client.GET("/v1/groups", init)),
    createGroup: (name, templateKey, settings) =>
      execute((init) =>
        client.POST("/v1/groups", {
          ...init,
          body: settings ? { name, templateKey, settings } : { name, templateKey },
        }),
      ),
    getGroup: (groupId) =>
      execute((init) => client.GET("/v1/groups/{groupId}", { ...init, ...group(groupId) })),
    renameGroup: (groupId, name) =>
      execute((init) =>
        client.PATCH("/v1/groups/{groupId}", { ...init, ...group(groupId), body: { name } }),
      ),
    getGroupSettings: (groupId) =>
      execute((init) =>
        client.GET("/v1/groups/{groupId}/settings", { ...init, ...group(groupId) }),
      ),
    updateGroupSettings: (groupId, layer) =>
      execute((init) =>
        client.PATCH("/v1/groups/{groupId}/settings", {
          ...init,
          ...group(groupId),
          body: { settings: layer },
        }),
      ),
    applyTemplate: (groupId, choice) =>
      execute((init) =>
        client.POST("/v1/groups/{groupId}/settings/apply-template", {
          ...init,
          ...group(groupId),
          body:
            choice.kind === "ready"
              ? { templateKey: choice.key, savedTemplateId: null }
              : { templateKey: null, savedTemplateId: choice.templateId },
        }),
      ),
    listTemplates: (groupId) =>
      execute((init) =>
        client.GET("/v1/groups/{groupId}/templates", { ...init, ...group(groupId) }),
      ),
    saveTemplate: (groupId, name) =>
      execute((init) =>
        client.POST("/v1/groups/{groupId}/templates", {
          ...init,
          ...group(groupId),
          body: { name },
        }),
      ),
    deleteTemplate: (groupId, templateId) =>
      executeEmpty((init) =>
        client.DELETE("/v1/groups/{groupId}/templates/{templateId}", {
          ...init,
          params: { path: { groupId, templateId } },
        }),
      ),
    listMembers: (groupId) =>
      execute((init) => client.GET("/v1/groups/{groupId}/members", { ...init, ...group(groupId) })),
    changeMemberRole: (ref, role) =>
      execute((init) =>
        client.PUT("/v1/groups/{groupId}/members/{memberId}/role", {
          ...init,
          ...member(ref),
          body: { role },
        }),
      ),
    changeMemberType: (ref, memberType) =>
      execute((init) =>
        client.PUT("/v1/groups/{groupId}/members/{memberId}/type", {
          ...init,
          ...member(ref),
          body: { memberType },
        }),
      ),
    removeMember: (ref) =>
      executeEmpty((init) =>
        client.DELETE("/v1/groups/{groupId}/members/{memberId}", { ...init, ...member(ref) }),
      ),
    leaveGroup: (groupId) =>
      executeEmpty((init) =>
        client.POST("/v1/groups/{groupId}/leave", { ...init, ...group(groupId) }),
      ),
    createInvite: (groupId) =>
      execute((init) =>
        client.POST("/v1/groups/{groupId}/invites", { ...init, ...group(groupId) }),
      ),
    listInvites: (groupId) =>
      execute((init) => client.GET("/v1/groups/{groupId}/invites", { ...init, ...group(groupId) })),
    revokeInvite: (groupId, inviteId) =>
      executeEmpty((init) =>
        client.DELETE("/v1/groups/{groupId}/invites/{inviteId}", {
          ...init,
          params: { path: { groupId, inviteId } },
        }),
      ),
    previewInvite: (token) =>
      execute((init) => client.POST("/v1/invites/preview", { ...init, body: { token } })),
    acceptInvite: (token) =>
      execute((init) => client.POST("/v1/invites/accept", { ...init, body: { token } })),
    ...createLevelOperations(client, execute),
    ...createRoundOperations(client, execute),
    ...createStatsOperations(client, execute),
    ...createProfileOperations(client, execute),
    ...createAccountOperations(client, execute),
    ...createCourtOperations(client, executeAs),
    ...createNotificationOperations(client, execute),
  };
}
