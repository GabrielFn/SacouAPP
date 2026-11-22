import type { Scheduler } from "../../../services/scheduler/scheduler";
import type { SacouApi } from "../../../services/api/sacou-api";
import type { SessionIdentity } from "../../../services/auth/auth-session";
import type { PushDeviceDeregistrar } from "../../../services/session/push-device-deregistrar";
import type { InstallationIdStore } from "../ports/installation-id-store";
import type { NotificationPermission } from "../ports/notification-permission";
import type { PushToken, PushTokenSource } from "../ports/push-token-source";

/** The exit of the account waits at most this long for the server (E3.11, Part 3, item 4). */
export const DEREGISTER_TIMEOUT_MS = 2_000;

export type PushSyncOutcome =
  | "registered"
  | "already-registered"
  | "no-session"
  | "no-permission"
  | "no-token"
  | "closing"
  | "failed";

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
  /**
   * Listens to the token changes of the system; the returned function stops listening. A change to the
   * token this session already registered (or is registering) for this install sends nothing.
   */
  start(): () => void;
}

export type PushDevices = PushRegistration & PushDeviceDeregistrar;

/**
 * The register and the exit share one state: no registration starts once the exit began, and one on the
 * way is followed by a second removal when it lands inside the 2 s, so it cannot put the old account
 * back on the phone. The token is never logged nor persisted: it goes from the system straight into
 * the body of the `PUT`, and the last one sent stays only in memory, to skip a repeated change.
 */
interface SentDevice {
  readonly session: SessionIdentity;
  readonly installationId: string;
  readonly token: string;
}

function sameDevice(a: SentDevice | null, b: SentDevice): boolean {
  return (
    a !== null &&
    a.session === b.session &&
    a.installationId === b.installationId &&
    a.token === b.token
  );
}

export function createPushDevices(deps: PushRegistrationDeps): PushDevices {
  const timeoutMs = deps.timeoutMs ?? DEREGISTER_TIMEOUT_MS;
  const inFlight: { current: readonly Promise<PushSyncOutcome>[] } = { current: [] };
  const closed: { current: SessionIdentity | null } = { current: null };
  /** The device of the last `PUT` that succeeded or is on the way; `null` after a failure. */
  const sent: { current: SentDevice | null } = { current: null };

  function isClosing(session: SessionIdentity): boolean {
    return closed.current === session;
  }

  async function send(
    session: SessionIdentity,
    token: PushToken | null,
    skipRepeated: boolean,
  ): Promise<PushSyncOutcome> {
    if ((await deps.permission.status()) !== "granted") return "no-permission";
    const pushToken = token ?? (await deps.tokens.getToken());
    if (pushToken === null) return "no-token";
    const installationId = await deps.installationIds.readOrCreate();
    // The session may have ended or changed while the system answered.
    if (deps.session.currentSession() !== session) return "no-session";
    if (isClosing(session)) return "closing";
    const device: SentDevice = { session, installationId, token: pushToken.token };
    if (skipRepeated && sameDevice(sent.current, device)) return "already-registered";
    sent.current = device;
    const result = await deps.api
      .registerPushDevice({ installationId, token: pushToken.token, platform: pushToken.platform })
      .catch(() => null);
    if (result?.ok === true) return "registered";
    if (sent.current === device) sent.current = null;
    return "failed";
  }

  function register(token: PushToken | null, skipRepeated: boolean): Promise<PushSyncOutcome> {
    const session = deps.session.currentSession();
    if (session === null) return Promise.resolve("no-session");
    if (isClosing(session)) return Promise.resolve("closing");
    const running = send(session, token, skipRepeated).catch((): PushSyncOutcome => "failed");
    inFlight.current = [...inFlight.current, running];
    void running.finally(() => {
      inFlight.current = inFlight.current.filter((other) => other !== running);
    });
    return running;
  }

  /**
   * The removal leaves at once, so it always goes out inside the 2 s while the session still signs it.
   * A registration still on the way is then waited for and, if it landed, followed by one more removal
   * (204 again): on the server the last write wins, so the phone ends without the account either way.
   * That second removal is skipped once the 2 s are over: by then the sign-out may have run and another
   * account may sign it, which would take the phone away from that new account.
   */
  async function removeOnServer(timedOut: () => boolean): Promise<void> {
    const pending = inFlight.current;
    const installationId = await deps.installationIds.read();
    if (installationId === null) return;
    const remove = () => deps.api.removePushDevice({ installationId });
    const first = remove();
    if (pending.length === 0) {
      await first;
      return;
    }
    const outcomes = await Promise.all(pending);
    await first;
    if (outcomes.includes("registered") && !timedOut()) await remove();
  }

  /** Resolves when the work ends or the time runs out, whichever first; never rejects. */
  function bounded(work: (timedOut: () => boolean) => Promise<void>): Promise<void> {
    return new Promise((resolve) => {
      const expired = { value: false };
      const cancel = deps.scheduler.after(timeoutMs, () => {
        expired.value = true;
        resolve();
      });
      work(() => expired.value)
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
    sync: () => register(null, false),
    start: () =>
      deps.tokens.onTokenChange((token) => {
        void register(token, true);
      }),
    async deregister() {
      closed.current = deps.session.currentSession();
      sent.current = null;
      await bounded(removeOnServer);
      await forgetLocally();
    },
    forgetLocally,
  };
}
