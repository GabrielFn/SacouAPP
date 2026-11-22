import {
  applyTemplate,
  defaultGroupSettings,
  getSettingsTemplate,
  type GroupSettings,
  type SettingsLayer,
} from "@sacou/match-engine";
import { MutationObserver, type QueryClient } from "@tanstack/react-query";
import { describe, expect, test } from "vitest";

import { createFakeSacouApi, type FakeSacouApi } from "../../../adapters/fake-sacou-api";
import { apiErrorOf } from "../../../services/api/api-error";
import { apiErr, apiOk } from "../../../services/api/api-result";
import type { ApiError } from "../../../services/api/api-error";
import type { GroupSettingsDocument } from "../../../services/api/sacou-api";
import { createSacouQueryClient } from "../../../services/query/query-client";
import { queryKeys } from "../../../services/query/query-keys";
import type { GroupSettingsView } from "../model/settings-document";
import {
  applyTemplateMutation,
  createGroupFlow,
  deleteTemplateMutation,
  saveTemplateMutation,
  settingsScope,
  updateSettingsMutation,
} from "./group-settings-mutations";
import { groupSettingsQuery, groupTemplatesQuery } from "./group-settings-queries";

const GROUP = "8a4c2f0e-1111-4c3b-9d2e-000000000001";
const MEMBER = "8a4c2f0e-2222-4c3b-9d2e-000000000002";
const racha = applyTemplate(defaultGroupSettings(), getSettingsTemplate("racha-organizado"));

function document(
  settings: GroupSettings,
  templateKey: string | null = "racha-organizado",
): GroupSettingsDocument {
  return {
    schemaVersion: 1,
    settings,
    templateKey,
    savedTemplateId: null,
    updatedAt: "2026-11-10",
  };
}

const problem = (status: number, code: string): ApiError =>
  ({ kind: "problem", status, code }) as ApiError;

function setup(): { client: QueryClient; fake: FakeSacouApi } {
  return { client: createSacouQueryClient(), fake: createFakeSacouApi() };
}

function mutate<V, T>(
  client: QueryClient,
  options: { mutationFn: (variables: V) => Promise<T> } & Record<string, unknown>,
  variables: V,
): Promise<T> {
  return new MutationObserver<T, Error, V>(client, options).mutate(variables);
}

const layer = (pointsPerSet: number): SettingsLayer => ({
  schemaVersion: 1,
  scoring: { pointsPerSet },
});

describe("the settings query", () => {
  test("a document that passes the parser is kept as a view", async () => {
    const { client, fake } = setup();
    fake.respond("getGroupSettings", apiOk(document(racha)));
    const view = await client.query(groupSettingsQuery(fake.api, GROUP));
    expect(view.settings).toEqual(racha);
    expect(view.templateKey).toBe("racha-organizado");
    expect(client.getQueryData(queryKeys.settings(GROUP))).toEqual(view);
  });

  test("a document the parser refuses is an unexpected answer and nothing is kept", async () => {
    const { client, fake } = setup();
    fake.respond("getGroupSettings", apiOk({ ...document(racha), settings: { schemaVersion: 1 } }));
    const error: unknown = await client
      .query({ ...groupSettingsQuery(fake.api, GROUP), retry: false })
      .catch((thrown: unknown) => thrown);
    expect(apiErrorOf(error)?.kind).toBe("unexpected");
    expect(client.getQueryData(queryKeys.settings(GROUP))).toBeUndefined();
  });

  test("the templates query can be off for who cannot manage the settings", () => {
    const { fake } = setup();
    expect(groupTemplatesQuery(fake.api, GROUP, false).enabled).toBe(false);
    expect(groupTemplatesQuery(fake.api, GROUP, true).enabled).toBe(true);
  });
});

describe("saving a change", () => {
  test("the answer of the PATCH replaces the cache", async () => {
    const { client, fake } = setup();
    const changed = { ...racha, scoring: { ...racha.scoring, pointsPerSet: 21 } };
    fake.respond("updateGroupSettings", apiOk(document(changed)));
    await mutate(client, updateSettingsMutation(fake.api, client, GROUP), layer(21));
    const view = client.getQueryData<GroupSettingsView>(queryKeys.settings(GROUP));
    expect(view?.settings.scoring.pointsPerSet).toBe(21);
    expect(fake.calls().map((call) => call.operation)).toEqual(["updateGroupSettings"]);
  });

  test("two changes run in order inside one scope and the second answer wins", async () => {
    const { client, fake } = setup();
    expect(updateSettingsMutation(fake.api, client, GROUP).scope).toEqual(settingsScope(GROUP));
    const answers = [21, 15].map((points) =>
      document({ ...racha, scoring: { ...racha.scoring, pointsPerSet: points } }),
    );
    const order: number[] = [];
    let call = 0;
    const api = {
      ...fake.api,
      updateGroupSettings: async (_groupId: string, sent: SettingsLayer) => {
        const index = call++;
        // The first answer is slower: without the scope it would arrive last and win.
        await new Promise((resolve) => setTimeout(resolve, index === 0 ? 20 : 1));
        order.push(sent.scoring?.pointsPerSet ?? 0);
        return apiOk(answers[index] ?? document(racha));
      },
    };
    const options = updateSettingsMutation(api, client, GROUP);
    await Promise.all([mutate(client, options, layer(21)), mutate(client, options, layer(15))]);
    expect(order).toEqual([21, 15]);
    const view = client.getQueryData<GroupSettingsView>(queryKeys.settings(GROUP));
    expect(view?.settings.scoring.pointsPerSet).toBe(15);
  });

  test("a 403 makes the group and the settings stale", async () => {
    const { client, fake } = setup();
    client.setQueryData(queryKeys.group(GROUP), { role: "admin" });
    client.setQueryData(queryKeys.settings(GROUP), { settings: racha });
    fake.respond("updateGroupSettings", apiErr(problem(403, "groups.forbidden")));
    await mutate(client, updateSettingsMutation(fake.api, client, GROUP), layer(21)).catch(
      () => undefined,
    );
    expect(client.getQueryState(queryKeys.group(GROUP))?.isInvalidated).toBe(true);
    expect(client.getQueryState(queryKeys.settings(GROUP))?.isInvalidated).toBe(true);
  });

  test("a refusal of the server is thrown with its code", async () => {
    const { client, fake } = setup();
    fake.respond("updateGroupSettings", apiErr(problem(400, "groups.settings-invalid")));
    const error: unknown = await mutate(
      client,
      updateSettingsMutation(fake.api, client, GROUP),
      layer(21),
    ).catch((thrown: unknown) => thrown);
    expect(apiErrorOf(error)).toEqual(problem(400, "groups.settings-invalid"));
  });

  test("a document the parser refuses is not written to the cache", async () => {
    const { client, fake } = setup();
    fake.respond("updateGroupSettings", apiOk({ ...document(racha), settings: {} }));
    const error: unknown = await mutate(
      client,
      updateSettingsMutation(fake.api, client, GROUP),
      layer(21),
    ).catch((thrown: unknown) => thrown);
    expect(apiErrorOf(error)?.kind).toBe("unexpected");
    expect(client.getQueryData(queryKeys.settings(GROUP))).toBeUndefined();
  });
});

describe("templates", () => {
  test("applying one replaces the cache and sends the right choice", async () => {
    const { client, fake } = setup();
    const treino = applyTemplate(racha, getSettingsTemplate("treino"));
    fake.respond("applyTemplate", apiOk(document(treino, "treino")));
    await mutate(client, applyTemplateMutation(fake.api, client, GROUP), {
      kind: "ready",
      key: "treino",
    } as const);
    const view = client.getQueryData<GroupSettingsView>(queryKeys.settings(GROUP));
    expect(view?.templateKey).toBe("treino");
    expect(view?.settings.attendance.capacity).toBe(racha.attendance.capacity);
    expect(fake.calls()[0]?.args).toEqual([GROUP, { kind: "ready", key: "treino" }]);
  });

  test("saving and deleting make the list stale", async () => {
    const { client, fake } = setup();
    client.setQueryData(queryKeys.templates(GROUP), []);
    fake.respond("saveTemplate", apiOk({ templateId: "t", name: "Meu racha", createdAt: "x" }));
    await mutate(client, saveTemplateMutation(fake.api, client, GROUP), "Meu racha");
    expect(client.getQueryState(queryKeys.templates(GROUP))?.isInvalidated).toBe(true);
    client.setQueryData(queryKeys.templates(GROUP), []);
    fake.respond("deleteTemplate", apiOk(null));
    await mutate(client, deleteTemplateMutation(fake.api, client, GROUP), "t");
    expect(client.getQueryState(queryKeys.templates(GROUP))?.isInvalidated).toBe(true);
  });

  test("a 409 template-limit refreshes the list and is not repeated", async () => {
    const { client, fake } = setup();
    client.setQueryData(queryKeys.templates(GROUP), []);
    fake.respond("saveTemplate", apiErr(problem(409, "groups.template-limit")));
    const error: unknown = await mutate(
      client,
      saveTemplateMutation(fake.api, client, GROUP),
      "Outro",
    ).catch((thrown: unknown) => thrown);
    expect(apiErrorOf(error)).toEqual(problem(409, "groups.template-limit"));
    expect(client.getQueryState(queryKeys.templates(GROUP))?.isInvalidated).toBe(true);
    expect(fake.calls()).toHaveLength(1);
  });
});

describe("creating a group", () => {
  const input = {
    name: "Racha de terça",
    templateKey: "racha-organizado",
    patch: layer(21),
  } as const;

  test("one POST carries the template and the rules, and the list of groups is stale", async () => {
    const { client, fake } = setup();
    client.setQueryData(queryKeys.groups(), []);
    fake.respond("createGroup", apiOk({ groupId: GROUP, memberId: MEMBER }));
    expect(await createGroupFlow(fake.api, client, input)).toBe(GROUP);
    expect(fake.calls().map((call) => call.operation)).toEqual(["createGroup"]);
    expect(fake.calls()[0]?.args).toEqual(["Racha de terça", "racha-organizado", layer(21)]);
    expect(client.getQueryState(queryKeys.groups())?.isInvalidated).toBe(true);
  });

  test("with nothing to save the call carries no rules", async () => {
    const { client, fake } = setup();
    fake.respond("createGroup", apiOk({ groupId: GROUP, memberId: MEMBER }));
    await createGroupFlow(fake.api, client, { ...input, patch: null });
    expect(fake.calls()).toHaveLength(1);
    expect(fake.calls()[0]?.args).toEqual(["Racha de terça", "racha-organizado", null]);
  });

  test("a refusal of the rules throws and the screen can send the same form again", async () => {
    const { client, fake } = setup();
    fake.respond("createGroup", apiErr(problem(400, "groups.settings-invalid")));
    const error: unknown = await createGroupFlow(fake.api, client, input).catch(
      (thrown: unknown) => thrown,
    );
    expect(apiErrorOf(error)).toEqual(problem(400, "groups.settings-invalid"));
    expect(fake.calls()).toHaveLength(1);
  });

  test("a 409 membership-limit throws its code and calls nothing else", async () => {
    const { client, fake } = setup();
    fake.respond("createGroup", apiErr(problem(409, "groups.membership-limit")));
    const error: unknown = await createGroupFlow(fake.api, client, input).catch(
      (thrown: unknown) => thrown,
    );
    expect(apiErrorOf(error)).toEqual(problem(409, "groups.membership-limit"));
    expect(fake.calls().map((call) => call.operation)).toEqual(["createGroup"]);
  });

  test("offline creates nothing and repeats nothing", async () => {
    const { client, fake } = setup();
    fake.respond("createGroup", apiErr({ kind: "offline" }));
    const error: unknown = await createGroupFlow(fake.api, client, input).catch(
      (thrown: unknown) => thrown,
    );
    expect(apiErrorOf(error)).toEqual({ kind: "offline" });
    expect(fake.calls()).toHaveLength(1);
  });
});
