import { strings } from "../../../strings/pt-BR";
import { BackBar } from "../../../ui/BackBar";
import { EmptyState } from "../../../ui/EmptyState";
import { LoadingState } from "../../../ui/LoadingState";
import { Screen } from "../../../ui/Screen";
import { groupSettingsHref } from "../navigation";

const { queueRuleScreen: texts, screen } = strings.settings;

export interface QueueRuleLoadingProps {
  readonly groupId: string;
  readonly failureText: string | null;
  readonly onRetry: () => void;
}

export function QueueRuleLoading({ groupId, failureText, onRetry }: QueueRuleLoadingProps) {
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
