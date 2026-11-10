import {
  applyTemplate,
  defaultGroupSettings,
  getSettingsTemplate,
  SETTINGS_CATALOG,
  type GroupSettings,
  type SettingsPath,
} from "@sacou/match-engine";
import { describe, expect, test } from "vitest";

import {
  groupSettingsFormReducer,
  initialGroupSettingsFormState,
  type GroupSettingsFormAction,
} from "./group-settings-form.reducer";
import {
  blockSummary,
  canManageSettings,
  choiceOptions,
  fieldValueText,
  liberoNote,
  parseFieldText,
  settingsError,
  sheetChanges,
  sheetErrorText,
  visibleSettings,
} from "./group-settings.selectors";
import { settingsStrings } from "../../../strings/settings.pt-BR";
import { SETTINGS_SCREEN, visibleRows } from "./settings-layout";
import { leafLayer, settingsPatch, withLeaf } from "./settings-patch";
import { templateLabel, toSettingsView } from "./settings-document";

const racha = applyTemplate(defaultGroupSettings(), getSettingsTemplate("racha-organizado"));

/** The group of the canvas: 14 spots, Tuesday 20:30, tie-break to 15 and a lead of 2. */
const canvasGroup: GroupSettings = [
  ["attendance.capacity", 14],
  ["schedule.enabled", true],
  ["schedule.startTime", "20:30"],
  ["schedule.venue", "Ginásio Sesc"],
].reduce(
  (settings, [path, value]) => withLeaf(settings, path as SettingsPath, value as never),
  racha,
);

function run(...actions: readonly GroupSettingsFormAction[]) {
  return actions.reduce(groupSettingsFormReducer, initialGroupSettingsFormState);
}

describe("the reducer of screen 18", () => {
  test("a change goes to pending and leaves it when saved or when it fails", () => {
    const changed = run({ type: "leaf-changed", path: "queue.enabled", value: false });
    expect(changed.pending).toEqual({ "queue.enabled": false });
    expect(
      groupSettingsFormReducer(changed, { type: "leaf-saved", path: "queue.enabled" }).pending,
    ).toEqual({});
    const failed = groupSettingsFormReducer(changed, {
      type: "leaf-failed",
      path: "queue.enabled",
      message: "Sem conexão. A mudança não foi salva.",
    });
    expect(failed.pending).toEqual({});
    expect(failed.message).toBe("Sem conexão. A mudança não foi salva.");
  });

  test("a new change clears the old message", () => {
    const failed = run({ type: "message-shown", message: "x" });
    expect(
      groupSettingsFormReducer(failed, { type: "leaf-changed", path: "draw.enabled", value: true })
        .message,
    ).toBeNull();
  });

  test("opening a block closes the other one", () => {
    const first = run({ type: "block-toggled", block: "attendance" });
    expect(first.expanded).toBe("attendance");
    expect(groupSettingsFormReducer(first, { type: "block-toggled", block: "scoring" }).expanded).toBe(
      "scoring",
    );
    expect(
      groupSettingsFormReducer(first, { type: "block-toggled", block: "attendance" }).expanded,
    ).toBeNull();
  });

  test("a sheet with confirm and cancel: cancelling changes no pending leaf", () => {
    const opened = run(
      { type: "sheet-opened", sheet: { kind: "field", path: "scoring.pointsPerSet", text: "25" } },
      { type: "sheet-text-changed", text: "21" },
    );
    expect(opened.sheet).toEqual({ kind: "field", path: "scoring.pointsPerSet", text: "21" });
    const cancelled = groupSettingsFormReducer(opened, { type: "sheet-cancelled" });
    expect(cancelled.pending).toEqual({});
    expect(cancelled.sheet).toEqual({ kind: "none" });
  });

  test("the schedule sheet takes a weekday and a time", () => {
    const opened = run(
      { type: "sheet-opened", sheet: { kind: "schedule", weekday: 2, time: "20:00" } },
      { type: "sheet-weekday-selected", weekday: 4 },
      { type: "sheet-text-changed", text: "19:30" },
    );
    expect(opened.sheet).toEqual({ kind: "schedule", weekday: 4, time: "19:30" });
  });
});

describe("visibleSettings and settingsPatch", () => {
  test("a pending leaf shows over the server document", () => {
    const visible = visibleSettings(racha, { "scoring.pointsPerSet": 21 });
    expect(visible.scoring.pointsPerSet).toBe(21);
    expect(racha.scoring.pointsPerSet).toBe(25);
  });

  test("a pending leaf equal to the server changes nothing", () => {
    expect(visibleSettings(racha, { "queue.enabled": racha.queue.enabled })).toEqual(racha);
  });

  test("the patch of one switch is that leaf and nothing else", () => {
    const edited = withLeaf(racha, "queue.enabled", false);
    expect(settingsPatch(racha, edited)).toEqual({ schemaVersion: 1, queue: { enabled: false } });
    expect(leafLayer([["queue.enabled", false]])).toEqual({
      schemaVersion: 1,
      queue: { enabled: false },
    });
  });

  test("the layer of two leaves of one block is a single block", () => {
    expect(
      leafLayer([
        ["schedule.weekday", 4],
        ["schedule.startTime", "19:30"],
      ]),
    ).toEqual({ schemaVersion: 1, schedule: { weekday: 4, startTime: "19:30" } });
  });

  test("a value the engine refuses is shown as text and not sent", () => {
    expect(settingsError(withLeaf(racha, "scoring.pointsPerSet", 100))).toBe(
      "Use um valor de 1 a 99.",
    );
    expect(settingsError(racha)).toBeNull();
  });
});

describe("blockSummary", () => {
  test("the group of the canvas reads as the canvas", () => {
    expect(blockSummary("attendance", canvasGroup)).toBe(
      "Limite 14 · mensalistas com prioridade · avulsos abrem 24h antes · toda terça 20h30",
    );
    expect(blockSummary("scoring", canvasGroup)).toBe(
      "25 pontos · 1 set · tie-break 15 · vantagem de 2",
    );
  });

  test("a block that is off says so", () => {
    expect(blockSummary("scoring", withLeaf(canvasGroup, "scoring.enabled", false))).toBe(
      "Desligado",
    );
  });

  test("no limit, three sets and no lead", () => {
    const loose = [
      ["attendance.capacityLimited", false],
      ["scoring.bestOf", 3],
      ["scoring.winMargin", 1],
      ["scoring.tieBreakEnabled", false],
    ].reduce(
      (settings, [path, value]) => withLeaf(settings, path as SettingsPath, value as never),
      canvasGroup,
    );
    expect(blockSummary("attendance", loose)).toContain("sem limite");
    expect(blockSummary("scoring", loose)).toBe("25 pontos · 3 sets · sem vantagem");
  });

  test("the free system has no libero even with the switch on", () => {
    const free = withLeaf(withLeaf(racha, "rotation.system", "livre"), "rotation.liberoEnabled", true);
    expect(liberoNote(free)).toBe("sem líbero");
    expect(liberoNote(withLeaf(free, "rotation.system", "5x1"))).toBe("com líbero");
  });
});

describe("the rotation systems", () => {
  test("are exactly the ones of the catalog, with Pro on 4x2, 5x1 and 6x2", () => {
    const options = choiceOptions("rotation.system");
    const catalog = SETTINGS_CATALOG.fields.find((field) => field.path === "rotation.system");
    expect(options.map(({ value }) => value)).toEqual(catalog?.values);
    expect(options.map(({ label }) => label)).toEqual(["Livre", "5x1", "4x2", "6x2"]);
    expect(options.filter(({ pro }) => pro).map(({ label }) => label)).toEqual(["5x1", "4x2", "6x2"]);
    expect(options.map(({ label }) => label)).not.toContain("6x0");
  });

  test("every choice of the screen has a label in pt-BR", () => {
    SETTINGS_SCREEN.flatMap((spec) => spec.rows)
      .filter(({ row }) => row.kind === "choice")
      .forEach(({ row }) => {
        if (row.kind !== "choice") return;
        const labels = settingsStrings.choices[row.path] ?? {};
        choiceOptions(row.path).forEach((option) => {
          expect(labels[String(option.value)]).toBeTypeOf("string");
        });
      });
  });
});

describe("who changes the rules", () => {
  test.each([
    ["admin", true],
    ["coAdmin", true],
    ["scorekeeper", false],
    ["player", false],
  ] as const)("%s: %s", (role, can) => {
    expect(canManageSettings(role)).toBe(can);
  });
});

describe("the layout of the screen", () => {
  test("every leaf the screen edits exists in the catalog", () => {
    const paths = new Set<string>(SETTINGS_CATALOG.fields.map((field) => field.path));
    SETTINGS_SCREEN.flatMap((spec) => spec.rows).forEach(({ row }) => {
      if ("path" in row) expect(paths.has(row.path)).toBe(true);
    });
  });

  test("a line that depends on a switch is shown only when the switch is on", () => {
    const attendance = SETTINGS_SCREEN[0];
    if (attendance === undefined) throw new Error("no block");
    const off = withLeaf(racha, "attendance.capacityLimited", false);
    const kinds = (settings: GroupSettings) =>
      visibleRows(attendance, settings).map((row) => ("path" in row ? row.path : row.kind));
    expect(kinds(racha)).toContain("attendance.capacity");
    expect(kinds(off)).not.toContain("attendance.capacity");
  });

  test("there is no Pix line while E3.10 is missing", () => {
    const money = SETTINGS_SCREEN.find((spec) => spec.block === "money");
    expect(money?.rows.map(({ row }) => ("path" in row ? row.path : row.kind))).toEqual([
      "money.dropInFeeCents",
      "money.monthlyFeeCents",
    ]);
  });
});

describe("a field sheet", () => {
  test("numbers, money and text are read as the leaf they write", () => {
    expect(parseFieldText("scoring.pointsPerSet", " 21 ")).toBe(21);
    expect(parseFieldText("scoring.pointsPerSet", "2x")).toBeNull();
    expect(parseFieldText("money.monthlyFeeCents", "R$ 35")).toBe(3500);
    expect(parseFieldText("schedule.venue", "  Ginásio ")).toBe("Ginásio");
  });

  test("a draft is confirmed only when the engine accepts it", () => {
    const bad = { kind: "field", path: "scoring.pointsPerSet", text: "100" } as const;
    expect(sheetErrorText(racha, bad)).toBe("Use um valor de 1 a 99.");
    const good = { kind: "field", path: "scoring.pointsPerSet", text: "21" } as const;
    expect(sheetErrorText(racha, good)).toBeNull();
    expect(sheetChanges(good)).toEqual([{ path: "scoring.pointsPerSet", value: 21 }]);
  });

  test("the schedule sheet writes the weekday and the time", () => {
    const sheet = { kind: "schedule", weekday: 5, time: "24:00" } as const;
    expect(sheetChanges(sheet)).toHaveLength(2);
    expect(sheetErrorText(racha, sheet)).toBeTypeOf("string");
  });

  test("values are read for the rows", () => {
    expect(fieldValueText("money.dropInFeeCents", withLeaf(racha, "money.dropInFeeCents", 1000))).toBe(
      "R$ 10",
    );
    expect(fieldValueText("attendance.dropInOpensHoursBefore", racha)).toBe("24h");
    expect(fieldValueText("schedule.venue", racha)).toBe("Escolher");
  });
});

describe("the document of the server", () => {
  const document = (settings: unknown, templateKey: string | null, savedTemplateId: string | null) => ({
    schemaVersion: 1,
    settings,
    templateKey,
    savedTemplateId,
    updatedAt: "2026-11-10T12:00:00Z",
  });

  test("a document the parser accepts becomes a view", () => {
    const view = toSettingsView(document(racha, "racha-organizado", null));
    expect(view?.settings).toEqual(racha);
  });

  test("a document the parser refuses becomes nothing", () => {
    expect(toSettingsView(document({ schemaVersion: 1 }, null, null))).toBeNull();
    expect(toSettingsView(document(null, null, null))).toBeNull();
  });

  test("the label of Modelo usado", () => {
    const view = (key: string | null, saved: string | null) => {
      const parsed = toSettingsView(document(racha, key, saved));
      if (parsed === null) throw new Error("document");
      return parsed;
    };
    const saved = [{ templateId: "t1", name: "Meu racha", createdAt: "2026-11-10T12:00:00Z" }];
    expect(templateLabel(view("treino", null), saved)).toEqual({ kind: "ready", key: "treino" });
    expect(templateLabel(view(null, "t1"), saved)).toEqual({ kind: "saved", name: "Meu racha" });
    expect(templateLabel(view(null, null), saved)).toEqual({ kind: "custom" });
    expect(templateLabel(view(null, "t1"), [])).toEqual({ kind: "custom" });
  });
});
