import createClient from "openapi-fetch";

import type { paths } from "../api/generated/schema";
import type { ApiError } from "../services/api/api-error";
import { isApiUrl } from "../services/api/api-config";
import {
  classifyFailure,
  finalError,
  isJson,
  isSuccess,
  nextStep,
  type AttemptState,
} from "../services/api/api-policy";
import { createLevelOperations } from "./http-level-operations";
import { group, member } from "./http-path-params";
import { createRoundOperations } from "./http-round-operations";
import { apiErr, apiOk, type ApiResult } from "../services/api/api-result";
import type { HttpRequest, HttpTransport } from "../services/api/http-transport";
import type { IdTokenProvider } from "../services/api/id-token-provider";
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
}

// A type and not an interface: openapi-fetch takes an init with an index signature.
type AuthInit = { readonly headers: Readonly<Record<string, string>> };

interface FetchOutcome<T> {
  readonly data?: T;
  readonly error?: unknown;
  readonly response: Response;
}

export type Call<T> = (init: AuthInit) => Promise<FetchOutcome<T>>;

/** The transport failed (no network, timeout): `offline`. Anything else thrown is `unexpected`. */
class NetworkFailure extends Error {}
/** A URL outside the API's origin: refused before anything is sent (D7). */
class OtherOriginRefused extends Error {}

const NOT_SENT: ApiError = { kind: "unexpected", status: 0 };
const BODYLESS_METHODS: ReadonlySet<string> = new Set(["GET", "HEAD", "DELETE"]);

async function bodyOf(request: Request): Promise<string | null> {
  if (BODYLESS_METHODS.has(request.method)) return null;
  const text = await request.text();
  return text === "" ? null : text;
}

function createGuardedFetch(baseUrl: string, transport: HttpTransport, timeoutMs: number) {
  return async (request: Request): Promise<Response> => {
    if (!isApiUrl(baseUrl, request.url)) throw new OtherOriginRefused();
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, timeoutMs);
    try {
      const sent: HttpRequest = {
        url: request.url,
        method: request.method,
        headers: request.headers,
        body: await bodyOf(request),
        signal: controller.signal,
      };
      return await transport(sent);
    } catch {
      // The reason may carry the URL: only the kind goes on.
      throw new NetworkFailure();
    } finally {
      clearTimeout(timer);
    }
  };
}

function refuseEverything(): Promise<Response> {
  return Promise.reject(new OtherOriginRefused());
}

function readOutcome<T>(baseUrl: string, outcome: FetchOutcome<T>, nowMs: number): ApiResult<T> {
  const { response } = outcome;
  const contentType = response.headers.get("content-type");
  // A transport that followed a redirect anyway: what came back is not the API's answer (D7).
  const moved = response.url !== "" && !isApiUrl(baseUrl, response.url);
  if (moved || response.type === "opaqueredirect") return apiErr(NOT_SENT);
  if (!isSuccess(response.status)) {
    const retryAfter = response.headers.get("retry-after");
    const raw = { status: response.status, contentType, retryAfter, body: outcome.error };
    return apiErr(classifyFailure(raw, nowMs));
  }
  if (outcome.data !== undefined && !isJson(contentType)) {
    return apiErr({ kind: "unexpected", status: response.status });
  }
  // The body was read by openapi-fetch for this operation's success status: its type is the contract's.
  return apiOk(outcome.data as T);
}

function authInit(token: string): AuthInit {
  return { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } };
}

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
        : createGuardedFetch(baseUrl, transport, options.timeoutMs ?? REQUEST_TIMEOUT_MS),
  });
  // Calls refused at the same time share one renewal (D5).
  const renewal: { current: Promise<string | null> | null } = { current: null };

  function renewToken(): Promise<string | null> {
    renewal.current ??= idTokens.getIdToken({ forceRefresh: true }).finally(() => {
      renewal.current = null;
    });
    return renewal.current;
  }

  async function attempt<T>(call: Call<T>, token: string): Promise<ApiResult<T>> {
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
      // The SDK could not renew the token (no network): the session is not over (ADR 0057, D5).
      return apiErr({ kind: "offline" });
    }
  }

  async function run<T>(call: Call<T>, state: AttemptState): Promise<ApiResult<T>> {
    const tokenResult = await tokenFor(state);
    if (!tokenResult.ok) return tokenResult;
    const token = tokenResult.value;
    if (token === null) return giveUp({ kind: "session-expired" });
    const result = await attempt(call, token);
    if (result.ok) return result;
    switch (nextStep(result.error, state)) {
      case "renew-token":
        return run(call, { ...state, renewedToken: true });
      case "sign-in": {
        const signed = await attempt(signInCall, token);
        return signed.ok ? run(call, { ...state, signedIn: true }) : giveUp(signed.error);
      }
      case "give-up":
        return giveUp(result.error);
    }
  }

  function execute<T>(call: Call<T>): Promise<ApiResult<T>> {
    if (baseUrl === null) return Promise.resolve(apiErr(NOT_SENT));
    return run(call, { renewedToken: false, signedIn: false });
  }

  async function executeEmpty(call: Call<unknown>): Promise<ApiResult<null>> {
    const result = await execute(call);
    return result.ok ? apiOk(null) : result;
  }

  return {
    signIn: () => execute((init) => client.POST("/v1/me", init)),
    listMyGroups: () => execute((init) => client.GET("/v1/groups", init)),
    createGroup: (name, templateKey) =>
      execute((init) => client.POST("/v1/groups", { ...init, body: { name, templateKey } })),
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
  };
}
