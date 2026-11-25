import type { OpsElements, OpsSection, OpsTable, SectionsSlot } from "./ops-view";
import { findSheetNodes, requiredById, type DocumentLike, type SheetNodes } from "./page-elements";

/** The ids `Web/Pages/Ops.cshtml` renders; the sheet's come from `Shared/_SignInSheet.cshtml`. */
export const OPS_IDS = {
  root: "ops-page",
  status: "page-status",
  updated: "ops-updated",
  signIn: "ops-sign-in",
  reload: "ops-refresh",
  signOut: "sign-out",
  sections: "ops-sections",
} as const;

/** The dashboard's nodes, the ones the view draws and the ones the script listens to. */
export interface OpsNodes extends SheetNodes, Omit<OpsElements, keyof SheetNodes> {
  readonly signIn: HTMLButtonElement;
  readonly reload: HTMLButtonElement;
  readonly signOut: HTMLButtonElement;
}

/** The part of `document` that builds nodes: elements and text only, never HTML. */
export interface NodeFactory {
  createElement<K extends keyof HTMLElementTagNameMap>(tag: K): HTMLElementTagNameMap[K];
}

function element<K extends keyof HTMLElementTagNameMap>(
  factory: NodeFactory,
  tag: K,
  text: string,
  className = "",
): HTMLElementTagNameMap[K] {
  const node = factory.createElement(tag);
  node.textContent = text;
  if (className !== "") node.classList.add(className);
  return node;
}

function tableOf(factory: NodeFactory, table: OpsTable): HTMLElement {
  const wrap = element(factory, "div", "", "ops-table-wrap");
  const node = factory.createElement("table");
  node.classList.add("ops-table");
  node.append(element(factory, "caption", table.caption));
  const head = factory.createElement("tr");
  head.append(...table.headers.map((header) => element(factory, "th", header)));
  node.append(head);
  for (const row of table.rows) {
    const line = factory.createElement("tr");
    line.append(...row.map((cell, index) => element(factory, index === 0 ? "th" : "td", cell)));
    node.append(line);
  }
  wrap.append(node);
  return wrap;
}

function sectionOf(factory: NodeFactory, section: OpsSection): HTMLElement {
  const node = element(factory, "section", "", "ops-section");
  node.append(element(factory, "h2", section.title));
  const facts = element(factory, "dl", "", "ops-facts");
  for (const fact of section.facts) {
    const item = element(factory, "div", "", "ops-fact");
    item.append(element(factory, "dt", fact.label), element(factory, "dd", fact.value));
    facts.append(item);
  }
  node.append(facts);
  if (section.note !== null) node.append(element(factory, "p", section.note, "ops-note"));
  if (section.table !== null) node.append(tableOf(factory, section.table));
  return node;
}

/** `#ops-sections`, emptied and filled again with nodes made of text (lint forbids `innerHTML` and the like). */
export function sectionsSlot(host: HTMLElement, factory: NodeFactory): SectionsSlot {
  return {
    show: (sections) => {
      host.replaceChildren(...sections.map((section) => sectionOf(factory, section)));
    },
  };
}

export function findOpsElements(document: DocumentLike & NodeFactory): OpsNodes {
  return {
    ...findSheetNodes(document),
    status: requiredById(document, OPS_IDS.status, HTMLElement),
    updated: requiredById(document, OPS_IDS.updated, HTMLElement),
    signIn: requiredById(document, OPS_IDS.signIn, HTMLButtonElement),
    reload: requiredById(document, OPS_IDS.reload, HTMLButtonElement),
    signOut: requiredById(document, OPS_IDS.signOut, HTMLButtonElement),
    sections: sectionsSlot(requiredById(document, OPS_IDS.sections, HTMLElement), document),
  };
}
