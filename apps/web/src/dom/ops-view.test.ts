import { describe, expect, it } from "vitest";

import { opsMetricsOf } from "../ops-page/ops-metrics";
import { metricsBody } from "../ops-page/ops-page.fixtures";
import type { OpsMetrics } from "../ops-page/ops-page.types";

import { opsView, renderOpsPage, type OpsElements, type OpsSection } from "./ops-view";

const metrics = opsMetricsOf(metricsBody()) as OpsMetrics;

function slot() {
  return { hidden: true as boolean | string, textContent: "" as string | null, disabled: true };
}

function elements(shown: OpsSection[][]): OpsElements {
  const field = () => ({ value: "", disabled: false });
  const shownSlot = () => ({ hidden: true as boolean | string });
  return {
    status: slot(),
    updated: slot(),
    signIn: slot(),
    reload: slot(),
    signOut: slot(),
    sections: { show: (sections) => shown.push([...sections]) },
    sheet: shownSlot(),
    sheetTitle: slot(),
    choice: shownSlot(),
    google: slot(),
    embeddedWarning: shownSlot(),
    emailForm: shownSlot(),
    emailTabs: shownSlot(),
    email: field(),
    passwordField: shownSlot(),
    password: field(),
    emailSubmit: slot(),
    forgot: slot(),
    nicknameForm: shownSlot(),
    nickname: field(),
    nicknameSubmit: slot(),
    sheetMessage: slot(),
  };
}

describe("ops view", () => {
  it("criterion 6: the users' section has the totals and the eight weeks, 0 included", () => {
    const [users] = opsView({ step: "ready", metrics }).sections;

    expect(users?.title).toBe("Usuários");
    expect(users?.facts).toEqual([
      { label: "Cadastrados", value: "31" },
      { label: "Contas excluídas", value: "2" },
    ]);
    expect(users?.table?.headers).toEqual(["Semana", "Novos", "Excluídas"]);
    expect(users?.table?.rows).toHaveLength(8);
    expect(users?.table?.rows[0]).toEqual(["05/10", "0", "0"]);
    expect(users?.table?.rows[6]).toEqual(["16/11", "12", "1"]);
  });

  it("criterion 7: the environment and the hour of São Paulo", () => {
    expect(opsView({ step: "ready", metrics }).updated).toBe("Teste · Atualizado às 15:04");
    const production = { ...metrics, environment: "production" as const };
    expect(opsView({ step: "ready", metrics: production }).updated).toBe(
      "Produção · Atualizado às 15:04",
    );
  });

  it("criterion 2: the sheet is open while signed out, and no section", () => {
    const view = opsView({ step: "signIn", form: "choice", failure: null, notice: null });

    expect(view.sheet.form).toBe("choice");
    expect(view.sheet.title).toBe("Entrar no painel");
    expect(view.sections).toHaveLength(0);
    expect(view.signOut).toBe(false);
  });

  it("criterion 16: the DOM gets the text of the view, sections through the slot only", () => {
    const shown: OpsSection[][] = [];
    const nodes = elements(shown);

    renderOpsPage(nodes, { step: "ready", metrics }, { embedded: false });
    renderOpsPage(nodes, { step: "loading" }, { embedded: false });

    expect(shown[0]).toHaveLength(1);
    expect(shown[1]).toHaveLength(0);
    expect(nodes.status.textContent).toBe("Carregando…");
    expect(nodes.updated.hidden).toBe(true);
    expect(nodes.reload.hidden).toBe(true);
    expect(nodes.sheet.hidden).toBe(true);
  });
});
