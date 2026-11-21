import type { Scheduler } from "../../court/ports/scheduler";
import type { SacouApi } from "../../../services/api/sacou-api";
import type { SessionIdentity } from "../../../services/auth/auth-session";
import type { InstallationIdStore } from "../ports/installation-id-store";
import type { NotificationPermission } from "../ports/notification-permission";
import type { PushToken, PushTokenSource } from "../ports/push-token-source";

/** The exit of the account waits at most this long for the server (E3.11, Part 3, item 4). */
export const DEREGISTER_TIMEOUT_MS = 2_000;

export type PushSyncOutcome =
  "registered" | "no-session" | "no-permission" | "no-token" | "closing" | "failed";

export interface PushRegistrationDeps {
  readonly api: Pick<SacouApi, "registerPushDevice" | "removePushDevice">;
  readonly permission: Pick<NotificationPermission, "status">;
  readonly tokens: PushTokenSource;
  readonly installationIds: InstallationIdStore;
  readonly session: { currentSession(): SessionIdentity | null };
  readonly scheduler: Scheduler;
  readonly timeoutMs?: number;
}

/** The registration of this phone for pushes while signed in (E3.11). */
export interface PushRegistration {
  /**
   * With a session and the permission given, one `PUT` of this install; nothing otherwise. A failure is
   * silent and never tried again in a loop: the next opening or the next token change tries again.
   */
  sync(): Promise<PushSyncOutcome>;
  /** Listens to the token changes of the system; the returned function stops listening. */
  start(): () => void;
}

/** The step of the exit of the account that comes before the SDK (ADR 0057, D4, changed by E3.11). */
export interface PushDeviceDeregistrar {
  /** The server first, for at most 2 s and never blocking the exit; then this phone. */
  deregister(): Promise<void>;
  /** Only this phone: the server already forgot the account (screen 30b) or the session fell elsewhere. */
  forgetLocally(): Promise<void>;
}

export type PushDevices = PushRegistration & PushDeviceDeregistrar;

/**
 * The register and the exit share one state: a registration on the way when the exit begins is waited
 * for, so it can never land after the `DELETE` and put the old account back on the phone. The token is
 * never logged nor kept here: it goes from the system straight into the body of the `PUT`.
 */
export function createPushDevices(deps: PushRegistrationDeps): PushDevices {
  const timeoutMs = deps.timeoutMs ?? DEREGISTER_TIMEOUT_MS;
  const inFlight: { current: readonly Promise<PushSyncOutcome>[] } = { current: [] };
  const closed: { current: SessionIdentity | null } = { current: null };

  function isClosing(session: SessionIdentity): boolean {
    return closed.current === session;
  }

  async function send(session: SessionIdentity, token: PushToken | null): Promise<PushSyncOutcome> {
    if ((await deps.permission.status()) !== "granted") return "no-permission";
    const pushToken = token ?? (await deps.tokens.getToken());
    if (pushToken === null) return "no-token";
    const installationId = await deps.installationIds.readOrCreate();
    // The session may have ended or changed while the system answered.
    if (deps.session.currentSession() !== session) return "no-session";
    if (isClosing(session)) return "closing";
    const result = await deps.api.registerPushDevice({
      installationId,
      token: pushToken.token,
      platform: pushToken.platform,
    });
    return result.ok ? "registered" : "failed";
  }

  function register(token: PushToken | null): Promise<PushSyncOutcome> {
    const session = deps.session.currentSession();
    if (session === null) return Promise.resolve("no-session");
    if (isClosing(session)) return Promise.resolve("closing");
    const running = send(session, token).catch((): PushSyncOutcome => "failed");
    inFlight.current = [...inFlight.current, running];
    void running.finally(() => {
      inFlight.current = inFlight.current.filter((other) => other !== running);
    });
    return running;
  }

  async function removeOnServer(): Promise<void> {
    await Promise.all(inFlight.current);
    const installationId = await deps.installationIds.read();
    if (installationId !== null) await deps.api.removePushDevice({ installationId });
  }

  /** Resolves when the work ends or the time runs out, whichever first; never rejects. */
  function bounded(work: Promise<void>): Promise<void> {
    return new Promise((resolve) => {
      const cancel = deps.scheduler.after(timeoutMs, resolve);
      work
        .catch(() => undefined)
        .finally(() => {
          cancel();
          resolve();
        });
    });
  }

  async function forgetLocally(): Promise<void> {
    try {
      await deps.tokens.unregister();
    } catch {
      // A phone that cannot unregister still signs out; the server drops the token on DeviceNotRegistered.
    }
  }

  return {
    sync: () => register(null),
    start: () =>
      deps.tokens.onTokenChange((token) => {
        void register(token);
      }),
    async deregister() {
      closed.current = deps.session.currentSession();
      await bounded(removeOnServer());
      await forgetLocally();
    },
    forgetLocally,
  };
}
