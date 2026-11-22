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

function replacedWith(client: QueryClient, groupId: string) {
  return (view: unknown) => {
    applyCacheEffects(client, cacheEffectsOf({ type: "settingsReplaced", groupId, view }));
  };
}

function templatesChangedFor(client: QueryClient, groupId: string) {
  return () => {
    applyCacheEffects(client, cacheEffectsOf({ type: "templatesChanged", groupId }));
  };
}

function refusedBy(client: QueryClient, groupId: string) {
  return (error: unknown) => {
    refused(client, groupId, error);
  };
}

/** The answer of a write is the whole merged document: it replaces the cache (D4). */
export function updateSettingsMutation(api: SacouApi, client: QueryClient, groupId: string) {
  return {
    scope: settingsScope(groupId),
    mutationFn: async (layer: SettingsLayer) =>
      viewOrThrow(await unwrap(api.updateGroupSettings(groupId, layer))),
    onSuccess: replacedWith(client, groupId),
    onError: refusedBy(client, groupId),
  };
}

export function applyTemplateMutation(api: SacouApi, client: QueryClient, groupId: string) {
  return {
    scope: settingsScope(groupId),
    mutationFn: async (choice: TemplateChoice) =>
      viewOrThrow(await unwrap(api.applyTemplate(groupId, choice))),
    onSuccess: replacedWith(client, groupId),
    onError: refusedBy(client, groupId),
  };
}

export function saveTemplateMutation(api: SacouApi, client: QueryClient, groupId: string) {
  return {
    mutationFn: (name: string) => unwrap(api.saveTemplate(groupId, name)),
    onSuccess: templatesChangedFor(client, groupId),
    onError: refusedBy(client, groupId),
  };
}

export function deleteTemplateMutation(api: SacouApi, client: QueryClient, groupId: string) {
  return {
    mutationFn: (templateId: string) => unwrap(api.deleteTemplate(groupId, templateId)),
    onSuccess: templatesChangedFor(client, groupId),
    onError: refusedBy(client, groupId),
  };
}

export interface CreateGroupInput {
  readonly name: string;
  readonly templateKey: SettingsTemplateKey;
  /** The leaves that differ from the template; `null` when there is nothing to save. */
  readonly patch: SettingsLayer | null;
}

/**
 * The one call of "Criar grupo": the name, the template and the rules go together and the server saves
 * them in a single transaction, so a refusal creates nothing and the screen can simply try again.
 */
export async function createGroupFlow(
  api: SacouApi,
  client: QueryClient,
  input: CreateGroupInput,
): Promise<string> {
  const created = await unwrap(api.createGroup(input.name, input.templateKey, input.patch));
  applyCacheEffects(client, cacheEffectsOf({ type: "createGroup" }));
  return created.groupId;
}
