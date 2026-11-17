import { useRouter, type Href } from "expo-router";

import { errorTextOf } from "../../../services/api/api-error-text";
import type { GroupRole } from "../../../services/api/sacou-api";
import { strings } from "../../../strings/pt-BR";
import { EmptyState } from "../../../ui/EmptyState";
import { LoadingState } from "../../../ui/LoadingState";
import { Screen } from "../../../ui/Screen";
import { Text } from "../../../ui/Text";
import type { ScreenAction } from "../../../ui/ActionButtons";
import { canManageSettings } from "../../groups/model/group-settings.selectors";
import { groupSettingsHref } from "../../groups/navigation";
import { RoundLoading } from "../../rounds/ui/RoundHeading";
import { roundHref } from "../../rounds/navigation";
import { useDrawScreen } from "../hooks/use-draw-screen";
import type { DrawBlocker, DrawScreenState } from "../model/draw-screen-state";
import { DrawHeader } from "./DrawHeader";
import { DrawnView } from "./DrawnView";

const { draw } = strings;

export interface DrawScreenProps {
  readonly groupId: string;
  readonly roundId: string;
}

const BLOCKER_TEXTS: Readonly<Record<DrawBlocker, string>> = {
  forbidden: draw.blocked.forbidden,
  canceled: draw.blocked.canceled,
  disabled: draw.blocked.disabled,
  "not-enough": draw.blocked.notEnough,
};

interface StateTexts {
  readonly body: string;
  readonly actions: readonly ScreenAction[];
}

interface StateActions {
  readonly back: ScreenAction;
  readonly retry: ScreenAction;
  readonly settings: ScreenAction | null;
}

function blockedTexts(blocker: DrawBlocker, actions: StateActions): StateTexts {
  const body = BLOCKER_TEXTS[blocker];
  switch (blocker) {
    case "canceled":
      return { body, actions: [] };
    case "disabled":
      return { body, actions: actions.settings === null ? [actions.back] : [actions.settings] };
    case "forbidden":
    case "not-enough":
      return { body, actions: [actions.back] };
  }
}

/** The page of every state of the table D4 that has no teams to show. */
function stateTexts(screen: DrawScreenState, actions: StateActions): StateTexts | null {
  switch (screen.kind) {
    case "blocked":
      return blockedTexts(screen.blocker, actions);
    case "unreadable":
      return { body: strings.rounds.detail.loadError, actions: [actions.back] };
    case "offline":
      return { body: draw.blocked.offline, actions: [actions.retry] };
    case "failed":
      return { body: errorTextOf(screen.error), actions: [actions.retry, actions.back] };
    case "loading":
    case "drawing":
    case "drawn":
      return null;
  }
}

function useStateActions(groupId: string, roundId: string, role: GroupRole): StateActions {
  const router = useRouter();
  const backHref = roundHref(groupId, roundId);
  const go = (href: Href) => {
    router.push(href);
  };
  return {
    back: {
      label: draw.backToRound,
      variant: "secondary",
      onPress: () => {
        if (router.canGoBack()) router.back();
        else router.replace(backHref);
      },
    },
    retry: { label: draw.retry, variant: "secondary", onPress: () => undefined },
    settings: canManageSettings(role)
      ? { label: draw.openSettings, onPress: () => { go(groupSettingsHref(groupId)); } }
      : null,
  };
}

/** Screen 07 (Sorteio.dc.html): only admin and co-admin draw; the others get the reason (D1). */
export function DrawScreen({ groupId, roundId }: DrawScreenProps) {
  const model = useDrawScreen(groupId, roundId);
  const { group, round, screen } = model;
  const actions = useStateActions(groupId, roundId, group.data?.role ?? "player");
  if (group.data === undefined || round.data === undefined) {
    return <RoundLoading queries={[group, round]} />;
  }
  const header = draw.header(group.data.name, round.data.goingCount);
  const backHref = roundHref(groupId, roundId);
  if (screen.kind === "drawn") {
    return (
      <DrawnView
        model={model}
        arrangement={screen.arrangement}
        round={round.data}
        header={header}
        backHref={backHref}
      />
    );
  }
  const texts = stateTexts(screen, { ...actions, retry: { ...actions.retry, onPress: model.retry } });
  return (
    <Screen>
      <DrawHeader header={header} title={draw.blocked.title} backHref={backHref} />
      {texts === null ? (
        <>
          <Text variant="muted" accessibilityLiveRegion="polite">
            {draw.loading}
          </Text>
          <LoadingState accessibilityLabel={draw.loading} />
        </>
      ) : (
        <EmptyState alert title={texts.body} actions={texts.actions} />
      )}
    </Screen>
  );
}
