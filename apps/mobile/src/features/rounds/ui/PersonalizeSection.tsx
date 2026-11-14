import type { GroupSettings, SettingsValue } from "@sacou/match-engine";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { BottomSheet } from "../../../ui/BottomSheet";
import { Button } from "../../../ui/Button";
import { Chip } from "../../../ui/Chip";
import { ChevronDownIcon } from "../../../ui/Icons";
import { Text } from "../../../ui/Text";
import { TextField } from "../../../ui/TextField";
import { choiceOptions } from "../../groups/model/group-settings.selectors";
import type { CreateRoundModel } from "../hooks/use-create-round";
import type { PersonalizePath } from "../model/create-round.reducer";
import {
  groupValueOf,
  layerChangeCount,
  leafText,
  visiblePersonalizePaths,
} from "../model/create-round.selectors";
import { HighlightDot } from "./RoundChips";

const { create, settingTitles } = strings.rounds;
const WHOLE_NUMBER = /^\d+$/;

export interface PersonalizeRowProps {
  readonly path: PersonalizePath;
  readonly group: GroupSettings;
  readonly model: CreateRoundModel;
}

/** One line of the list: the value and "do grupo", or the orange dot with the way back. */
function PersonalizeRow({ path, group, model }: PersonalizeRowProps) {
  const { colors, tokens } = useTheme();
  const own = model.state.layer[path];
  const shown = leafText(path, own ?? groupValueOf(group, path));
  return (
    <View style={{ gap: tokens.spacing.xs, paddingVertical: tokens.spacing.s }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${settingTitles[path]}: ${shown}`}
        onPress={() => {
          model.dispatch({ type: "sheet-opened", sheet: { kind: "setting", path } });
        }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          minHeight: tokens.sizes.settingRowMin,
        }}
      >
        <Text variant="bodyStrong">{settingTitles[path]}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.s6 }}>
          {own === undefined ? null : <HighlightDot color={colors.primary} />}
          <Text variant="bodyStrong">{shown}</Text>
          {own === undefined ? <Text variant="caption">{create.fromGroup}</Text> : null}
        </View>
      </Pressable>
      {own === undefined ? null : (
        <View style={{ gap: tokens.spacing.xs }}>
          <Text variant="caption">
            {`${create.onlyThisRound} · ${create.groupDefault(leafText(path, groupValueOf(group, path)))}`}
          </Text>
          <Button
            variant="link"
            label={create.resetToDefault}
            accessibilityLabel={`${create.resetToDefault}: ${settingTitles[path]}`}
            onPress={() => {
              model.dispatch({ type: "layer-reset", path });
            }}
          />
        </View>
      )}
    </View>
  );
}

export interface NumberDraftSheetProps {
  readonly path: PersonalizePath;
  readonly initial: string;
  readonly onConfirm: (value: SettingsValue) => void;
  readonly onClose: () => void;
}

/** The sheet of a number: the draft lives here, only while the sheet is open (a single field). */
function NumberDraftSheet({ path, initial, onConfirm, onClose }: NumberDraftSheetProps) {
  const [draft, setDraft] = useState(initial);
  const value = WHOLE_NUMBER.test(draft.trim()) ? Number(draft.trim()) : null;
  return (
    <BottomSheet visible title={settingTitles[path]} onClose={onClose}>
      <TextField
        label={settingTitles[path]}
        value={draft}
        keyboardType="number-pad"
        onChangeText={setDraft}
      />
      <Button
        label={create.confirm}
        onPress={() => {
          if (value !== null && value > 0) onConfirm(value);
        }}
      />
      <Button label={create.cancel} variant="link" onPress={onClose} />
    </BottomSheet>
  );
}

export interface SettingSheetProps {
  readonly group: GroupSettings;
  readonly model: CreateRoundModel;
}

/** The options of the leaf being changed, from the catalog; closed unless the reducer says "setting". */
function SettingSheet({ group, model }: SettingSheetProps) {
  const { tokens } = useTheme();
  const { sheet, layer } = model.state;
  if (sheet.kind !== "setting") return null;
  const { path } = sheet;
  const current = layer[path] ?? groupValueOf(group, path);
  const close = () => {
    model.dispatch({ type: "sheet-closed" });
  };
  if (path === "scoring.pointsPerSet") {
    return (
      <NumberDraftSheet
        path={path}
        initial={String(current)}
        onConfirm={(value) => {
          model.setLeaf(path, value);
        }}
        onClose={close}
      />
    );
  }
  return (
    <BottomSheet visible title={settingTitles[path]} onClose={close}>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={settingTitles[path]}
        style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.spacing.s }}
      >
        {choiceOptions(path).map((option) => (
          <Chip
            key={String(option.value)}
            label={option.label}
            selected={option.value === current}
            onPress={() => {
              model.setLeaf(path, option.value);
            }}
          />
        ))}
      </View>
    </BottomSheet>
  );
}

export interface PersonalizeSectionProps {
  readonly group: GroupSettings;
  readonly model: CreateRoundModel;
}

/** The "Personalizar esta rodada" accordion: only what the round may change, with the counter. */
export function PersonalizeSection({ group, model }: PersonalizeSectionProps) {
  const { colors, tokens } = useTheme();
  const paths = visiblePersonalizePaths(group);
  const { personalizeOpen } = model.state;
  const count = layerChangeCount(model.state);
  if (paths.length === 0) return null;
  return (
    <View
      style={{
        borderRadius: tokens.radii.card,
        borderWidth: tokens.borderWidths.thin,
        borderColor: colors.borderCard,
        backgroundColor: colors.surface,
        paddingHorizontal: tokens.spacing.l,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: personalizeOpen }}
        onPress={() => {
          model.dispatch({ type: "personalize-toggled" });
        }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          minHeight: tokens.sizes.blockHeaderMin,
          gap: tokens.spacing.s,
        }}
      >
        <Text variant="bodyStrong" style={{ flex: 1 }}>
          {create.personalize}
        </Text>
        {count > 0 ? <Text variant="caption">{create.changes(count)}</Text> : null}
        <ChevronDownIcon color={colors.text} />
      </Pressable>
      {personalizeOpen
        ? paths.map((path) => (
            <PersonalizeRow key={path} path={path} group={group} model={model} />
          ))
        : null}
      <SettingSheet group={group} model={model} />
    </View>
  );
}
