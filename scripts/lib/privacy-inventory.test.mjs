import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { URL } from "node:url";

import {
  findInventoryViolations,
  findPendingMarkers,
  INVENTORY_TABLES,
  PENDING_SCAN_FILES,
} from "./privacy-inventory.mjs";

const ROOT = new URL("../../", import.meta.url);
const HEADER = "| Dado | Onde fica | Por quê | Base legal | Retenção | Fonte | Na exclusão |";
const SEPARATOR = "|---|---|---|---|---|---|---|";
const CONTRACT = "execução de contrato (art. 7, V)";

function row(dado, basis, retention) {
  return `| ${dado} | Postgres (Neon) | Login | ${basis} | ${retention} | ADR 0056 | Apagado |`;
}

function inventory(contaRows) {
  const table = (title, rows) => [`## ${title}`, "", HEADER, SEPARATOR, ...rows, ""];
  return INVENTORY_TABLES.flatMap((title) =>
    table(title, title === "Conta e perfil" ? contaRows : [row("Outro", CONTRACT, "30 dias")]),
  ).join("\n");
}

function read(path) {
  return readFileSync(new URL(path, ROOT), "utf8").replaceAll("\r\n", "\n");
}

describe("findInventoryViolations", () => {
  it("passes rows with a basis from the list and a retention, and the photo outside the pilot", () => {
    const text = inventory([
      row("E-mail", CONTRACT, "Enquanto a conta existir"),
      row("Foto da cartinha", "fora do piloto", "fora do piloto"),
    ]);
    assert.deepEqual(findInventoryViolations(text), []);
  });

  it("fails an empty basis, citing the Dado", () => {
    const [message] = findInventoryViolations(inventory([row("Apelido", "", "30 dias")]));
    assert.match(message, /Conta e perfil, line \d+ \("Apelido"\): Base legal is empty/u);
  });

  it('fails a basis outside the closed list, such as a bare "contrato"', () => {
    const [message] = findInventoryViolations(inventory([row("Apelido", "contrato", "30 dias")]));
    assert.match(message, /Base legal "contrato" is not in the closed list/u);
  });

  it("fails an empty retention and a retention left for E6.2", () => {
    const [empty, pending, ...rest] = findInventoryViolations(
      inventory([row("Apelido", CONTRACT, ""), row("deviceId", CONTRACT, "a definir na E6.2")]),
    );
    assert.match(empty, /\("Apelido"\): Retenção is empty/u);
    assert.match(pending, /\("deviceId"\): Retenção "a definir na E6.2" is not decided/u);
    assert.deepEqual(rest, []);
  });

  it("fails the old five-column header and a missing table", () => {
    const old = inventory([]).replace(
      HEADER,
      "| Dado | Onde fica | Por quê | Fonte | Na exclusão |",
    );
    assert.match(findInventoryViolations(old)[0], /Conta e perfil: header is/u);
    const missing = inventory([]).replace("## Pagamentos", "## Outra");
    assert.deepEqual(findInventoryViolations(missing), ["Pagamentos: table is missing."]);
  });

  it("fails a row with a missing cell", () => {
    const short = "| Apelido | Postgres (Neon) | Login | 30 dias | ADR 0056 | Apagado |";
    assert.match(findInventoryViolations(inventory([short]))[0], /has 6 cells\. Expected 7/u);
  });
});

describe("findPendingMarkers", () => {
  it("cites the file and the line of each pending decision, in any case", () => {
    const text = "ok\nRetenção: a definir na E6.2.\nConferir na E6.2 se entra.\nfeito na E6.2";
    assert.deepEqual(findPendingMarkers("docs/x.md", text), [
      'docs/x.md:2: "a definir na E6.2" is still pending.',
      'docs/x.md:3: "Conferir na E6.2" is still pending.',
    ]);
  });
});

describe("repository documents", () => {
  it("the inventory has a legal basis and a retention in every row", () => {
    assert.deepEqual(findInventoryViolations(read("docs/seguranca/dados-pessoais.md")), []);
  });

  it("no document leaves a decision for E6.2", () => {
    assert.deepEqual(
      PENDING_SCAN_FILES.flatMap((path) => findPendingMarkers(path, read(path))),
      [],
    );
  });
});
