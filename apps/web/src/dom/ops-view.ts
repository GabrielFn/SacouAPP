import { countText, timeInSaoPaulo, weekLabel } from "../ops-page/ops-format";
import type { OpsFailure, OpsMetrics, OpsPageState, OpsStep } from "../ops-page/ops-page.types";
import type { SheetForm } from "../round-page/round-page.types";
import { failureText, webStrings } from "../strings.pt-BR";

import {
  renderSignInSheet,
  write,
  type Control,
  type SheetElements,
  type SheetView,
  type TextSlot,
  type ViewEnvironment,
} from "./sign-in-sheet";

/** One line of a section: a label and its number, already written as text. */
export interface OpsFact {
  readonly label: string;
  readonly value: string;
}

export interface OpsTable {
  readonly caption: string;
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

/** A section of the dashboard, all text: the DOM only puts it on the page. */
export interface OpsSection {
  readonly title: string;
  readonly facts: readonly OpsFact[];
  readonly table: OpsTable | null;
}

/** Where the sections go: the page's `#ops-sections`, emptied and filled again on each state. */
export interface SectionsSlot {
  show(sections: readonly OpsSection[]): void;
}

/** The nodes of `Web/Pages/Ops.cshtml` the script drives, and the sheet. Text through `textContent` only. */
export interface OpsElements extends SheetElements {
  readonly status: TextSlot;
  readonly updated: TextSlot;
  readonly signIn: Control;
  readonly reload: Control;
  readonly signOut: Control;
  readonly sections: SectionsSlot;
}

/** Everything the page shows, from the state alone. */
export interface OpsView {
  readonly status: string | null;
  readonly updated: string | null;
  readonly signIn: boolean;
  readonly reload: string | null;
  readonly signOut: boolean;
  readonly sections: readonly OpsSection[];
  readonly sheet: SheetView;
}

const BUSY_STEPS = new Set<OpsStep>(["starting", "signingIn", "loading"]);
const SIGNED_IN_STEPS = new Set<OpsStep>(["ready", "denied", "failed"]);

function sheetFormOf(state: OpsPageState): SheetForm | null {
  if (state.step === "signIn") return state.form;
  if (state.step === "signingIn") return state.attempt === "google" ? "choice" : state.attempt;
  return null;
}

function sheetMessage(state: OpsPageState): string | null {
  if (state.step === "signIn") {
    if (state.failure !== null) return failureText(state.failure);
    return state.notice === "resetSent" ? webStrings.resetSent : null;
  }
  return state.step === "signingIn" ? webStrings.working : null;
}

function sheetView(state: OpsPageState): SheetView {
  const form = sheetFormOf(state);
  return {
    form,
    title: form === null || form === "choice" ? webStrings.ops.sheetTitle : webStrings.sheet[form],
    busy: BUSY_STEPS.has(state.step),
    message: sheetMessage(state),
  };
}

function failureLine(failure: OpsFailure): string {
  return failure.kind === "rateLimited"
    ? webStrings.ops.rateLimited(failure.retryAfterSeconds)
    : webStrings.ops.unavailable;
}

function statusOf(state: OpsPageState): string | null {
  switch (state.step) {
    case "loading":
      return webStrings.ops.loading;
    case "denied":
      return webStrings.ops.denied;
    case "failed":
      return failureLine(state.failure);
    case "starting":
    case "signIn":
    case "signingIn":
    case "ready":
      return null;
  }
}

function reloadOf(state: OpsPageState): string | null {
  if (state.step === "ready") return webStrings.ops.refresh;
  return state.step === "failed" ? webStrings.ops.retry : null;
}

function updatedOf(metrics: OpsMetrics): string {
  return webStrings.ops.updated(
    webStrings.ops.environment[metrics.environment],
    timeInSaoPaulo(metrics.generatedAt),
  );
}

/** "Usuários": the totals, and each week with its new and erased accounts (criterion 6). */
export function usersSection(metrics: OpsMetrics): OpsSection {
  const { users } = metrics;
  const text = webStrings.ops.users;
  return {
    title: text.title,
    facts: [
      { label: text.registered, value: countText(users.registered) },
      { label: text.deleted, value: countText(users.deleted) },
    ],
    table: {
      caption: text.weeksCaption,
      headers: [webStrings.ops.week, text.newColumn, text.deletedColumn],
      rows: users.weeks.map((week) => [
        weekLabel(week.weekStart),
        countText(week.registered),
        countText(week.deleted),
      ]),
    },
  };
}

/** The sections of the numbers, in the page's order. */
export function sectionsOf(metrics: OpsMetrics): readonly OpsSection[] {
  return [usersSection(metrics)];
}

/** The whole page from the state: only `ready` has numbers, so no other step can show any. */
export function opsView(state: OpsPageState): OpsView {
  return {
    status: statusOf(state),
    updated: state.step === "ready" ? updatedOf(state.metrics) : null,
    signIn: state.step === "signIn" && state.form === null,
    reload: reloadOf(state),
    signOut: SIGNED_IN_STEPS.has(state.step),
    sections: state.step === "ready" ? sectionsOf(state.metrics) : [],
    sheet: sheetView(state),
  };
}

export function renderOpsPage(
  elements: OpsElements,
  state: OpsPageState,
  environment: ViewEnvironment,
): void {
  const view = opsView(state);
  write(elements.status, view.status);
  write(elements.updated, view.updated);
  elements.signIn.hidden = !view.signIn;
  elements.signIn.disabled = false;
  write(elements.reload, view.reload);
  elements.reload.disabled = false;
  elements.signOut.hidden = !view.signOut;
  elements.signOut.disabled = false;
  elements.sections.show(view.sections);
  renderSignInSheet(elements, view.sheet, environment);
}
