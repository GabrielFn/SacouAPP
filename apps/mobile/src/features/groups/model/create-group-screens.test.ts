import { defaultGroupSettings, parseGroupSettings, SETTINGS_CATALOG } from "@sacou/match-engine";
import { describe, expect, test } from "vitest";

import { strings } from "../../../strings/pt-BR";
import { sizes } from "../../../theme/tokens.data";
import { createGroupCustomHref, createGroupDetailsHref } from "../navigation";
import { createInitialState } from "./create-group.reducer";
import { createGroupPatch, hasPatch } from "./create-group.selectors";
import {
  CUSTOM_BLOCKS,
  customBase,
  parseCustomBlocks,
  READY_TEMPLATES,
  scratchOrigin,
  serializeCustomBlocks,
  templateOrigin,
  type CustomBlock,
} from "./custom-blocks";
import { draftOf, queueRuleSummary } from "./queue-rule";
import { SETTINGS_SCREEN } from "./settings-layout";

const { templates, fields, choices, queueRule } = strings.settings;

describe("screen 04", () => {
  test("the radio group has the four ready templates and no 'Do zero'", () => {
    expect(READY_TEMPLATES).toEqual([
      "pelada",
      "racha-organizado",
      "treino",
      "areia-rei-da-quadra",
    ]);
  });

  test("'Do zero' opens screen 04a", () => {
    expect(createGroupCustomHref).toBe("/groups/new/custom");
  });

  test("the line of the Racha has no Pix and says nota", () => {
    const line = templates["racha-organizado"].line;
    expect(line).not.toContain("Pix");
    expect(line).toContain("nota");
  });

  test("the template goes on the route; from scratch also carries the blocks", () => {
    expect(createGroupDetailsHref(templateOrigin("pelada"))).toEqual({
      pathname: "/groups/new/details",
      params: { template: "pelada" },
    });
    expect(createGroupDetailsHref(scratchOrigin(["queue", "attendance"]))).toEqual({
      pathname: "/groups/new/details",
      params: { template: "do-zero", blocks: "attendance,queue" },
    });
  });

  test("the touch targets are at least 44", () => {
    expect(sizes.templateOptionMin).toBeGreaterThanOrEqual(44);
    expect(sizes.templateOptionZeroMin).toBeGreaterThanOrEqual(44);
    expect(sizes.blockHeaderMin).toBeGreaterThanOrEqual(44);
  });
});

describe("screen 04a", () => {
  const every = (): readonly (readonly CustomBlock[])[] =>
    Array.from({ length: 2 ** CUSTOM_BLOCKS.length }, (_, mask) =>
      CUSTOM_BLOCKS.filter((_block, index) => (mask & (1 << index)) !== 0),
    );

  test("the 64 combinations of blocks go to the route and come back", () => {
    expect(every()).toHaveLength(64);
    every().forEach((blocks) => {
      expect(parseCustomBlocks(serializeCustomBlocks(blocks))).toEqual(blocks);
    });
  });

  test("every switch is a boolean leaf of the catalog, and there is no money", () => {
    CUSTOM_BLOCKS.forEach((block) => {
      const field = SETTINGS_CATALOG.fields.find(({ path }) => path === `${block}.enabled`);
      expect(field?.type).toBe("boolean");
    });
    expect([...CUSTOM_BLOCKS]).not.toContain("money");
  });

  test("every block has a title, a summary and a text", () => {
    CUSTOM_BLOCKS.forEach((block) => {
      const text = strings.createGroup.custom.blocks[block];
      expect(text.title).not.toBe("");
      expect(text.summary).not.toBe("");
      expect(text.detail).not.toBe("");
    });
  });

  test("no block is the plain 'Do zero', and every combination passes the parser", () => {
    const none = scratchOrigin([]);
    expect(hasPatch(createGroupPatch(createInitialState(none), none))).toBe(false);
    every().forEach((blocks) => {
      expect(parseGroupSettings(customBase(blocks)).ok).toBe(true);
    });
  });

  test("one block on changes only its own switch", () => {
    const base = customBase([]);
    const queue = customBase(["queue"]);
    expect(queue).toEqual({ ...base, queue: { ...base.queue, enabled: true } });
  });
});

describe("screen 05", () => {
  test("it asks two questions and none is about money", () => {
    const { step2, errors, partial } = strings.createGroup;
    expect(step2.title).toBe("Duas perguntas e pronto");
    expect(Object.keys(step2).filter((key) => /charge|fee/i.test(key))).toEqual([]);
    expect(Object.keys(errors)).not.toContain("money");
    expect(partial.title).toBe("Grupo criado, mas não salvamos tudo.");
  });
});

describe("screen 18", () => {
  test("there is no money block and no money text", () => {
    const blocks: readonly string[] = SETTINGS_SCREEN.map(({ block }) => block);
    expect(blocks).not.toContain("money");
    expect(Object.keys(fields).filter((path) => path.startsWith("money."))).toEqual([]);
    expect(Object.keys(strings.settings.blocks)).not.toContain("money");
  });

  test("the queue rule line says Automático for the default document", () => {
    expect(queueRuleSummary(draftOf(defaultGroupSettings()))).toBe(queueRule.summary.automatic);
    const rule = SETTINGS_SCREEN.flatMap(({ rows }) => rows).find(
      ({ row }) => row.kind === "queue-rule",
    );
    expect(rule).toBeDefined();
  });

  test("one button says Livre / 6x0 and the four systems are those of the catalog", () => {
    const system = SETTINGS_CATALOG.fields.find(({ path }) => path === "rotation.system");
    expect(system?.values).toHaveLength(4);
    expect(choices["rotation.system"]?.["livre"]).toBe("Livre / 6x0");
    expect(Object.values(choices["rotation.system"] ?? {})).not.toContain("6x0");
  });

  test("the draw is balanced by the grade of the admin", () => {
    expect(fields["draw.balanceByLevel"]).toBe("Equilibrar pela nota do admin");
  });
});
