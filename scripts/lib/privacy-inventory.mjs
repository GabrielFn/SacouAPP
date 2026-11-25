// Personal data inventory gate (E6.2): every row of docs/seguranca/dados-pessoais.md has a legal basis
// from the closed list and a retention, and no document leaves a decision pending on E6.2.

/** The closed list of legal bases (LGPD art. 7), plus the two markers for rows outside the law or the pilot. */
export const LEGAL_BASES = Object.freeze([
  "execução de contrato (art. 7, V)",
  "legítimo interesse (art. 7, IX)",
  "obrigação legal (art. 7, II)",
  "consentimento (art. 7, I)",
  "exercício de direitos (art. 7, VI)",
  "não é dado pessoal",
  "fora do piloto",
]);

/** The tables of the inventory whose rows must carry a legal basis and a retention. */
export const INVENTORY_TABLES = Object.freeze([
  "Conta e perfil",
  "Grupo e rodada",
  "Pagamentos",
  "Serviços externos",
]);

export const INVENTORY_HEADER = Object.freeze([
  "Dado",
  "Onde fica",
  "Por quê",
  "Base legal",
  "Retenção",
  "Fonte",
  "Na exclusão",
]);

/** Documents that may not leave a decision for E6.2, relative to the repository root. */
export const PENDING_SCAN_FILES = Object.freeze([
  "docs/seguranca/dados-pessoais.md",
  "docs/seguranca/checklist.md",
  "docs/legal/politica-de-privacidade.md",
]);

const PENDING_MARKER = /\b(a definir|conferir|a decidir|a registrar|reavaliar) na E6\.2\b/iu;
const UNDECIDED_RETENTION = /^a definir\b/iu;
const SECTION_PREFIX = "## ";
const DADO_PREVIEW_LENGTH = 50;

function cellsOf(line) {
  return line
    .trim()
    .replace(/^\|/u, "")
    .replace(/\|$/u, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isSeparator(line) {
  return /^\|[\s|:-]+\|$/u.test(line.trim());
}

/** Splits the inventory into its `##` sections, each with its table rows as arrays of cells. */
export function parseInventory(text) {
  const lines = text.split("\n").map((content, index) => ({ content, line: index + 1 }));
  const starts = lines.filter(({ content }) => content.startsWith(SECTION_PREFIX));
  return starts.map((start, position) => {
    const end = starts[position + 1]?.line ?? lines.length + 1;
    const tableRows = lines
      .slice(start.line, end - 1)
      .filter(({ content }) => content.trim().startsWith("|") && !isSeparator(content))
      .map(({ content, line }) => ({ line, cells: cellsOf(content) }));
    return {
      title: start.content.slice(SECTION_PREFIX.length).trim(),
      header: tableRows[0]?.cells,
      rows: tableRows.slice(1),
    };
  });
}

function preview(dado) {
  return dado.length > DADO_PREVIEW_LENGTH ? `${dado.slice(0, DADO_PREVIEW_LENGTH)}...` : dado;
}

function rowViolations(title, { line, cells }) {
  const at = `${title}, line ${line} ("${preview(cells[0] ?? "")}")`;
  if (cells.length !== INVENTORY_HEADER.length) {
    return [`${at}: has ${cells.length} cells. Expected ${INVENTORY_HEADER.length}.`];
  }
  const basis = cells[INVENTORY_HEADER.indexOf("Base legal")];
  const retention = cells[INVENTORY_HEADER.indexOf("Retenção")];
  const found = [];
  if (basis === "") {
    found.push(`${at}: Base legal is empty.`);
  } else if (!LEGAL_BASES.includes(basis)) {
    found.push(`${at}: Base legal "${basis}" is not in the closed list.`);
  }
  if (retention === "") {
    found.push(`${at}: Retenção is empty.`);
  } else if (UNDECIDED_RETENTION.test(retention) || PENDING_MARKER.test(retention)) {
    found.push(`${at}: Retenção "${retention}" is not decided.`);
  }
  return found;
}

/** Returns one message per missing table, wrong header or row without a valid legal basis and retention. */
export function findInventoryViolations(text) {
  const sections = parseInventory(text);
  return INVENTORY_TABLES.flatMap((title) => {
    const section = sections.find((candidate) => candidate.title === title);
    if (section === undefined || section.header === undefined) {
      return [`${title}: table is missing.`];
    }
    if (section.header.join("|") !== INVENTORY_HEADER.join("|")) {
      return [
        `${title}: header is "${section.header.join(" | ")}". Expected "${INVENTORY_HEADER.join(" | ")}".`,
      ];
    }
    return section.rows.flatMap((row) => rowViolations(title, row));
  });
}

/** Returns one message per line of a document that still leaves a decision for E6.2. */
export function findPendingMarkers(path, text) {
  return text
    .split("\n")
    .map((line, index) => ({ line: index + 1, match: PENDING_MARKER.exec(line) }))
    .filter(({ match }) => match !== null)
    .map(({ line, match }) => `${path}:${line}: "${match[0]}" is still pending.`);
}
