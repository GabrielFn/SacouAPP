import type { GroupSettings, SettingsPath, SettingsValue } from "@sacou/match-engine";
import { Pressable, View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { ChevronDownIcon } from "../../../ui/Icons";
import { Switch } from "../../../ui/Switch";
import { Text } from "../../../ui/Text";
import {
  blockSummary,
  fieldValueText,
  isBlockEnabled,
  isProLeaf,
  liberoNote,
} from "../model/group-settings.selectors";
import { scheduleText } from "../model/schedule-text";
import { leafOf } from "../model/settings-patch";
import { visibleRows, type BlockSpec, type RowSpec } from "../model/settings-layout";
import { ChoiceRow, HelpLine, QueueRuleRow, SwitchRow, ValueRow } from "./SettingRows";

const { blocks, fields, screen, rotationHelp } = strings.settings;

export interface SettingsBlockViewProps {
  readonly spec: BlockSpec;
  /** The document with what the person changed on top (`visibleSettings`). */
  readonly settings: GroupSettings;
  readonly editable: boolean;
  readonly expanded: boolean;
  readonly onToggleExpanded: () => void;
  readonly onLeafChange: (path: SettingsPath, value: SettingsValue) => void;
  readonly onOpenField: (path: SettingsPath) => void;
  readonly onOpenSchedule: () => void;
}

interface BlockText {
  readonly title: string;
  readonly caption?: string;
}

const BLOCK_TEXT: Readonly<Record<BlockSpec["block"], BlockText>> = blocks;

export interface BlockHeaderProps {
  readonly title: string;
  readonly caption?: string;
  /** The line under the title of an accordion; `null` for a block that is always open. */
  readonly summary: string | null;
  readonly expanded: boolean;
  readonly enabled: boolean;
  readonly editable: boolean;
  readonly onToggleExpanded: () => void;
  readonly onEnabledChange: (enabled: boolean) => void;
}

/** The head of a block: title (and summary with a chevron, for an accordion) and the block switch. */
function BlockHeader({
  title,
  caption,
  summary,
  expanded,
  enabled,
  editable,
  onToggleExpanded,
  onEnabledChange,
}: BlockHeaderProps) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        minHeight: tokens.sizes.blockHeaderMin,
        paddingLeft: tokens.spacing.s14,
        paddingRight: tokens.spacing.s6,
        gap: tokens.spacing.s,
      }}
    >
      {summary === null ? (
        <View
          style={{ flex: 1, flexDirection: "row", alignItems: "baseline", gap: tokens.spacing.s }}
        >
          <Text variant="title" accessibilityRole="header">
            {title}
          </Text>
          {caption === undefined ? null : <Text variant="caption">{caption}</Text>}
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={expanded ? screen.collapse(title) : screen.expand(title)}
          onPress={onToggleExpanded}
          style={{
            flex: 1,
            minHeight: tokens.sizes.blockHeaderMin,
            flexDirection: "row",
            alignItems: "center",
            gap: tokens.spacing.s,
            paddingVertical: tokens.spacing.s,
          }}
        >
          <View style={{ flex: 1, gap: tokens.spacing.xs }}>
            <Text variant="title">{title}</Text>
            <Text variant="caption">{summary}</Text>
          </View>
          <ChevronDownIcon />
        </Pressable>
      )}
      <Switch
        accessibilityLabel={title}
        checked={enabled}
        disabled={!editable}
        onChange={onEnabledChange}
      />
    </View>
  );
}

function summaryOf(spec: BlockSpec, settings: GroupSettings): string | null {
  if (!spec.accordion) return null;
  return spec.block === "attendance" || spec.block === "scoring"
    ? blockSummary(spec.block, settings)
    : null;
}

/** One card of screen 18: a header with the switch of the block and the lines that apply to it. */
export function SettingsBlockView(props: SettingsBlockViewProps) {
  const { spec, settings, editable, expanded, onToggleExpanded, onLeafChange } = props;
  const { colors, tokens } = useTheme();
  const text = BLOCK_TEXT[spec.block];
  const enabled = isBlockEnabled(spec.block, settings);
  const showRows = enabled && (!spec.accordion || expanded);
  return (
    <View
      accessibilityLabel={text.title}
      style={{
        backgroundColor: colors.surface,
        borderWidth: tokens.borderWidths.thin,
        borderColor: colors.borderCard,
        borderRadius: tokens.radii.tile,
        overflow: "hidden",
      }}
    >
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
    </View>
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
      return <QueueRuleRow />;
  }
}
