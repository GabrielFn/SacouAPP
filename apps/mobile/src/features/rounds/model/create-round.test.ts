import {
  applyTemplate,
  defaultGroupSettings,
  getSettingsTemplate,
  SETTINGS_CATALOG,
  SETTINGS_SCHEMA_VERSION,
  type GroupSettings,
  type SettingsPath,
  type SettingsValue,
} from "@sacou/match-engine";
import { describe, expect, test } from "vitest";

import { strings } from "../../../strings/pt-BR";
import { formatTime as formatTimeForTest } from "../../groups/model/schedule-text";
import { withLeaf } from "../../groups/model/settings-patch";
import {
  createRoundReducer,
  PERSONALIZE_PATHS,
  type CreateRoundAction,
  type CreateRoundState,
} from "./create-round.reducer";
import {
  canPublish,
  isPublishDisabled,
  createRoundErrors,
  createRoundRequest,
  firstRoundDate,
  sheetFirstDate,
  confirmableNumber,
  initialCreateRoundState,
  layerChangeCount,
  repeatSummary,
  resolvedPreview,
  roundLayerOf,
  visiblePersonalizePaths,
} from "./create-round.selectors";
import { attendanceRound } from "./attendance.test.fixture";
import { editRoundState, updateRoundRequest } from "./edit-round";
import { roundChips, sourceReader } from "./round-chips";
import {
  dateLabel,
  isoDateOf,
  nextFreeRoundDate,
  nextRoundDate,
  pickableDates,
  startOf,
} from "./round-dates";
import { takenRoundDates } from "./round-series";

const TUESDAY = 2;

const LEAVES: readonly (readonly [SettingsPath, SettingsValue])[] = [
  ["schedule.enabled", true],
  ["schedule.weekday", TUESDAY],
  ["schedule.startTime", "20:30"],
  ["schedule.venue", "Ginásio Sesc"],
  ["attendance.enabled", true],
  ["attendance.capacityLimited", true],
  ["attendance.capacity", 14],
  ["attendance.waitlistEnabled", true],
  ["attendance.regularsEnabled", true],
  ["scoring.enabled", true],
  ["scoring.bestOf", 1],
  ["scoring.pointsPerSet", 25],
  ["queue.enabled", true],
  ["queue.exitMode", "automatic"],
  ["rotation.enabled", true],
  ["rotation.system", "5x1"],
  ["format.modality", "indoor-6x6"],
];

/** The "Racha de terça" of the canvas: 14 spots, 5x1, one set. */
function rachaDeTerca(): GroupSettings {
  const base = applyTemplate(defaultGroupSettings(), getSettingsTemplate("racha-organizado"));
  return LEAVES.reduce((settings, [path, value]) => withLeaf(settings, path, value), base);
}

/** Monday, 2 November 2026, 10:00 (local time of the machine, so the test holds in any time zone). */
const MONDAY_MORNING = new Date(2026, 10, 2, 10, 0);
const TUESDAY_DATE = "2026-11-03";

function initial(hasSeries = false): CreateRoundState {
  return initialCreateRoundState(rachaDeTerca(), MONDAY_MORNING, hasSeries);
}

function run(state: CreateRoundState, ...actions: CreateRoundAction[]): CreateRoundState {
  return actions.reduce(createRoundReducer, state);
}

describe("nextFreeRoundDate: the suggestion skips dates that have a round (R97 part 2, D4)", () => {
  const monday = new Date(2026, 10, 2, 10, 0);
  const onDate = (localDate: string, status: "scheduled" | "canceled" = "scheduled") =>
    ({ localDate, status }) as Parameters<typeof takenRoundDates>[0][number];

  test("a free date is kept", () => {
    expect(nextFreeRoundDate(monday, TUESDAY, "20:30", [])).toBe(TUESDAY_DATE);
  });

  test("one taken week skips a week, two skip two", () => {
    expect(nextFreeRoundDate(monday, TUESDAY, "20:30", [TUESDAY_DATE])).toBe("2026-11-10");
    expect(nextFreeRoundDate(monday, TUESDAY, "20:30", [TUESDAY_DATE, "2026-11-10"])).toBe(
      "2026-11-17",
    );
  });

  test("without a fixed day it skips a taken tomorrow", () => {
    expect(nextFreeRoundDate(monday, null, "20:30", [TUESDAY_DATE])).toBe("2026-11-04");
  });

  test("the initial state of screen 20 uses the taken dates; a canceled round does not occupy", () => {
    const taken = takenRoundDates([onDate(TUESDAY_DATE), onDate("2026-11-10", "canceled")]);
    expect(initialCreateRoundState(rachaDeTerca(), MONDAY_MORNING, false, taken).localDate).toBe(
      "2026-11-10",
    );
  });
});

describe("nextRoundDate", () => {
  const at = (day: number, hour: number, minute: number) => new Date(2026, 10, day, hour, minute);

  test("Monday 10:00 for a Tuesday 20:30 group is the next day", () => {
    expect(nextRoundDate(at(2, 10, 0), TUESDAY, "20:30")).toBe(TUESDAY_DATE);
  });

  test("Tuesday 20:31 is the Tuesday of the next week", () => {
    expect(nextRoundDate(at(3, 20, 31), TUESDAY, "20:30")).toBe("2026-11-10");
  });

  test("Tuesday 20:29 is still today", () => {
    expect(nextRoundDate(at(3, 20, 29), TUESDAY, "20:30")).toBe(TUESDAY_DATE);
  });

  test("at the exact start time the round has not started after now, so it is next week's", () => {
    expect(nextRoundDate(at(3, 20, 30), TUESDAY, "20:30")).toBe("2026-11-10");
  });

  test("a group without a fixed day gets tomorrow", () => {
    expect(nextRoundDate(at(3, 20, 31), null, "20:30")).toBe("2026-11-04");
  });

  test("an hour that does not exist on the day the clocks change is kept as chosen", () => {
    expect(startOf("2018-11-04", "00:30")).not.toBeNull();
    const state = { ...initial(), localDate: "2030-11-04", localTime: "00:30" };
    expect(createRoundRequest(rachaDeTerca(), state).localTime).toBe("00:30");
  });

  test("labels the date as the canvas does", () => {
    expect(dateLabel(TUESDAY_DATE)).toBe("Ter, 3/11");
    expect(pickableDates(TUESDAY_DATE)).toHaveLength(14);
    expect(pickableDates(TUESDAY_DATE)[0]).toEqual({ date: TUESDAY_DATE, label: "Ter, 3/11" });
    expect(pickableDates(TUESDAY_DATE)[1]?.label).toBe("Qua, 4/11");
  });
});

describe("the base of screen 20 comes from the group", () => {
  test("a Tuesday 20:30 group starts on the next Tuesday with its venue and 14 spots", () => {
    expect(initial()).toEqual({
      localDate: TUESDAY_DATE,
      localTime: "20:30",
      venue: "Ginásio Sesc",
      capacityText: "14",
      layer: {},
      repeatWeekly: true,
      personalizeOpen: false,
      sheet: { kind: "none" },
    });
    expect(firstRoundDate(rachaDeTerca(), MONDAY_MORNING)).toBe(TUESDAY_DATE);
  });

  test("without a fixed day the round starts tomorrow at the default hour and does not repeat", () => {
    const group = withLeaf(rachaDeTerca(), "schedule.enabled", false);
    const state = initialCreateRoundState(group, MONDAY_MORNING, false);
    expect(state.localDate).toBe("2026-11-03");
    expect(state.localTime).toBe("20:00");
    expect(state.repeatWeekly).toBe(false);
  });

  test("a group that already repeats weekly does not repeat a second time", () => {
    expect(initial(true).repeatWeekly).toBe(false);
  });

  test("a group without a spot limit starts with the field empty", () => {
    const group = withLeaf(rachaDeTerca(), "attendance.capacityLimited", false);
    expect(initialCreateRoundState(group, MONDAY_MORNING, false).capacityText).toBe("");
  });
});

describe("the canvas scenario: Sets to 'Melhor de 3'", () => {
  const group = rachaDeTerca();
  const changed = run(initial(), {
    type: "layer-set",
    path: "scoring.bestOf",
    value: 3,
  });

  test("the layer has only the sets, and it counts one change", () => {
    expect(changed.layer).toEqual({ "scoring.bestOf": 3 });
    expect(layerChangeCount(changed)).toBe(1);
    expect(roundLayerOf(group, changed)).toEqual({ schemaVersion: 1, scoring: { bestOf: 3 } });
  });

  test("the pill 'Melhor de 3' is highlighted and the other ones are not", () => {
    const resolved = resolvedPreview(group, changed);
    const chips = roundChips(resolved.values, sourceReader(resolved.sources), {
      withRotation: true,
    });
    expect(chips.map((chip) => chip.label)).toEqual([
      "6x6",
      "25 pontos",
      "Melhor de 3",
      "Perde sai",
      "Saída parcial",
      "5x1",
    ]);
    expect(chips.filter((chip) => chip.highlighted).map((chip) => chip.label)).toEqual([
      "Melhor de 3",
    ]);
  });

  test("'Voltar ao padrão' empties the layer and the body sends settings null", () => {
    const back = run(changed, { type: "layer-reset", path: "scoring.bestOf" });
    expect(back.layer).toEqual({});
    expect(createRoundRequest(group, back).settings).toBeNull();
  });

  test("the body is exactly what the server reads", () => {
    expect(createRoundRequest(group, changed)).toEqual({
      localDate: TUESDAY_DATE,
      localTime: "20:30",
      venue: "Ginásio Sesc",
      settings: { schemaVersion: 1, scoring: { bestOf: 3 } },
      repeatWeekly: true,
    });
  });
});

describe("spots", () => {
  const group = rachaDeTerca();
  const withText = (text: string) => run(initial(), { type: "capacity-changed", text });

  test("14, the group's own number, writes nothing in the layer", () => {
    expect(roundLayerOf(group, withText("14"))).toBeNull();
  });

  test("16 becomes the capacity of the round with the limit on", () => {
    expect(roundLayerOf(group, withText("16"))).toEqual({
      schemaVersion: 1,
      attendance: { capacity: 16, capacityLimited: true },
    });
  });

  test.each(["0", "301", ""])("%j is refused and 'Publicar' is off", (text) => {
    const state = withText(text);
    expect(createRoundErrors(group, state, MONDAY_MORNING).capacity).not.toBeNull();
    expect(canPublish(group, state, MONDAY_MORNING)).toBe(false);
  });

  test("letters never enter the field", () => {
    expect(withText("abc").capacityText).toBe("");
  });

  test("an empty field is fine when the group has no limit, and writes nothing", () => {
    const open = withLeaf(group, "attendance.capacityLimited", false);
    const state = initialCreateRoundState(open, MONDAY_MORNING, false);
    expect(createRoundErrors(open, state, MONDAY_MORNING).capacity).toBeNull();
    expect(roundLayerOf(open, state)).toBeNull();
  });
});

describe("what is refused", () => {
  const group = rachaDeTerca();
  const edit = (patch: Partial<CreateRoundState>) => ({ ...initial(), ...patch });
  const errors = (state: CreateRoundState) => createRoundErrors(group, state, MONDAY_MORNING);

  test("a date in the past", () => {
    expect(errors(edit({ localDate: "2026-11-01" })).date).not.toBeNull();
  });

  test("365 days ahead passes and 366 does not", () => {
    const today = new Date(2026, 10, 2);
    const limit = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 365);
    const beyond = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 366);
    expect(errors(edit({ localDate: isoDateOf(limit) })).date).toBeNull();
    expect(errors(edit({ localDate: isoDateOf(beyond) })).date).not.toBeNull();
  });

  test("24:00 is not an hour", () => {
    expect(errors(edit({ localTime: "24:00" })).time).not.toBeNull();
  });

  test("an hour that already passed today", () => {
    expect(errors(edit({ localDate: "2026-11-02", localTime: "09:00" })).time).not.toBeNull();
  });

  test("today at 23:00 still passes in the morning", () => {
    expect(errors(edit({ localDate: "2026-11-02", localTime: "23:00" })).time).toBeNull();
  });

  test("a venue of 80 characters passes and one of 81 does not", () => {
    expect(errors(edit({ venue: "a".repeat(80) })).venue).toBeNull();
    expect(errors(edit({ venue: "a".repeat(81) })).venue).not.toBeNull();
  });

  test("a zero-width space in the venue is refused", () => {
    expect(errors(edit({ venue: "Quadra​1" })).venue).not.toBeNull();
  });

  test("an empty venue is allowed", () => {
    expect(errors(edit({ venue: "" })).venue).toBeNull();
  });

  test("the first state can be published", () => {
    expect(canPublish(group, initial(), MONDAY_MORNING)).toBe(true);
  });

  test("'Publicar' is off when the form is invalid or a call is on the way", () => {
    const invalid = edit({ venue: "x".repeat(81) });
    expect(isPublishDisabled(group, initial(), MONDAY_MORNING, false)).toBe(false);
    expect(isPublishDisabled(group, initial(), MONDAY_MORNING, true)).toBe(true);
    expect(isPublishDisabled(group, invalid, MONDAY_MORNING, false)).toBe(true);
  });
});

describe("repeat every week", () => {
  const group = rachaDeTerca();

  test("the summary names the weekday of the chosen date and the regulars", () => {
    expect(repeatSummary(group, initial(), formatTimeForTest)).toBe(
      "Toda terça, 20h30. Mensalistas já confirmados.",
    );
  });

  test("without regulars the sentence about them goes away", () => {
    const without = withLeaf(group, "attendance.regularsEnabled", false);
    expect(repeatSummary(without, initial(), formatTimeForTest)).toBe("Toda terça, 20h30.");
  });

  test("the toggle flips it", () => {
    expect(run(initial(), { type: "repeat-toggled" }).repeatWeekly).toBe(false);
  });
});

describe("the personalize list", () => {
  test("every row is a leaf a round may change, and none is money", () => {
    for (const path of PERSONALIZE_PATHS) {
      const field = SETTINGS_CATALOG.fields.find((candidate) => candidate.path === path);
      expect(field?.levels).toContain("round");
      expect(path.startsWith("money.")).toBe(false);
    }
  });

  test("points and rotation show only with their blocks on", () => {
    const group = rachaDeTerca();
    expect(visiblePersonalizePaths(group)).toEqual(PERSONALIZE_PATHS);
    const off = withLeaf(withLeaf(group, "scoring.enabled", false), "rotation.enabled", false);
    expect(visiblePersonalizePaths(off)).toEqual([]);
  });

  test("no text of the screen speaks of money", () => {
    const text = JSON.stringify(strings.rounds);
    expect(text).not.toContain("R$");
    expect(text).not.toContain("Pro");
    expect(text).not.toContain("Avulso");
  });
});

describe("the reducer", () => {
  test("each action does one thing", () => {
    const state = initial();
    expect(run(state, { type: "date-picked", localDate: "2026-11-10" }).localDate).toBe(
      "2026-11-10",
    );
    expect(run(state, { type: "time-picked", localTime: "19:00" }).localTime).toBe("19:00");
    expect(run(state, { type: "venue-changed", venue: "Quadra 2" }).venue).toBe("Quadra 2");
    expect(run(state, { type: "personalize-toggled" }).personalizeOpen).toBe(true);
    expect(run(state, { type: "sheet-opened", sheet: { kind: "date" } }).sheet).toEqual({
      kind: "date",
    });
    expect(
      run(state, { type: "sheet-opened", sheet: { kind: "time" } }, { type: "sheet-closed" }).sheet,
    ).toEqual({ kind: "none" });
  });

  test("a valid time closes its sheet", () => {
    const opened = run(initial(), { type: "sheet-opened", sheet: { kind: "time" } });
    expect(run(opened, { type: "time-picked", localTime: "19:00" }).sheet.kind).toBe("none");
  });

  test("a new action without a case does not compile", () => {
    // @ts-expect-error: an action the reducer does not know.
    const unknown: CreateRoundAction = { type: "round-canceled" };
    expect(unknown.type).toBe("round-canceled");
  });

  test("picking a date closes its sheet; setting a leaf closes its sheet", () => {
    const opened = run(initial(), { type: "sheet-opened", sheet: { kind: "date" } });
    expect(run(opened, { type: "date-picked", localDate: "2026-11-10" }).sheet.kind).toBe("none");
    const setting = run(initial(), {
      type: "sheet-opened",
      sheet: { kind: "setting", path: "rotation.system" },
    });
    const set = run(setting, { type: "layer-set", path: "rotation.system", value: "6x2" });
    expect(set.sheet.kind).toBe("none");
    expect(set.layer).toEqual({ "rotation.system": "6x2" });
  });
});

describe("Editar rodada (screen 20 with roundId)", () => {
  const group = rachaDeTerca();
  const edited = withLeaf(withLeaf(group, "scoring.bestOf", 3), "queue.exitMode", "partial");
  const view = {
    values: withLeaf(edited, "attendance.capacity", 16),
    sources: {
      "scoring.bestOf": "round",
      "queue.exitMode": "round",
      "attendance.capacity": "round",
      "attendance.capacityLimited": "round",
      "rotation.system": "group",
    },
  };
  const round = attendanceRound({
    localDate: TUESDAY_DATE,
    localTime: "20:30",
    venue: "Ginásio Sesc",
    capacity: 16,
  });

  test("starts from the round: its date, time, venue, capacity and own leaves; no weekly repeat", () => {
    const state = editRoundState(group, round, view);
    expect(state).toMatchObject({
      localDate: TUESDAY_DATE,
      localTime: "20:30",
      venue: "Ginásio Sesc",
      capacityText: "16",
      layer: { "scoring.bestOf": 3 },
      repeatWeekly: false,
      personalizeOpen: true,
    });
  });

  test("the PATCH carries the whole layer, the leaves the form does not show included", () => {
    const body = updateRoundRequest(group, view, editRoundState(group, round, view));
    expect(body).toEqual({
      localDate: TUESDAY_DATE,
      localTime: "20:30",
      venue: "Ginásio Sesc",
      settings: {
        schemaVersion: SETTINGS_SCHEMA_VERSION,
        queue: { exitMode: "partial" },
        scoring: { bestOf: 3 },
        attendance: { capacity: 16, capacityLimited: true },
      },
    });
  });

  test("an emptied layer goes as {}, which clears it", () => {
    const plain = { values: group, sources: { "scoring.bestOf": "round" } };
    const state = run(editRoundState(group, round, plain), {
      type: "layer-reset",
      path: "scoring.bestOf",
    });
    const body = updateRoundRequest(group, plain, { ...state, capacityText: "14" });
    expect(body.settings).toEqual({});
  });
});

describe("confirmableNumber: the 'done' key of the points sheet (R98 part 3)", () => {
  test("a whole number confirms, with or without spaces", () => {
    expect(confirmableNumber("21")).toBe(21);
    expect(confirmableNumber(" 21 ")).toBe(21);
  });

  test("empty, zero, decimal and text do not confirm", () => {
    expect(["", "0", "2.5", "abc", "-3"].map(confirmableNumber)).toEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
  });
});

describe("the sheet starts today (R98 part 3)", () => {
  test("today is the first of the 14 dates, and the 14th is 13 days ahead", () => {
    const dates = pickableDates(sheetFirstDate(isoDateOf(MONDAY_MORNING), "2026-11-03"));
    expect(dates[0]?.date).toBe("2026-11-02");
    expect(dates).toHaveLength(14);
    expect(dates[13]?.date).toBe("2026-11-15");
  });

  test("the day the clocks change does not skip or repeat a date", () => {
    const dates = pickableDates("2026-02-14").map((option) => option.date);
    expect(new Set(dates).size).toBe(14);
    expect(dates[4]).toBe("2026-02-18");
  });
});

describe("sheetFirstDate: the selected date always shows in the sheet (R97 part 2)", () => {
  test("a selected date inside the 14 days keeps the next day first", () => {
    expect(sheetFirstDate("2026-11-03", "2026-11-10")).toBe("2026-11-03");
  });

  test("a selected date before the first one starts the sheet there", () => {
    expect(sheetFirstDate("2026-11-10", "2026-11-03")).toBe("2026-11-03");
  });

  test("the suggestion that skips 14+ days of taken dates still shows", () => {
    const taken = Array.from({ length: 3 }, (_unused, week) =>
      isoDateOf(new Date(2026, 10, 3 + week * 7)),
    );
    const first = firstRoundDate(rachaDeTerca(), MONDAY_MORNING);
    const suggested = nextFreeRoundDate(MONDAY_MORNING, TUESDAY, "20:30", taken);
    const dates = pickableDates(sheetFirstDate(first, suggested)).map((option) => option.date);
    expect(dates).toContain(suggested);
  });
});
