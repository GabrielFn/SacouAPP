import type { GroupSettings, SettingsPath, SettingsValue } from "@sacou/match-engine";

import { strings } from "../../../strings/pt-BR";
import type { ShownPath } from "../../../strings/settings.pt-BR";
import {
  blockSummary,
  fieldValueText,
  isBlockEnabled,
  isProLeaf,
  liberoNote,
} from "../model/group-settings.selectors";
import { queueRuleSummary } from "../model/queue-rule";
import { scheduleText } from "../model/schedule-text";
import { leafOf } from "../model/settings-patch";
import { visibleRows, type BlockSpec, type RowSpec } from "../model/settings-layout";
import { BlockFrame, BlockHeader } from "./BlockParts";
import { ChoiceRow, HelpLine, QueueRuleRow, SwitchRow, ValueRow } from "./SettingRows";

const { blocks, fields, rotationHelp } = strings.settings;

export interface SettingsBlockViewProps {
  readonly spec: BlockSpec;
  /** The document with what the person changed on top (`visibleSettings`). */
  readonly settings: GroupSettings;
  readonly editable: boolean;
  readonly expanded: boolean;
  readonly onToggleExpanded: () => void;
  readonly onLeafChange: (path: SettingsPath, value: SettingsValue) => void;
  readonly onOpenField: (path: ShownPath) => void;
  readonly onOpenSchedule: () => void;
  readonly onOpenQueueRule: () => void;
}

interface BlockText {
  readonly title: string;
  readonly caption?: string;
}

type BlockTexts = Readonly<Record<BlockSpec["block"], BlockText>>;

const BLOCK_TEXT: BlockTexts = blocks;

function summaryOf(spec: BlockSpec, settings: GroupSettings): string | null {
  if (!spec.accordion) return null;
  return spec.block === "attendance" || spec.block === "scoring"
    ? blockSummary(spec.block, settings)
    : null;
}

/** One card of screen 18: a header with the switch of the block and the lines that apply to it. */
export function SettingsBlockView(props: SettingsBlockViewProps) {
  const { spec, settings, editable, expanded, onToggleExpanded, onLeafChange } = props;
  const text = BLOCK_TEXT[spec.block];
  const enabled = isBlockEnabled(spec.block, settings);
  const showRows = enabled && (!spec.accordion || expanded);
  return (
    <BlockFrame title={text.title}>
      <BlockHeader
        title={text.title}
        caption={text.caption}
        summary={summaryOf(spec, settings)}
        expanded={expanded}
        enabled={enabled}
        editable={editable}
        onToggleExpanded={onToggleExpanded}
        onEnabledChange={(value) => {
          onLeafChange(`${spec.block}.enabled` as SettingsPath, value);
        }}
      />
      {showRows
        ? visibleRows(spec, settings).map((row) => (
            <RowView key={rowKey(row)} row={row} {...props} />
          ))
        : null}
      {showRows && spec.block === "rotation" ? <HelpLine text={rotationNote(settings)} /> : null}
    </BlockFrame>
  );
}

function rotationNote(settings: GroupSettings): string {
  return `${rotationHelp.libero} ${rotationHelp.now(liberoNote(settings))}`;
}

function rowKey(row: RowSpec): string {
  return "path" in row ? row.path : row.kind;
}

export interface RowViewProps extends SettingsBlockViewProps {
  readonly row: RowSpec;
}

function RowView({
  row,
  settings,
  editable,
  onLeafChange,
  onOpenField,
  onOpenSchedule,
  onOpenQueueRule,
}: RowViewProps) {
  switch (row.kind) {
    case "switch":
      return (
        <SwitchRow
          path={row.path}
          label={fields[row.path]}
          checked={leafOf(settings, row.path) === true}
          pro={isProLeaf(row.path)}
          editable={editable}
          onChange={onLeafChange}
        />
      );
    case "margin":
      return (
        <SwitchRow
          path={row.path}
          label={fields[row.path]}
          checked={leafOf(settings, row.path) === row.on}
          pro={false}
          editable={editable}
          onChange={(path, checked) => {
            onLeafChange(path, checked === true ? row.on : row.off);
          }}
        />
      );
    case "field":
      return (
        <ValueRow
          label={fields[row.path]}
          value={fieldValueText(row.path, settings)}
          editable={editable}
          onPress={() => {
            onOpenField(row.path);
          }}
        />
      );
    case "schedule":
      return (
        <ValueRow
          label={strings.createGroup.step2.schedule}
          value={scheduleText(settings.schedule.weekday, settings.schedule.startTime)}
          editable={editable}
          onPress={onOpenSchedule}
        />
      );
    case "choice":
      return (
        <ChoiceRow
          path={row.path}
          label={fields[row.path]}
          layout={row.layout}
          selected={leafOf(settings, row.path)}
          editable={editable}
          onChange={onLeafChange}
        />
      );
    case "queue-rule":
      return (
        <QueueRuleRow
          summary={queueRuleSummary(settings.queue)}
          editable={editable}
          onPress={onOpenQueueRule}
        />
      );
  }
}
