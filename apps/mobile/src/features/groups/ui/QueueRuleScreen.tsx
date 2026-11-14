import { useRouter } from "expo-router";
import { View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { BackBar } from "../../../ui/BackBar";
import { Button } from "../../../ui/Button";
import { EmptyState } from "../../../ui/EmptyState";
import { ErrorStrip } from "../../../ui/ErrorStrip";
import { LoadingState } from "../../../ui/LoadingState";
import { OfflineBanner } from "../../../ui/OfflineBanner";
import { Screen } from "../../../ui/Screen";
import { Text } from "../../../ui/Text";
import { useQueueRuleForm } from "../hooks/use-queue-rule-form";
import { useSettingsData } from "../hooks/use-settings-data";
import { groupSettingsHref } from "../navigation";
import type { SettingsReady } from "../model/settings-screen-state";
import { LoserOptions, WinnerOptions } from "./QueueRuleOptions";

const { queueRuleScreen: texts, screen } = strings.settings;
const NO_PENDING = {};

export interface QueueRuleScreenProps {
  readonly groupId: string;
}

export interface QueueRuleFormProps {
  readonly groupId: string;
  readonly ready: SettingsReady;
  readonly bannerText: string | null;
}

function QueueRuleForm({ groupId, ready, bannerText }: QueueRuleFormProps) {
  const router = useRouter();
  const { tokens } = useTheme();
  const form = useQueueRuleForm(groupId, ready.settings, () => {
    if (router.canGoBack()) router.back();
    else router.replace(groupSettingsHref(groupId));
  });
  const { draft, message } = form.state;
  return (
    <Screen
      scroll
      footer={
        <Button
          label={form.pending ? texts.saving : texts.save}
          disabled={!ready.canManage || form.pending}
          onPress={form.save}
        />
      }
    >
      <BackBar title={texts.title} fallbackHref={groupSettingsHref(groupId)} look="heading" />
      <Text variant="muted">{texts.subtitle(ready.group.name)}</Text>
      {bannerText !== null ? <OfflineBanner text={bannerText} /> : null}
      {message !== null ? <ErrorStrip text={message} /> : null}
      {ready.canManage ? null : <Text variant="caption">{texts.readOnly}</Text>}
      <View style={{ gap: tokens.spacing.s }}>
        <LoserOptions draft={draft} editable={ready.canManage} dispatch={form.dispatch} />
        <WinnerOptions draft={draft} editable={ready.canManage} dispatch={form.dispatch} />
      </View>
    </Screen>
  );
}

export interface QueueRuleLoadingProps {
  readonly groupId: string;
  readonly failureText: string | null;
  readonly onRetry: () => void;
}

function QueueRuleLoading({ groupId, failureText, onRetry }: QueueRuleLoadingProps) {
  return (
    <Screen>
      <BackBar title={texts.title} fallbackHref={groupSettingsHref(groupId)} look="heading" />
      {failureText === null ? (
        <LoadingState accessibilityLabel={screen.loading} />
      ) : (
        <EmptyState
          alert
          title={screen.errorTitle}
          body={failureText}
          actions={[{ label: screen.retry, variant: "secondary", onPress: onRetry }]}
        />
      )}
    </Screen>
  );
}

/** Screen 18a, "Regra da fila": the draft lives here and "Salvar regra" sends it in one request. */
export function QueueRuleScreen({ groupId }: QueueRuleScreenProps) {
  const { ready, failure, bannerText, retry } = useSettingsData(groupId, NO_PENDING);
  return ready === null ? (
    <QueueRuleLoading groupId={groupId} failureText={failure?.text ?? null} onRetry={retry} />
  ) : (
    <QueueRuleForm groupId={groupId} ready={ready} bannerText={bannerText} />
  );
}
