import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { fontFamilies } from "../../../theme/tokens.data";
import { EmptyState } from "../../../ui/EmptyState";
import { ErrorStrip } from "../../../ui/ErrorStrip";
import { BackIcon } from "../../../ui/Icons";
import { IconButton } from "../../../ui/IconButton";
import { LoadingState } from "../../../ui/LoadingState";
import { OfflineBanner } from "../../../ui/OfflineBanner";
import { Screen } from "../../../ui/Screen";
import { Text } from "../../../ui/Text";
import { useGroupSettingsScreen } from "../hooks/use-group-settings-screen";
import { templateLabelText } from "../model/group-settings.selectors";
import { SETTINGS_SCREEN } from "../model/settings-layout";
import { groupsHref } from "../navigation";
import { ScheduleSheet } from "./ScheduleSheet";
import { SettingsBlockView } from "./SettingsBlockView";
import { TemplatePickerSheet } from "./TemplatePickerSheet";
import { TextSheet } from "./TextSheet";

const { screen, sheets, fields } = strings.settings;

export interface GroupSettingsScreenProps {
  readonly groupId: string;
}

/** Screen 18, "Como jogamos": the rules of the group, saved on each touch (D4). */
export function GroupSettingsScreen({ groupId }: GroupSettingsScreenProps) {
  const router = useRouter();
  const { colors, tokens } = useTheme();
  const model = useGroupSettingsScreen(groupId);
  const { ready, form } = model;
  const header = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.s }}>
      <IconButton
        accessibilityLabel={strings.a11y.back}
        onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace(groupsHref);
        }}
      >
        <BackIcon />
      </IconButton>
      <Text variant="display" displaySize="displayMedium" accessibilityRole="header">
        {screen.title}
      </Text>
    </View>
  );
  if (ready === null) {
    return (
      <Screen>
        {header}
        {model.failure === null ? (
          <LoadingState accessibilityLabel={screen.loading} />
        ) : (
          <EmptyState
            alert
            title={screen.errorTitle}
            body={model.failure.text}
            actions={[{ label: screen.retry, variant: "secondary", onPress: model.retry }]}
          />
        )}
      </Screen>
    );
  }
  const { group, settings, canManage } = ready;
  const sheet = form.sheet;
  return (
    <Screen scroll>
      {header}
      <Text variant="muted">{screen.subtitle(group.name)}</Text>
      {model.bannerText !== null ? <OfflineBanner text={model.bannerText} /> : null}
      {form.message !== null ? <ErrorStrip text={form.message} /> : null}
      <View
        style={{
          minHeight: tokens.sizes.settingRowMin,
          flexDirection: "row",
          alignItems: "center",
          gap: tokens.spacing.s,
          paddingLeft: tokens.spacing.s14,
          borderRadius: tokens.radii.button,
          backgroundColor: colors.badgeSurface,
        }}
      >
        <Text variant="muted">{screen.templateUsed}</Text>
        <Pressable
          accessibilityRole={canManage ? "button" : "text"}
          accessibilityLabel={`${screen.templateUsed}: ${templateLabelText(ready.templateLabel)}`}
          disabled={!canManage}
          onPress={model.openPicker}
          style={{ flex: 1, minHeight: tokens.sizes.switchTarget, justifyContent: "center" }}
        >
          <Text
            numberOfLines={1}
            style={{ fontFamily: fontFamilies.body700, fontSize: tokens.fontSizes.body }}
          >
            {templateLabelText(ready.templateLabel)}
          </Text>
        </Pressable>
        {canManage ? (
          <Pressable
            accessibilityRole="button"
            onPress={model.openSave}
            style={{
              minHeight: tokens.sizes.switchTarget,
              justifyContent: "center",
              paddingHorizontal: tokens.spacing.s10,
            }}
          >
            <Text
              style={{
                color: colors.link,
                fontFamily: fontFamilies.body700,
                fontSize: tokens.fontSizes.small,
              }}
            >
              {screen.saveAsTemplate}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {SETTINGS_SCREEN.map((spec) => (
        <SettingsBlockView
          key={spec.block}
          spec={spec}
          settings={settings}
          editable={canManage}
          expanded={form.expanded === spec.block}
          onToggleExpanded={() => {
            model.toggleBlock(spec.block);
          }}
          onLeafChange={model.changeLeaf}
          onOpenField={model.openField}
          onOpenSchedule={model.openSchedule}
        />
      ))}
      <TextSheet
        visible={sheet.kind === "field"}
        title={sheet.kind === "field" ? fields[sheet.path] : ""}
        label={sheet.kind === "field" ? fields[sheet.path] : ""}
        value={sheet.kind === "field" ? sheet.text : ""}
        hint={sheet.kind === "field" && sheet.path.endsWith("Cents") ? sheets.moneyHint : undefined}
        error={sheet.kind === "field" ? model.sheetError : null}
        keyboardType={sheet.kind === "field" && sheet.path.endsWith("Cents") ? "decimal-pad" : "default"}
        canConfirm={model.canConfirmSheet}
        onChange={model.setSheetText}
        onConfirm={model.confirmSheet}
        onCancel={model.cancelSheet}
      />
      <TextSheet
        visible={sheet.kind === "save-template"}
        title={sheets.saveTitle}
        label={sheets.saveName}
        value={sheet.kind === "save-template" ? sheet.name : ""}
        placeholder={sheets.saveNamePlaceholder}
        error={sheet.kind === "save-template" ? model.sheetError : null}
        confirmLabel={sheets.save}
        canConfirm={model.canConfirmSheet}
        onChange={model.setSheetText}
        onConfirm={model.confirmSheet}
        onCancel={model.cancelSheet}
      />
      <ScheduleSheet
        visible={sheet.kind === "schedule"}
        weekday={sheet.kind === "schedule" ? sheet.weekday : settings.schedule.weekday}
        time={sheet.kind === "schedule" ? sheet.time : settings.schedule.startTime}
        error={sheet.kind === "schedule" ? (model.sheetError ?? undefined) : undefined}
        onWeekdayChange={model.setSheetWeekday}
        onTimeChange={model.setSheetText}
        onConfirm={model.confirmSheet}
        onCancel={model.cancelSheet}
      />
      <TemplatePickerSheet
        visible={sheet.kind === "template-picker"}
        saved={ready.saved}
        onApply={model.applyTemplate}
        onDelete={model.deleteTemplate}
        onClose={model.cancelSheet}
      />
    </Screen>
  );
}
