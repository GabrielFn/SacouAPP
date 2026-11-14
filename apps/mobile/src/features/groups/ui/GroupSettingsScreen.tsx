import { useRouter } from "expo-router";

import { strings } from "../../../strings/pt-BR";
import { EmptyState } from "../../../ui/EmptyState";
import { ErrorStrip } from "../../../ui/ErrorStrip";
import { LoadingState } from "../../../ui/LoadingState";
import { OfflineBanner } from "../../../ui/OfflineBanner";
import { Screen } from "../../../ui/Screen";
import { Text } from "../../../ui/Text";
import { useGroupSettingsScreen } from "../hooks/use-group-settings-screen";
import { templateLabelText } from "../model/group-settings.selectors";
import { queueRuleHref } from "../navigation";
import { SETTINGS_SCREEN } from "../model/settings-layout";
import { SettingsBlockView } from "./SettingsBlockView";
import { SettingsHeader } from "./SettingsHeader";
import { SettingsSheets } from "./SettingsSheets";
import { TemplateUsedRow } from "./TemplateUsedRow";

const { screen } = strings.settings;

export interface GroupSettingsScreenProps {
  readonly groupId: string;
}

/** Screen 18, "Como jogamos": the rules of the group, saved on each touch (D4). */
export function GroupSettingsScreen({ groupId }: GroupSettingsScreenProps) {
  const router = useRouter();
  const model = useGroupSettingsScreen(groupId);
  const { ready, form } = model;
  if (ready === null) {
    return (
      <Screen>
        <SettingsHeader />
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
  return (
    <Screen scroll>
      <SettingsHeader />
      <Text variant="muted">{screen.subtitle(ready.group.name)}</Text>
      {model.bannerText !== null ? <OfflineBanner text={model.bannerText} /> : null}
      {form.message !== null ? <ErrorStrip text={form.message} /> : null}
      <TemplateUsedRow
        name={templateLabelText(ready.templateLabel)}
        canManage={ready.canManage}
        onOpenPicker={model.openPicker}
        onOpenSave={model.openSave}
      />
      {SETTINGS_SCREEN.map((spec) => (
        <SettingsBlockView
          key={spec.block}
          spec={spec}
          settings={ready.settings}
          editable={ready.canManage}
          expanded={form.expanded === spec.block}
          onToggleExpanded={() => {
            model.toggleBlock(spec.block);
          }}
          onLeafChange={model.changeLeaf}
          onOpenField={model.openField}
          onOpenSchedule={model.openSchedule}
          onOpenQueueRule={() => {
            router.push(queueRuleHref(groupId));
          }}
        />
      ))}
      <SettingsSheets model={model} ready={ready} />
    </Screen>
  );
}
