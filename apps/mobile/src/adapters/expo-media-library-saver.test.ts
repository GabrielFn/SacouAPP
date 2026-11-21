import { beforeEach, describe, expect, it, vi } from "vitest";

import { expoMediaLibrarySaver } from "./expo-media-library-saver";

const mocks = vi.hoisted(() => ({
  requestPermissionsAsync: vi.fn<(writeOnly: boolean) => Promise<{ granted: boolean }>>(),
  create: vi.fn<(uri: string) => Promise<object>>(),
  openSettings: vi.fn<() => Promise<void>>(),
}));
const { requestPermissionsAsync, create, openSettings } = mocks;

vi.mock("expo-media-library", () => ({
  requestPermissionsAsync: mocks.requestPermissionsAsync,
  Asset: { create: mocks.create },
}));
vi.mock("react-native", () => ({ Linking: { openSettings: mocks.openSettings } }));

describe("expoMediaLibrarySaver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    openSettings.mockResolvedValue(undefined);
  });

  it("asks for write-only access, never to read the gallery", async () => {
    requestPermissionsAsync.mockResolvedValue({ granted: true });
    create.mockResolvedValue({});
    const result = await expoMediaLibrarySaver.save("file:///card.png");
    expect(requestPermissionsAsync).toHaveBeenCalledWith(true);
    expect(create).toHaveBeenCalledWith("file:///card.png");
    expect(result.ok).toBe(true);
  });

  it("refused permission saves nothing", async () => {
    requestPermissionsAsync.mockResolvedValue({ granted: false });
    const result = await expoMediaLibrarySaver.save("file:///card.png");
    expect(create).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, error: "permission-denied" });
  });

  it("a failure returns the kind only, not the path", async () => {
    requestPermissionsAsync.mockResolvedValue({ granted: true });
    create.mockRejectedValue(new Error("boom file:///secret/path.png"));
    const result = await expoMediaLibrarySaver.save("file:///card.png");
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(result).toEqual({ ok: false, error: "save-failed" });
  });

  it("opens the system settings", async () => {
    await expoMediaLibrarySaver.openSettings();
    expect(openSettings).toHaveBeenCalledOnce();
  });
});
