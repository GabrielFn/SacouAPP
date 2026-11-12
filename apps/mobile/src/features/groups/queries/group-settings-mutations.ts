import type { SettingsLayer, SettingsTemplateKey } from "@sacou/match-engine";
import type { QueryClient } from "@tanstack/react-query";

import { apiErrorOf } from "../../../services/api/api-error";
import { unwrap } from "../../../services/api/api-result";
import type { SacouApi, TemplateChoice } from "../../../services/api/sacou-api";
import {
  applyCacheEffects,
  cacheEffectsOf,
  conflictEffects,
} from "../../../services/query/invalidation";
import { viewOrThrow } from "./group-settings-queries";

/** One queue per group: TanStack runs the mutations of a scope one after the other (ADR 0049, D4). */
export function settingsScope(groupId: string): { readonly id: string } {
  return { id: `settings-${groupId}` };
}

function refused(client: QueryClient, groupId: string, error: unknown): void {
  const apiError = apiErrorOf(error);
  const forbidden = apiError?.kind === "problem" && apiError.code === "groups.forbidden";
  if (forbidden) applyCacheEffects(client, cacheEffectsOf({ type: "settingsForbidden", groupId }));
  applyCacheEffects(client, conflictEffects(groupId, error));
}

/** The answer of a write is the whole merged document: it replaces the cache (D4). */
export function updateSettingsMutation(api: SacouApi, client: QueryClient, groupId: string) {
  return {
    scope: settingsScope(groupId),
    mutationFn: async (layer: SettingsLayer) =>
      viewOrThrow(await unwrap(api.updateGroupSettings(groupId, layer))),
    onSuccess: (view: unknown) => {
      applyCacheEffects(client, cacheEffectsOf({ type: "settingsReplaced", groupId, view }));
    },
    onError: (error: unknown) => {
      refused(client, groupId, error);
    },
  };
}

export function applyTemplateMutation(api: SacouApi, client: QueryClient, groupId: string) {
  return {
    scope: settingsScope(groupId),
    mutationFn: async (choice: TemplateChoice) =>
      viewOrThrow(await unwrap(api.applyTemplate(groupId, choice))),
    onSuccess: (view: unknown) => {
      applyCacheEffects(client, cacheEffectsOf({ type: "settingsReplaced", groupId, view }));
    },
    onError: (error: unknown) => {
      refused(client, groupId, error);
    },
  };
}

export function saveTemplateMutation(api: SacouApi, client: QueryClient, groupId: string) {
  return {
    mutationFn: (name: string) => unwrap(api.saveTemplate(groupId, name)),
    onSuccess: () => {
      applyCacheEffects(client, cacheEffectsOf({ type: "templatesChanged", groupId }));
    },
    onError: (error: unknown) => {
      refused(client, groupId, error);
    },
  };
}

export function deleteTemplateMutation(api: SacouApi, client: QueryClient, groupId: string) {
  return {
    mutationFn: (templateId: string) => unwrap(api.deleteTemplate(groupId, templateId)),
    onSuccess: () => {
      applyCacheEffects(client, cacheEffectsOf({ type: "templatesChanged", groupId }));
    },
    onError: (error: unknown) => {
      refused(client, groupId, error);
    },
  };
}

export interface CreateGroupInput {
  readonly name: string;
  readonly templateKey: SettingsTemplateKey;
  /** The leaves that differ from the template; `null` when there is nothing to save. */
  readonly patch: SettingsLayer | null;
}

export type CreateGroupOutcome =
  | { readonly kind: "done"; readonly groupId: string }
  | { readonly kind: "created-without-settings"; readonly groupId: string };

/** The second step alone: the group exists already, and "Tentar de novo" repeats only this one. */
export async function saveCreatedGroupSettings(
  api: SacouApi,
  client: QueryClient,
  groupId: string,
  patch: SettingsLayer,
): Promise<void> {
  const view = viewOrThrow(await unwrap(api.updateGroupSettings(groupId, patch)));
  applyCacheEffects(client, cacheEffectsOf({ type: "settingsReplaced", groupId, view }));
}

/**
 * The two calls of "Criar grupo": POST and then PATCH. If the PATCH fails the group is there anyway, so
 * the outcome says so and the screen offers to repeat only the PATCH (D3). A failure of the POST throws.
 */
export async function createGroupFlow(
  api: SacouApi,
  client: QueryClient,
  input: CreateGroupInput,
): Promise<CreateGroupOutcome> {
  const created = await unwrap(api.createGroup(input.name, input.templateKey));
  applyCacheEffects(client, cacheEffectsOf({ type: "createGroup" }));
  if (input.patch === null) return { kind: "done", groupId: created.groupId };
  try {
    await saveCreatedGroupSettings(api, client, created.groupId, input.patch);
    return { kind: "done", groupId: created.groupId };
  } catch {
    return { kind: "created-without-settings", groupId: created.groupId };
  }
}
