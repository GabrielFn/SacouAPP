import {
  parseGroupSettings,
  SETTINGS_TEMPLATE_KEYS,
  type SettingsTemplateKey,
} from "@sacou/match-engine";
import { describe, expect, test } from "vitest";

import { customBase, scratchOrigin, templateOrigin, type GroupOrigin } from "./custom-blocks";
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
  isRetryDisabled,
  isSubmitDisabled,
  normalizeText,
} from "./create-group.selectors";

const RACHA: GroupOrigin = templateOrigin("racha-organizado");

function typed(origin: GroupOrigin, ...actions: readonly CreateGroupAction[]) {
  return actions.reduce(createGroupReducer, createInitialState(origin));
}

function originOf(key: SettingsTemplateKey): GroupOrigin {
  return key === "do-zero" ? scratchOrigin([]) : templateOrigin(key);
}

/** The case of the canvas: Racha de terça, terça 20h30, Ginásio Sesc, 14 vagas. */
function canvas(): CreateGroupState {
  return typed(
    RACHA,
    { type: "name-changed", name: "Racha de terça" },
    { type: "schedule-opened", draft: { weekday: 2, time: "20:30" } },
    { type: "schedule-confirmed" },
    { type: "venue-changed", venue: "Ginásio Sesc" },
    { type: "capacity-changed", text: "14" },
  );
}

describe("the reducer of screen 05", () => {
  test("init takes the answers of each template", () => {
    const racha = createInitialState(RACHA);
    expect(racha).toMatchObject({ regulars: true, capacityText: "12" });
    const pelada = createInitialState(templateOrigin("pelada"));
    expect(pelada).toMatchObject({ regulars: false, capacityText: "" });
    expect(createInitialState(templateOrigin("areia-rei-da-quadra")).modality).toBe("beach-2x2");
    expect(createInitialState(scratchOrigin([]))).toMatchObject({
      regulars: false,
      capacityText: "",
      modality: "indoor-6x6",
    });
    const init = { type: "init", origin: templateOrigin("pelada") } as const;
    expect(createGroupReducer(racha, init)).toEqual(pelada);
  });

  test("the state has no money field", () => {
    const keys = Object.keys(createInitialState(RACHA));
    expect(keys.filter((key) => /fee|charge|money/i.test(key))).toEqual([]);
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
    expect(createGroupReducer(start, { type: "modality-selected", modality: "beach-4x4" })).toEqual(
      { ...start, modality: "beach-4x4" },
    );
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

  test("regulars and modality come from the answers; money stays as the template has it", () => {
    const draft = createGroupDraft(canvas(), RACHA);
    expect(draft.money).toEqual(createGroupDraft(createInitialState(RACHA), RACHA).money);
    expect(draft.attendance.regularsEnabled).toBe(true);
    expect(draft.format.modality).toBe("indoor-6x6");
  });

  test("the draft of every template and of the canvas passes the parser of the server", () => {
    SETTINGS_TEMPLATE_KEYS.forEach((key) => {
      const origin = originOf(key);
      expect(parseGroupSettings(createGroupDraft(createInitialState(origin), origin)).ok).toBe(
        true,
      );
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

  test("once submitted it cannot be submitted again", () => {
    const created = createGroupReducer(canvas(), { type: "group-created", groupId: "g" });
    expect(canSubmit(created, RACHA)).toBe(false);
  });

  test("'Criar grupo' is off for an invalid form or while a call is on the way", () => {
    const empty = typed(RACHA, { type: "name-changed", name: "" });
    expect(isSubmitDisabled(canvas(), RACHA, false)).toBe(false);
    expect(isSubmitDisabled(canvas(), RACHA, true)).toBe(true);
    expect(isSubmitDisabled(empty, RACHA, false)).toBe(true);
  });

  test("'Tentar de novo' is off while pending or when no group waits for its settings", () => {
    const created = createGroupReducer(canvas(), { type: "group-created", groupId: "g" });
    expect(isRetryDisabled(created, false)).toBe(false);
    expect(isRetryDisabled(created, true)).toBe(true);
    expect(isRetryDisabled(canvas(), false)).toBe(true);
  });
});

describe("createGroupPatch", () => {
  test("the canvas case carries only the leaves that differ from the template", () => {
    const patch = createGroupPatch(canvas(), RACHA);
    expect(patch).toEqual({
      schemaVersion: 1,
      attendance: { capacity: 14 },
      schedule: { enabled: true, startTime: "20:30", venue: "Ginásio Sesc" },
    });
    expect(hasPatch(patch)).toBe(true);
  });

  test("answering nothing different gives an empty layer for every template", () => {
    SETTINGS_TEMPLATE_KEYS.forEach((key) => {
      const origin = originOf(key);
      expect(hasPatch(createGroupPatch(createInitialState(origin), origin))).toBe(false);
    });
  });
});

describe("screen 05 reached from screen 04a", () => {
  const scratch = scratchOrigin(["attendance", "queue"]);

  test("the blocks chosen are the patch; with none and no answer there is nothing to send", () => {
    expect(createGroupPatch(createInitialState(scratch), scratch)).toEqual({
      schemaVersion: 1,
      attendance: { enabled: true },
      queue: { enabled: true },
    });
    const none = scratchOrigin([]);
    expect(hasPatch(createGroupPatch(createInitialState(none), none))).toBe(false);
    expect(customBase(["attendance", "queue"])).toMatchObject({
      attendance: { enabled: true },
      queue: { enabled: true },
      scoring: { enabled: false },
    });
  });

  test("the answers go on top of the blocks, and the draft passes the parser", () => {
    const state = typed(
      scratch,
      { type: "name-changed", name: "Racha" },
      { type: "capacity-changed", text: "10" },
    );
    expect(createGroupPatch(state, scratch)).toEqual({
      schemaVersion: 1,
      attendance: { enabled: true, capacityLimited: true, capacity: 10 },
      queue: { enabled: true },
    });
    expect(createGroupErrors(state, scratch)).toEqual({});
    expect(canSubmit(state, scratch)).toBe(true);
  });

  test("the blocks chosen change the base of the draft", () => {
    const none = scratchOrigin([]);
    expect(createGroupDraft(createInitialState(none), none).attendance.enabled).toBe(false);
    expect(createGroupDraft(createInitialState(scratch), scratch).attendance.enabled).toBe(true);
  });
});
