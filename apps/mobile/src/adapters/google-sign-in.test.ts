import { err, ok } from "@sacou/volley-rules";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { createAuthFailureReporter } from "./auth-failure-report";
import { createFakeErrorReporter, type FakeErrorReporter } from "./fake-error-reporter";
import { createGoogleAccountPicker } from "./google-sign-in";

const google = vi.hoisted(() => ({
  GoogleSignin: {
    configure: vi.fn(),
    hasPlayServices: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    revokeAccess: vi.fn(),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: "SIGN_IN_CANCELLED",
    IN_PROGRESS: "IN_PROGRESS",
    PLAY_SERVICES_NOT_AVAILABLE: "PLAY_SERVICES_NOT_AVAILABLE",
  },
}));
vi.mock("@react-native-google-signin/google-signin", () => google);

const ID_TOKEN = "google-id-token-Rt2";
const EMAIL = "ana@x.com";

function codeError(code: string | number): Error {
  return Object.assign(new Error(`failed for ${EMAIL}`), { code });
}

function pickerWith(errors: FakeErrorReporter) {
  return createGoogleAccountPicker("web-client", createAuthFailureReporter(errors));
}

const detailsOf = (errors: FakeErrorReporter) =>
  errors.captured().map(({ context }) => context?.details);

describe("the Google picker reports its unexpected stages (E5.2b)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    google.GoogleSignin.hasPlayServices.mockResolvedValue(true);
    google.GoogleSignin.signIn.mockResolvedValue({ type: "success", data: { idToken: ID_TOKEN } });
  });

  test("a chosen account gives its token and no event", async () => {
    const errors = createFakeErrorReporter();
    expect(await pickerWith(errors).pick()).toEqual(ok(ID_TOKEN));
    expect(errors.captured()).toEqual([]);
  });

  test("DEVELOPER_ERROR (code 10) of the picker is one event at `google-picker` (criterion 1)", async () => {
    google.GoogleSignin.signIn.mockRejectedValue(codeError("10"));
    const errors = createFakeErrorReporter();
    expect(await pickerWith(errors).pick()).toEqual(err("unexpected"));
    expect(detailsOf(errors)).toEqual([
      {
        "auth.stage": "google-picker",
        "auth.failure": "unexpected",
        "auth.code": "10",
        "auth.error_type": "Error",
      },
    ]);
    expect(errors.captured()[0]?.context?.area).toBe("auth");
  });

  test.each(["SIGN_IN_CANCELLED", "IN_PROGRESS"])(
    "%s is a cancel, with no event (criterion 2)",
    async (code) => {
      google.GoogleSignin.signIn.mockRejectedValue(codeError(code));
      const errors = createFakeErrorReporter();
      expect(await pickerWith(errors).pick()).toEqual(err("cancelled"));
      expect(errors.captured()).toEqual([]);
    },
  );

  test("a cancelled answer is a cancel, with no event (criterion 2)", async () => {
    google.GoogleSignin.signIn.mockResolvedValue({ type: "cancelled", data: null });
    const errors = createFakeErrorReporter();
    expect(await pickerWith(errors).pick()).toEqual(err("cancelled"));
    expect(errors.captured()).toEqual([]);
  });

  test("Play services missing is reported as `provider-unavailable` (criterion 3)", async () => {
    google.GoogleSignin.hasPlayServices.mockRejectedValue(codeError("PLAY_SERVICES_NOT_AVAILABLE"));
    const errors = createFakeErrorReporter();
    expect(await pickerWith(errors).pick()).toEqual(err("provider-unavailable"));
    expect(detailsOf(errors)[0]).toMatchObject({
      "auth.stage": "google-play-services",
      "auth.failure": "provider-unavailable",
    });
  });

  test("an unknown code of the Play services check is reported at its stage (criterion 4)", async () => {
    google.GoogleSignin.hasPlayServices.mockRejectedValue(codeError(12500));
    const errors = createFakeErrorReporter();
    expect(await pickerWith(errors).pick()).toEqual(err("unexpected"));
    expect(detailsOf(errors)[0]).toMatchObject({
      "auth.stage": "google-play-services",
      "auth.code": "12500",
    });
    expect(google.GoogleSignin.signIn).not.toHaveBeenCalled();
  });

  test("a success without an ID token is reported with the Google signals (criterion 5)", async () => {
    google.GoogleSignin.signIn.mockResolvedValue({ type: "success", data: { idToken: null } });
    const errors = createFakeErrorReporter();
    expect(await pickerWith(errors).pick()).toEqual(err("unexpected"));
    expect(detailsOf(errors)).toEqual([
      {
        "auth.stage": "google-response",
        "auth.failure": "unexpected",
        "auth.code": "none",
        "auth.error_type": "none",
        "auth.google.response_type": "success",
        "auth.google.has_id_token": "false",
      },
    ]);
  });

  test.each([
    [{ type: "success" }, "TypeError"],
    [{ type: "weird", data: { idToken: ID_TOKEN } }, "UnknownGoogleResponse"],
  ])("a malformed answer %o is reported as `other` (criterion 6)", async (answer, type) => {
    google.GoogleSignin.signIn.mockResolvedValue(answer);
    const errors = createFakeErrorReporter();
    expect(await pickerWith(errors).pick()).toEqual(err("unexpected"));
    expect(detailsOf(errors)).toEqual([
      expect.objectContaining({
        "auth.stage": "google-response",
        "auth.error_type": type,
        "auth.google.response_type": "other",
      }),
    ]);
  });
});
