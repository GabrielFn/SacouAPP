import type { ReactNode } from "react";

import { apiErrorText } from "../../../services/api/api-error-text";
import type { MyGroup } from "../../../services/api/sacou-api";
import { strings } from "../../../strings/pt-BR";
import type { ScreenAction } from "../../../ui/ActionButtons";
import { EmptyState } from "../../../ui/EmptyState";
import { LoadingState } from "../../../ui/LoadingState";
import type { GroupsViewState } from "../model/groups-view-state";

export interface GroupsStateViewProps {
  readonly state: GroupsViewState;
  readonly onRetry: () => void;
  /** What the screen shows when there are groups; each screen draws its own. */
  readonly renderList: (groups: readonly MyGroup[]) => ReactNode;
  readonly emptyActions?: readonly ScreenAction[];
}

const { states } = strings.groups;

/** One place that answers every state of the groups query, shared by the home and the list (D5). */
export function GroupsStateView({
  state,
  onRetry,
  renderList,
  emptyActions,
}: GroupsStateViewProps) {
  switch (state.kind) {
    case "loading":
      return <LoadingState accessibilityLabel={states.loading} />;
    case "offline-empty":
      return <EmptyState title={states.offlineTitle} body={states.offlineBody} />;
    case "error":
      return (
        <EmptyState
          title={states.errorTitle}
          body={apiErrorText(state.error)}
          actions={[{ label: states.retry, variant: "secondary", onPress: onRetry }]}
        />
      );
    case "empty":
      return (
        <EmptyState title={states.emptyTitle} body={states.emptyBody} actions={emptyActions} />
      );
    case "list":
      return renderList(state.groups);
  }
}
