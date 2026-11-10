import {
  parseGroupSettings,
  SETTINGS_TEMPLATE_KEYS,
  type SettingsTemplateKey,
} from "@sacou/match-engine";
import { describe, expect, test } from "vitest";

import {
  createGroupReducer,
  createInitialState,
  type CreateGroupAction,
  type CreateGroupState,
} from "./create-group.reducer";
import {
  canSubmit,
  createGroupDraft,
  createGroupErrors,
  createGroupPatch,
  hasPatch,
  normalizeText,
} from "./create-group.selectors";

const RACHA: SettingsTemplateKey = "racha-organizado";

function typed(key: SettingsTemplateKey, ...actions: readonly CreateGroupAction[]) {
  return actions.reduce(createGroupReducer, createInitialState(key));
}

/** The case of the canvas: Racha de terça, terça 20h30, Ginásio Sesc, 14 vagas, R$ 10 e R$ 35. */
function canvas(): CreateGroupState {
  return typed(
    RACHA,
    { type: "name-changed", name: "Racha de terça" },
    { type: "schedule-opened", draft: { weekday: 2, time: "20:30" } },
    { type: "schedule-confirmed" },
    { type: "venue-changed", venue: "Ginásio Sesc" },
    { type: "capacity-changed", text: "14" },
    { type: "fee-changed", fee: "dropIn", text: "R$ 10" },
    { type: "fee-changed", fee: "monthly", text: "R$ 35" },
  );
}

describe("the reducer of screen 05", () => {
  test("init takes the answers of each template", () => {
    const racha = createInitialState("racha-organizado");
    expect(racha).toMatchObject({ regulars: true, charges: true, capacityText: "12" });
    const pelada = createInitialState("pelada");
    expect(pelada).toMatchObject({ regulars: false, charges: false, capacityText: "" });
    expect(createInitialState("areia-rei-da-quadra").modality).toBe("beach-2x2");
    expect(createInitialState("do-zero")).toMatchObject({
      regulars: false,
      charges: false,
      capacityText: "",
      modality: "indoor-6x6",
    });
    expect(createGroupReducer(racha, { type: "init", templateKey: "pelada" })).toEqual(pelada);
  });

  test("each action changes only its field", () => {
    const start = createInitialState(RACHA);
    expect(createGroupReducer(start, { type: "name-changed", name: "A" })).toEqual({
      ...start,
      name: "A",
    });
    expect(createGroupReducer(start, { type: "venue-changed", venue: "V" })).toEqual({
      ...start,
      venue: "V",
    });
    expect(createGroupReducer(start, { type: "capacity-changed", text: "a1b4" })).toEqual({
      ...start,
      capacityText: "14",
    });
    expect(createGroupReducer(start, { type: "regulars-selected", value: false })).toEqual({
      ...start,
      regulars: false,
    });
    expect(createGroupReducer(start, { type: "charges-selected", value: false })).toEqual({
      ...start,
      charges: false,
    });
    expect(createGroupReducer(start, { type: "modality-selected", modality: "beach-4x4" })).toEqual(
      { ...start, modality: "beach-4x4" },
    );
    expect(createGroupReducer(start, { type: "fee-changed", fee: "monthly", text: "9" })).toEqual({
      ...start,
      monthlyFeeText: "9",
    });
  });

  test("cancelling the schedule sheet keeps the day that was stored", () => {
    const reopened = createGroupReducer(canvas(), {
      type: "schedule-opened",
      draft: { weekday: 5, time: "19:00" },
    });
    const cancelled = createGroupReducer(reopened, { type: "schedule-cancelled" });
    expect(cancelled.scheduleWeekday).toBe(2);
    expect(cancelled.scheduleTime).toBe("20:30");
    expect(cancelled.scheduleSheet).toBeNull();
  });

  test("the sheet draft is stored only when confirmed", () => {
    const opened = typed(RACHA, { type: "schedule-opened", draft: { weekday: 3, time: "21:00" } });
    expect(opened.scheduleWeekday).toBeNull();
    const confirmed = createGroupReducer(opened, { type: "schedule-confirmed" });
    expect(confirmed).toMatchObject({ scheduleWeekday: 3, scheduleTime: "21:00" });
  });

  test("confirming without a sheet changes nothing", () => {
    const start = createInitialState(RACHA);
    expect(createGroupReducer(start, { type: "schedule-confirmed" })).toBe(start);
  });

  test("the group created is remembered with its id", () => {
    const created = typed(RACHA, { type: "group-created", groupId: "g1" });
    expect(created.submit).toEqual({ kind: "created-without-settings", groupId: "g1" });
    const saved = createGroupReducer(created, { type: "settings-saved", groupId: "g1" });
    expect(saved.submit).toEqual({ kind: "done", groupId: "g1" });
  });
});

describe("createGroupDraft", () => {
  test("14 spots turn the limit on; no text turns it off and keeps the template capacity", () => {
    const limited = createGroupDraft(canvas(), RACHA);
    expect(limited.attendance).toMatchObject({ capacityLimited: true, capacity: 14 });
    const empty = typed(RACHA, { type: "capacity-changed", text: "" });
    const draft = createGroupDraft(empty, RACHA);
    const template = createGroupDraft(createInitialState(RACHA), RACHA);
    expect(draft.attendance.capacityLimited).toBe(false);
    expect(draft.attendance.capacity).toBe(template.attendance.capacity);
  });

  test("day and time turn the schedule on", () => {
    expect(createGroupDraft(canvas(), RACHA).schedule).toEqual({
      enabled: true,
      weekday: 2,
      startTime: "20:30",
      venue: "Ginásio Sesc",
    });
    expect(createGroupDraft(createInitialState(RACHA), RACHA).schedule.enabled).toBe(false);
  });

  test("money in cents, regulars and modality come from the answers", () => {
    const draft = createGroupDraft(canvas(), RACHA);
    expect(draft.money).toEqual({ enabled: true, dropInFeeCents: 1000, monthlyFeeCents: 3500 });
    expect(draft.attendance.regularsEnabled).toBe(true);
    expect(draft.format.modality).toBe("indoor-6x6");
  });

  test("the draft of every template and of the canvas passes the parser of the server", () => {
    SETTINGS_TEMPLATE_KEYS.forEach((key) => {
      expect(parseGroupSettings(createGroupDraft(createInitialState(key), key)).ok).toBe(true);
    });
    expect(parseGroupSettings(createGroupDraft(canvas(), RACHA)).ok).toBe(true);
  });

  test("the name and the venue are sent trimmed and in NFC", () => {
    expect(normalizeText("  Vôlei  ")).toBe("Vôlei");
    const state = typed(RACHA, { type: "venue-changed", venue: "  Ginásio " });
    expect(createGroupDraft(state, RACHA).schedule.venue).toBe("Ginásio");
  });
});

describe("createGroupErrors", () => {
  function withName(...actions: readonly CreateGroupAction[]): CreateGroupState {
    return typed(RACHA, { type: "name-changed", name: "Racha" }, ...actions);
  }

  test("a valid form has no error and can be submitted", () => {
    expect(createGroupErrors(canvas(), RACHA)).toEqual({});
    expect(canSubmit(canvas(), RACHA)).toBe(true);
  });

  test.each(["", "   ", "...", "Racha‮", "x".repeat(61)])("the name %j is refused", (name) => {
    const state = typed(RACHA, { type: "name-changed", name });
    expect(createGroupErrors(state, RACHA).name).toBeTypeOf("string");
    expect(canSubmit(state, RACHA)).toBe(false);
  });

  test.each(["1", "301"])("%s spots are out of the range of the engine", (text) => {
    const errors = createGroupErrors(withName({ type: "capacity-changed", text }), RACHA);
    expect(errors.capacity).toBe("Use um valor de 2 a 300.");
  });

  test("a venue of 81 characters or with a zero-width space is refused", () => {
    const long = withName({ type: "venue-changed", venue: "x".repeat(81) });
    expect(createGroupErrors(long, RACHA).venue).toBe("Use até 80 caracteres.");
    const hidden = withName({ type: "venue-changed", venue: "Gi​nasio" });
    expect(createGroupErrors(hidden, RACHA).venue).toBeTypeOf("string");
  });

  test("the time 24:00 is refused", () => {
    const state = withName(
      { type: "schedule-opened", draft: { weekday: 2, time: "24:00" } },
      { type: "schedule-confirmed" },
    );
    expect(createGroupErrors(state, RACHA).schedule).toBeTypeOf("string");
  });

  test("an amount that is not money is refused only while the group charges", () => {
    const bad = withName({ type: "fee-changed", fee: "dropIn", text: "abc" });
    expect(createGroupErrors(bad, RACHA).dropInFee).toBeTypeOf("string");
    const noCharge = createGroupReducer(bad, { type: "charges-selected", value: false });
    expect(createGroupErrors(noCharge, RACHA).dropInFee).toBeUndefined();
  });

  test("once submitted it cannot be submitted again", () => {
    const created = createGroupReducer(canvas(), { type: "group-created", groupId: "g" });
    expect(canSubmit(created, RACHA)).toBe(false);
  });
});

describe("createGroupPatch", () => {
  test("the canvas case carries only the leaves that differ from the template", () => {
    const patch = createGroupPatch(canvas(), RACHA);
    expect(patch).toEqual({
      schemaVersion: 1,
      attendance: { capacity: 14 },
      schedule: { enabled: true, startTime: "20:30", venue: "Ginásio Sesc" },
      money: { dropInFeeCents: 1000, monthlyFeeCents: 3500 },
    });
    expect(hasPatch(patch)).toBe(true);
  });

  test("answering nothing different gives an empty layer for every template", () => {
    SETTINGS_TEMPLATE_KEYS.forEach((key) => {
      expect(hasPatch(createGroupPatch(createInitialState(key), key))).toBe(false);
    });
  });

  test("Racha with no charge turns the money block off", () => {
    const patch = createGroupPatch(typed(RACHA, { type: "charges-selected", value: false }), RACHA);
    expect(patch).toEqual({ schemaVersion: 1, money: { enabled: false } });
  });
});
