import { describe, expect, it } from "vitest";

import {
  createFakeCardImageCapture,
  createFakeGallerySaver,
  createFakeImageShare,
} from "../../../adapters/fake-card-image";
import { strings } from "../../../strings/pt-BR";
import type { CaptureTarget } from "../ports/card-image";
import {
  cardShareReducer,
  initialCardShareState,
  type CardShareAction,
  type CardShareState,
} from "./card-share.reducer";
import { failureTextOf, noticeOf, offersSettings } from "./card-share.selectors";
import { runCardShare } from "./run-card-share";
import { cardAccessibilityLabel, type PlayerCardModel } from "./player-card";

function apply(actions: readonly CardShareAction[], from = initialCardShareState) {
  return actions.reduce<CardShareState>(cardShareReducer, from);
}

describe("card share reducer", () => {
  it("shares: idle, capturing, sharing, idle", () => {
    const capturing = apply([{ type: "share-requested" }]);
    expect(capturing).toEqual({ status: "capturing", intent: "share" });
    const sharing = apply([{ type: "captured" }], capturing);
    expect(sharing).toEqual({ status: "sharing" });
    expect(apply([{ type: "shared" }], sharing)).toEqual({ status: "idle" });
  });

  it("saves: idle, capturing, saving, saved", () => {
    const state = apply([{ type: "save-requested" }, { type: "captured" }, { type: "saved" }]);
    expect(state).toEqual({ status: "saved" });
    expect(noticeOf(state)).toBe(strings.profile.cardShare.saved);
  });

  it("keeps the reason of a failure and goes back to idle when dismissed", () => {
    for (const reason of ["capture-failed", "share-failed", "permission-denied"] as const) {
      const failed = apply([{ type: "share-requested" }, { type: "failed", reason }]);
      expect(failed).toEqual({ status: "failed", reason });
      expect(noticeOf(failed)).toBe(failureTextOf(reason));
      expect(apply([{ type: "dismissed" }], failed)).toEqual(initialCardShareState);
    }
  });

  it("offers the settings only after a refused permission", () => {
    const denied: CardShareState = { status: "failed", reason: "permission-denied" };
    expect(offersSettings(denied)).toBe(true);
    expect(offersSettings({ status: "failed", reason: "save-failed" })).toBe(false);
    expect(offersSettings(initialCardShareState)).toBe(false);
  });

  it("ignores a second request while busy", () => {
    const busyStates: readonly CardShareState[] = [
      { status: "capturing", intent: "share" },
      { status: "sharing" },
      { status: "saving" },
    ];
    for (const busy of busyStates) {
      expect(cardShareReducer(busy, { type: "share-requested" })).toBe(busy);
      expect(cardShareReducer(busy, { type: "save-requested" })).toBe(busy);
    }
  });

  it("ignores answers that arrive in the wrong state", () => {
    expect(cardShareReducer(initialCardShareState, { type: "shared" })).toBe(initialCardShareState);
    expect(cardShareReducer(initialCardShareState, { type: "saved" })).toBe(initialCardShareState);
    expect(cardShareReducer(initialCardShareState, { type: "captured" })).toBe(
      initialCardShareState,
    );
    expect(cardShareReducer(initialCardShareState, { type: "failed", reason: "save-failed" })).toBe(
      initialCardShareState,
    );
  });
});

const TARGET: CaptureTarget = { current: null };

function setup() {
  const capture = createFakeCardImageCapture();
  const imageShare = createFakeImageShare();
  const gallery = createFakeGallerySaver();
  const actions: CardShareAction[] = [];
  const run = (intent: "share" | "save") =>
    runCardShare(intent, TARGET, { capture, imageShare, gallery }, (action) => {
      actions.push(action);
    });
  return { capture, imageShare, gallery, actions, run };
}

describe("runCardShare", () => {
  it("shares the PNG and deletes it", async () => {
    const { capture, imageShare, actions, run } = setup();
    await run("share");
    expect(imageShare.shared()).toHaveLength(1);
    expect(capture.alive()).toEqual([]);
    expect(actions.map((a) => a.type)).toEqual(["captured", "shared"]);
  });

  it("saves the PNG and deletes it", async () => {
    const { capture, gallery, actions, run } = setup();
    await run("save");
    expect(gallery.saved()).toHaveLength(1);
    expect(capture.alive()).toEqual([]);
    expect(actions.map((a) => a.type)).toEqual(["captured", "saved"]);
  });

  it("deletes the PNG when sharing fails", async () => {
    const { capture, imageShare, actions, run } = setup();
    imageShare.fail("share-unavailable");
    await run("share");
    expect(capture.alive()).toEqual([]);
    expect(actions.at(-1)).toEqual({ type: "failed", reason: "share-unavailable" });
  });

  it("deletes the PNG and reports a refused permission", async () => {
    const { capture, gallery, actions, run } = setup();
    gallery.fail("permission-denied");
    await run("save");
    expect(capture.alive()).toEqual([]);
    expect(actions.at(-1)).toEqual({ type: "failed", reason: "permission-denied" });
  });

  it("reports a failed capture without sharing anything", async () => {
    const { capture, imageShare, actions, run } = setup();
    capture.fail("capture-failed");
    await run("share");
    expect(imageShare.shared()).toEqual([]);
    expect(actions).toEqual([{ type: "failed", reason: "capture-failed" }]);
  });
});

describe("card without statistics", () => {
  const model: PlayerCardModel = {
    nickname: "João",
    initials: "JO",
    positionLabel: "Ponteiro",
    otherPositionsLabel: null,
    showGlyph: true,
    seasonLabel: "Temporada 2026",
    stats: [{ key: "matches", value: "48", label: "partidas" }],
  };

  it("says no number to the screen reader when the switch is off", () => {
    expect(cardAccessibilityLabel(model, true)).toContain("48");
    expect(cardAccessibilityLabel(model, false)).not.toMatch(/\d/);
  });
});
