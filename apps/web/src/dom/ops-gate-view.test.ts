import { describe, expect, it } from "vitest";

import { opsMetricsOf } from "../ops-page/ops-metrics";
import { gateCount, metricsBody } from "../ops-page/ops-page.fixtures.test";
import type { OpsMetrics } from "../ops-page/ops-page.types";

import {
  byGroupSection,
  gateSection,
  groupsSection,
  rateText,
  roundsSection,
} from "./ops-gate-view";
import { opsView } from "./ops-view";

const metrics = opsMetricsOf(metricsBody()) as OpsMetrics;

describe("ops gate view", () => {
  it("criterion 19: 4 of 6 is 67%, 3 of 6 by the link is 50%, beside the 60% target", () => {
    const example = opsMetricsOf(
      metricsBody({
        gate: { ...(metricsBody().gate as object), total: gateCount(1, 6, 4, 3) },
      }),
    ) as OpsMetrics;

    const section = gateSection(example);

    expect(section.title).toBe("Portão");
    expect(section.facts).toEqual([
      { label: "Portão (total)", value: "67%" },
      { label: "Meta", value: "60%" },
      { label: "Só pelo link (total)", value: "50%" },
    ]);
  });

  it("criteria 19 and 20: every week, and a week without a round is —, never 0%", () => {
    const rows = gateSection(metrics).table?.rows ?? [];

    expect(rows).toHaveLength(8);
    expect(rows[0]).toEqual(["05/10", "0", "0", "—", "—", "60%"]);
    expect(rows[1]).toEqual(["12/10", "1", "6", "67%", "50%", "60%"]);
    expect(rateText(null)).toBe("—");
    expect(rateText(0)).toBe("0%");
  });

  it("criterion 22: Grupos que cumprem o portão: N de 5", () => {
    expect(gateSection(metrics).note).toBe("Grupos que cumprem o portão: 1 de 5");
  });

  it("criterion 21: each group with its name as text, its rounds, rate, streak and Sim or Não", () => {
    const table = byGroupSection(metrics).table;

    expect(table?.headers).toEqual([
      "Grupo",
      "Rodadas",
      "Confirmados",
      "Portão",
      "Semanas seguidas",
      "Cumpre",
    ]);
    expect(table?.rows).toEqual([
      ["Vôlei de quinta", "7", "40", "75%", "5", "Sim"],
      ["<b>Zé</b>", "0", "0", "—", "0", "Não"],
    ]);
    expect(table?.caption).toBe("Cumpre: 4 semanas seguidas com rodada e 60% ou mais em cada uma");
  });

  it("criteria 17 and 18: groups and rounds", () => {
    expect(groupsSection(metrics).facts.map((fact) => fact.value)).toEqual(["3", "2"]);
    expect(roundsSection(metrics).facts).toEqual([
      { label: "Criadas", value: "14" },
      { label: "Realizadas", value: "11" },
      { label: "Encerradas", value: "9" },
      { label: "Canceladas", value: "1" },
    ]);
    expect(roundsSection(metrics).table?.rows).toHaveLength(8);
  });

  it("the gate comes first, and every section only in ready", () => {
    expect(opsView({ step: "ready", metrics }).sections.map((section) => section.title)).toEqual([
      "Portão",
      "Portão por grupo",
      "Usuários",
      "Grupos",
      "Rodadas",
    ]);
    expect(opsView({ step: "denied" }).sections).toHaveLength(0);
  });

  it.each([
    ["a rate above 1", { total: gateCount(1, 1, 2, 0) }],
    [
      "a group without a name",
      { byGroup: [{ count: gateCount(0, 0, 0, 0), longestStreak: 0, meetsGate: false }] },
    ],
  ])("refuses a gate with %s", (_, change) => {
    const gate = { ...(metricsBody().gate as object), ...change };
    expect(opsMetricsOf(metricsBody({ gate }))).toBeNull();
  });
});
