import type { ScreenAction } from "./ActionButtons";
import { EmptyState } from "./EmptyState";
import { Screen } from "./Screen";

export interface ErrorScreenProps {
  readonly title: string;
  readonly body: string;
  readonly actions: readonly ScreenAction[];
}

/** A whole-screen error with a title, what it means for the user's data, and what to do next. */
export function ErrorScreen({ title, body, actions }: ErrorScreenProps) {
  return (
    <Screen>
      <EmptyState alert title={title} body={body} actions={actions} />
    </Screen>
  );
}
