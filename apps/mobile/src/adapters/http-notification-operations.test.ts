import { describe, expect, test } from "vitest";

import {
  notification,
  notificationList,
} from "../features/notifications/model/notification.test.fixture";
import { jsonAnswer } from "./fake-http-transport";
import { BASE, only, problem, setup } from "./http-sacou-api.test-support";

const NOTIFICATION = "8a4c2f0e-3333-4c3b-9d2e-0000000000cc";
const INSTALLATION = "8a4c2f0e-4444-4c3b-9d2e-0000000000ee";
const TOKEN = "ExponentPushToken[contract-test]";

const noContent = () => new Response(null, { status: 204 });

describe("the notifications over HTTP (E3.11)", () => {
  test("lists with a GET and the token of the account", async () => {
    const { api, http } = setup();
    const list = notificationList([notification()]);
    http.enqueue(jsonAnswer(200, list));
    expect(await api.listNotifications()).toEqual({ ok: true, value: list });
    const request = only(http);
    expect(request.method).toBe("GET");
    expect(request.url).toBe(`${BASE}/v1/me/notifications`);
    expect(new Headers(request.headers).get("authorization")).toMatch(/^Bearer /);
  });

  test("marks one and all as read with a POST and no body", async () => {
    const { api, http } = setup();
    http.enqueue(noContent());
    http.enqueue(noContent());
    expect(await api.markNotificationRead(NOTIFICATION)).toEqual({ ok: true, value: null });
    expect(await api.markAllNotificationsRead()).toEqual({ ok: true, value: null });
    const [one, all] = http.requests();
    expect([one?.method, one?.url]).toEqual([
      "POST",
      `${BASE}/v1/me/notifications/${NOTIFICATION}/read`,
    ]);
    expect([all?.method, all?.url]).toEqual(["POST", `${BASE}/v1/me/notifications/read-all`]);
  });

  test("a 404 of a notification of someone else is a problem", async () => {
    const { api, http } = setup();
    http.enqueue(problem(404, "notifications.notification-not-found"));
    expect(await api.markNotificationRead(NOTIFICATION)).toMatchObject({
      ok: false,
      error: { status: 404 },
    });
  });
});

describe("the push device over HTTP (E3.11)", () => {
  test("registers with a PUT: the token only in the body, never in the address", async () => {
    const { api, http } = setup();
    http.enqueue(noContent());
    const result = await api.registerPushDevice({
      installationId: INSTALLATION,
      token: TOKEN,
      platform: "android",
    });
    expect(result).toEqual({ ok: true, value: null });
    const request = only(http);
    expect(request.method).toBe("PUT");
    expect(request.url).toBe(`${BASE}/v1/me/push-devices`);
    expect(request.url).not.toContain("ExponentPushToken");
    expect(request.url).not.toContain(INSTALLATION);
    expect(JSON.parse(request.body ?? "{}")).toEqual({
      installationId: INSTALLATION,
      token: TOKEN,
      platform: "android",
    });
  });

  test("removes with a POST of the install in the body", async () => {
    const { api, http } = setup();
    http.enqueue(noContent());
    expect(await api.removePushDevice({ installationId: INSTALLATION })).toEqual({
      ok: true,
      value: null,
    });
    const request = only(http);
    expect([request.method, request.url]).toEqual(["POST", `${BASE}/v1/me/push-devices/remove`]);
    expect(JSON.parse(request.body ?? "{}")).toEqual({ installationId: INSTALLATION });
  });
});
