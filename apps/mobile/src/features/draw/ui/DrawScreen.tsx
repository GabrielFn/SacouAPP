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
import { MIN_DRAW_PLAYERS } from "../model/draw-limits";
import type { DrawBlocker, DrawScreenState } from "../model/draw-screen-state";
import { DrawHeader } from "./DrawHeader";
import { DrawnView } from "./DrawnView";

const { draw } = strings;

export interface DrawScreenProps {
  readonly groupId: string;
  readonly roundId: string;
}

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
  switch (blocker) {
    case "canceled":
      return { body: draw.blocked.canceled, actions: [] };
    case "disabled":
      return {
        body: draw.blocked.disabled,
        actions: actions.settings === null ? [actions.back] : [actions.settings],
      };
    case "forbidden":
      return { body: draw.blocked.forbidden, actions: [{ ...actions.back, label: draw.back }] };
    case "not-enough":
      return { body: draw.blocked.notEnough(MIN_DRAW_PLAYERS), actions: [actions.back] };
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

function useStateActions(
  groupId: string,
  roundId: string,
  role: GroupRole,
  retry: () => void,
): StateActions {
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
    retry: { label: draw.retry, variant: "secondary", onPress: retry },
    settings: canManageSettings(role)
      ? {
          label: draw.openSettings,
          onPress: () => {
            go(groupSettingsHref(groupId));
          },
        }
      : null,
  };
}

/** Screen 07 (Sorteio.dc.html): only admin and co-admin draw; the others get the reason (D1). */
export function DrawScreen({ groupId, roundId }: DrawScreenProps) {
  const model = useDrawScreen(groupId, roundId);
  const { group, round, screen } = model;
  const actions = useStateActions(groupId, roundId, group.data?.role ?? "player", model.retry);
  if (group.data === undefined || round.data === undefined) {
    return <RoundLoading queries={[group, round]} />;
  }
  const header = draw.header(group.data.name, round.data.goingCount);
  const backHref = roundHref(groupId, roundId);
  if (screen.kind === "drawn") {
    return (
      <DrawnView
        groupId={groupId}
        model={model}
        arrangement={screen.arrangement}
        round={round.data}
        header={header}
        backHref={backHref}
      />
    );
  }
  const texts = stateTexts(screen, actions);
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
