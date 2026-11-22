import { beforeEach, describe, expect, test, vi } from "vitest";

import { KNOWN_DEV_WARNINGS, quietKnownDevWarnings } from "./react-native-dev-warnings";

const ignoreLogs = vi.hoisted(() => vi.fn());
vi.mock("react-native", () => ({ LogBox: { ignoreLogs } }));

describe("the known warnings of development (R98, item 7)", () => {
  beforeEach(() => {
    ignoreLogs.mockClear();
  });

  test("in development only the linking warning is quieted", () => {
    quietKnownDevWarnings(true);
    expect(ignoreLogs).toHaveBeenCalledWith([...KNOWN_DEV_WARNINGS]);
    expect(KNOWN_DEV_WARNINGS).toEqual([
      "Looks like you have configured linking in multiple places",
    ]);
  });

  test("a release build quiets nothing", () => {
    quietKnownDevWarnings(false);
    expect(ignoreLogs).not.toHaveBeenCalled();
  });
});
