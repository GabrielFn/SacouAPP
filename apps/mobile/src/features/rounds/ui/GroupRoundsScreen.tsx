import { useRouter } from "expo-router";
import { View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { fontFamilies } from "../../../theme/tokens.data";
import { BackBar } from "../../../ui/BackBar";
import { EmptyState } from "../../../ui/EmptyState";
import { PlusIcon } from "../../../ui/Icons";
import { LoadingState } from "../../../ui/LoadingState";
import { OfflineBanner } from "../../../ui/OfflineBanner";
import { PillButton } from "../../../ui/PillButton";
import { Screen } from "../../../ui/Screen";
import { Text } from "../../../ui/Text";
import { groupsHref } from "../../groups/navigation";
import { useGroupRounds, type GroupRoundsModel } from "../hooks/use-group-rounds";
import type { GroupRoundItem } from "../model/group-rounds";
import { createRoundHref, roundHref, summaryHref } from "../navigation";
import { GroupRoundRow } from "./GroupRoundRow";

const { groupRounds } = strings.rounds;

export interface RoundsSectionProps {
  readonly title: string;
  readonly items: readonly GroupRoundItem[];
  /** Said when the section has no round; `null` for a section that then simply is not drawn. */
  readonly emptyText: string | null;
  readonly hint?: string;
  readonly onOpen: (item: GroupRoundItem) => void;
}

function RoundsSection({ title, items, emptyText, hint, onOpen }: RoundsSectionProps) {
  const { tokens } = useTheme();
  return (
    <View style={{ gap: tokens.spacing.s10 }}>
      <Text
        variant="muted"
        accessibilityRole="header"
        style={{ fontFamily: fontFamilies.body700, fontSize: tokens.fontSizes.small }}
      >
        {title}
      </Text>
      {items.length === 0 && emptyText !== null ? <Text variant="muted">{emptyText}</Text> : null}
      {items.map((item) => (
        <GroupRoundRow key={item.card.roundId} item={item} onOpen={onOpen} />
      ))}
      {hint !== undefined && items.length > 0 ? <Text variant="muted">{hint}</Text> : null}
    </View>
  );
}

export interface GroupRoundsBodyProps {
  readonly model: Extract<GroupRoundsModel, { kind: "list" }>;
  readonly onOpen: (item: GroupRoundItem) => void;
}

/** "Próximas" and "Recentes"; the whole list empty says so once, with what to do. */
export function GroupRoundsBody({ model, onOpen }: GroupRoundsBodyProps) {
  const { tokens } = useTheme();
  const { upcoming, recent } = model.view;
  if (upcoming.length === 0 && recent.length === 0) {
    return (
      <EmptyState
        title={groupRounds.emptyTitle}
        body={model.canCreate ? groupRounds.emptyOrganizer : groupRounds.emptyPlayer}
      />
    );
  }
  return (
    <View style={{ gap: tokens.spacing.l }}>
      <RoundsSection
        title={groupRounds.upcoming}
        items={upcoming}
        emptyText={groupRounds.noUpcoming}
        onOpen={onOpen}
      />
      {recent.length === 0 ? null : (
        <RoundsSection
          title={groupRounds.recent}
          items={recent}
          emptyText={null}
          hint={groupRounds.recentHint}
          onOpen={onOpen}
        />
      )}
    </View>
  );
}

export interface GroupRoundsContentProps {
  readonly model: GroupRoundsModel;
  readonly onOpen: (item: GroupRoundItem) => void;
}

export function GroupRoundsContent({ model, onOpen }: GroupRoundsContentProps) {
  switch (model.kind) {
    case "loading":
      return <LoadingState accessibilityLabel={groupRounds.loading} />;
    case "error":
      return (
        <EmptyState
          alert
          title={groupRounds.errorTitle}
          body={groupRounds.errorBody}
          actions={[{ label: groupRounds.retry, variant: "secondary", onPress: model.retry }]}
        />
      );
    case "list":
      return <GroupRoundsBody model={model} onOpen={onOpen} />;
  }
}

export interface GroupRoundsScreenProps {
  readonly groupId: string;
}

/**
 * "Rodadas do grupo" (R97 part 2, D6; ADR 0075): the next rounds and the recent ones of a group, and
 * "Nova rodada" for who organizes. It has no reducer: it only reads the cache and navigates.
 */
export function GroupRoundsScreen({ groupId }: GroupRoundsScreenProps) {
  const router = useRouter();
  const { tokens } = useTheme();
  const model = useGroupRounds(groupId);
  const open = (item: GroupRoundItem) => {
    router.push(
      item.target === "summary"
        ? summaryHref(groupId, item.card.roundId)
        : roundHref(groupId, item.card.roundId),
    );
  };
  return (
    <Screen scroll>
      <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.s10 }}>
        <View style={{ flex: 1 }}>
          <BackBar title={groupRounds.title} fallbackHref={groupsHref} look="heading" />
        </View>
        {model.kind === "list" && model.canCreate ? (
          <PillButton
            label={groupRounds.newRound}
            onPress={() => {
              router.push(createRoundHref(groupId));
            }}
            renderIcon={(color) => <PlusIcon color={color} />}
          />
        ) : null}
      </View>
      {model.kind === "list" && model.groupName !== "" ? (
        <Text variant="muted">{model.groupName}</Text>
      ) : null}
      {model.kind === "list" && model.bannerText !== null ? (
        <OfflineBanner text={model.bannerText} />
      ) : null}
      <GroupRoundsContent model={model} onOpen={open} />
    </Screen>
  );
}
