import { describe, expect, test } from "vitest";

import { createFakeNotificationPermission } from "../../../adapters/fake-notification-permission";
import { createMemoryKeyValueStore } from "../../../adapters/memory-key-value-store";
import {
  createStoredPushPromptMemory,
  PUSH_PROMPT_KEY,
} from "../../../adapters/stored-push-prompt-memory";
import type { KeyValueStore } from "../../../services/query/key-value-store";
import type { PermissionAnswer } from "../ports/notification-permission";
import { askForPush, checkPushPrompt } from "./push-prompt";
import type { PushPromptAction } from "./push-prompt.reducer";

function setup(answer: PermissionAnswer, store: KeyValueStore = createMemoryKeyValueStore()) {
  const permission = createFakeNotificationPermission(answer);
  const memory = createStoredPushPromptMemory(store);
  const sent: PushPromptAction[] = [];
  const send = (action: PushPromptAction) => {
    sent.push(action);
  };
  const registered = { count: 0 };
  const register = () => {
    registered.count += 1;
  };
  return { permission, memory, sent, send, registered, register };
}

describe("R98 item 9: whether the offer is due", () => {
  test("a phone never offered and still askable: due, and marked at once", async () => {
    const store = createMemoryKeyValueStore();
    const harness = setup("askable", store);
    await checkPushPrompt(harness, harness.send);
    expect(harness.sent).toEqual([{ type: "checked", due: true }]);
    expect(store.entries().get(PUSH_PROMPT_KEY)).toBe("1");
  });

  test("offered before: never again, even with the permission still askable", async () => {
    const store = createMemoryKeyValueStore();
    await store.setItem(PUSH_PROMPT_KEY, "1");
    const harness = setup("askable", store);
    await checkPushPrompt(harness, harness.send);
    expect(harness.sent).toEqual([{ type: "checked", due: false }]);
  });

  test.each(["granted", "blocked"] as const)(
    "permission %s: nothing to ask, and the phone is not marked",
    async (answer) => {
      const store = createMemoryKeyValueStore();
      const harness = setup(answer, store);
      await checkPushPrompt(harness, harness.send);
      expect(harness.sent).toEqual([{ type: "checked", due: false }]);
      expect(store.entries().has(PUSH_PROMPT_KEY)).toBe(false);
    },
  );

  test("a store that cannot be read counts as offered: no question rather than two", async () => {
    const broken: KeyValueStore = {
      getItem: () => Promise.reject(new Error("sqlite")),
      setItem: () => Promise.reject(new Error("sqlite")),
      removeItem: () => Promise.resolve(),
    };
    const harness = setup("askable", broken);
    await checkPushPrompt(harness, harness.send);
    expect(harness.sent).toEqual([{ type: "checked", due: false }]);
  });
});

describe("R98 item 9: Ativar notificacoes", () => {
  test("given by the system: over, and the phone registers once", async () => {
    const harness = setup("askable");
    harness.permission.answerRequestWith("granted");
    await askForPush(harness, harness.send);
    expect(harness.permission.requests()).toBe(1);
    expect(harness.sent).toEqual([{ type: "answered" }]);
    expect(harness.registered.count).toBe(1);
  });

  test("refused by the system: over, nothing registers, and the refusal is kept", async () => {
    const store = createMemoryKeyValueStore();
    const harness = setup("askable", store);
    await checkPushPrompt(harness, harness.send);
    harness.permission.answerRequestWith("blocked");
    await askForPush(harness, harness.send);
    expect(harness.registered.count).toBe(0);
    const again = setup("askable", store);
    await checkPushPrompt(again, again.send);
    expect(again.sent).toEqual([{ type: "checked", due: false }]);
  });

  test("a system question that fails ends the offer without a loose rejection", async () => {
    const harness = setup("askable");
    const failing = {
      register: harness.register,
      permission: { request: () => Promise.reject(new Error("system")) },
    };
    await askForPush(failing, harness.send);
    expect(harness.sent).toEqual([{ type: "answered" }]);
    expect(harness.registered.count).toBe(0);
  });
});
