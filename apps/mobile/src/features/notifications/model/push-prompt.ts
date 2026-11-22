import type { NotificationPermission } from "../ports/notification-permission";
import type { PushPromptMemory } from "../ports/push-prompt-memory";
import type { PushPromptAction } from "./push-prompt.reducer";

export interface PushPromptCheckDeps {
  readonly permission: Pick<NotificationPermission, "status">;
  readonly memory: PushPromptMemory;
}

export interface PushPromptAskDeps {
  readonly permission: Pick<NotificationPermission, "request">;
  /** The registration of this phone, once the permission is given. */
  readonly register: () => void;
}

type Send = (action: PushPromptAction) => void;

/**
 * Due only on a phone never offered and still possible to ask: given, or refused for good, there is
 * nothing to ask. Due, it is marked at once, so a closed app never shows it a second time.
 */
export async function checkPushPrompt(deps: PushPromptCheckDeps, send: Send): Promise<void> {
  const offered = await deps.memory.wasOffered().catch(() => true);
  const due = !offered && (await deps.permission.status().catch(() => "blocked")) === "askable";
  if (due) await deps.memory.markOffered().catch(() => undefined);
  send({ type: "checked", due });
}

/** "Ativar notificações" of the sentence: the system question, and the registration when given. */
export async function askForPush(deps: PushPromptAskDeps, send: Send): Promise<void> {
  const answer = await deps.permission.request().catch(() => "askable");
  send({ type: "answered" });
  if (answer === "granted") deps.register();
}
