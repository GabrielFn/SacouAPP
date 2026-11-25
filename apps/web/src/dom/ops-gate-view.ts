import { countText, weekLabel } from "../ops-page/ops-format";
import type { OpsMetrics } from "../ops-page/ops-page.types";
import { webStrings } from "../strings.pt-BR";

import type { OpsSection } from "./ops-view";

/** A rate as the page writes it: "67%", or "—" when nothing was counted (criterion 20). */
export function rateText(rate: number | null): string {
  return rate === null ? webStrings.ops.none : webStrings.ops.percent(rate);
}

/** "Grupos" (criterion 17). */
export function groupsSection(metrics: OpsMetrics): OpsSection {
  const text = webStrings.ops.groups;
  return {
    title: text.title,
    facts: [
      { label: text.total, value: countText(metrics.groups.total) },
      { label: text.active, value: countText(metrics.groups.active) },
    ],
    note: null,
    table: null,
  };
}

/** "Rodadas" (criterion 18). */
export function roundsSection(metrics: OpsMetrics): OpsSection {
  const { rounds } = metrics;
  const text = webStrings.ops.rounds;
  return {
    title: text.title,
    facts: [
      { label: text.created, value: countText(rounds.created) },
      { label: text.held, value: countText(rounds.held) },
      { label: text.closed, value: countText(rounds.closed) },
      { label: text.canceled, value: countText(rounds.canceled) },
    ],
    note: null,
    table: {
      caption: text.weeksCaption,
      headers: [webStrings.ops.week, text.createdColumn],
      rows: rounds.weeks.map((week) => [weekLabel(week.weekStart), countText(week.created)]),
    },
  };
}

/** "Portão" (criteria 19, 20 and 22): the total, the target beside it, and each week shown. */
export function gateSection(metrics: OpsMetrics): OpsSection {
  const { gate } = metrics;
  const text = webStrings.ops.gate;
  const target = rateText(gate.target);
  return {
    title: text.title,
    facts: [
      { label: text.rate, value: rateText(gate.total.rate) },
      { label: text.target, value: target },
      { label: text.linkRate, value: rateText(gate.total.linkRate) },
    ],
    note: text.meeting(gate.groupsMeeting, gate.groupsGoal),
    table: {
      caption: text.weeksCaption,
      headers: [
        webStrings.ops.week,
        text.rounds,
        text.confirmed,
        text.gateColumn,
        text.linkColumn,
        text.targetColumn,
      ],
      rows: gate.weeks.map((week) => [
        weekLabel(week.weekStart),
        countText(week.count.rounds),
        countText(week.count.confirmed),
        rateText(week.count.rate),
        rateText(week.count.linkRate),
        target,
      ]),
    },
  };
}

/** "Portão por grupo" (criterion 21): each group by its creation, with its name. */
export function byGroupSection(metrics: OpsMetrics): OpsSection {
  const { gate } = metrics;
  const text = webStrings.ops.byGroup;
  return {
    title: text.title,
    facts: [],
    note: null,
    table: {
      caption: text.caption(gate.requiredWeeks, rateText(gate.target)),
      headers: [text.group, text.held, text.confirmed, text.gate, text.streak, text.meets],
      rows: gate.byGroup.map((group) => [
        group.name,
        countText(group.count.rounds),
        countText(group.count.confirmed),
        rateText(group.count.rate),
        countText(group.longestStreak),
        group.meetsGate ? text.yes : text.no,
      ]),
    },
  };
}
