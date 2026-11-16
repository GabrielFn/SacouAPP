import { Redirect, useRouter } from "expo-router";
import { View } from "react-native";

import type { Member, Round } from "../../../services/api/sacou-api";
import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { Button } from "../../../ui/Button";
import { Screen } from "../../../ui/Screen";
import { Text } from "../../../ui/Text";
import { TextField } from "../../../ui/TextField";
import { useAddPlayer, type AddPlayerModel } from "../hooks/use-add-player";
import { managesRounds, roundSettingsOf } from "../model/round-detail";
import { addPlayerView } from "../model/round-screen-view";
import { roundHref } from "../navigation";
import { AddableList, AddFeedback } from "./AddableList";
import { RoundLoading } from "./RoundHeading";

const { add } = strings.rounds;

export interface AddPlayerContentProps {
  readonly groupId: string;
  readonly groupName: string;
  readonly round: Round;
  readonly members: readonly Member[];
  readonly model: AddPlayerModel;
}

function AddPlayerContent({ groupId, groupName, round, members, model }: AddPlayerContentProps) {
  const router = useRouter();
  const { tokens } = useTheme();
  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace(roundHref(groupId, round.roundId));
  };
  const view = addPlayerView(round, roundSettingsOf(round), members, model.search);
  return (
    <Screen scroll>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: tokens.spacing.s }}>
        <View style={{ flex: 1, gap: tokens.spacing.xs }}>
          <Text variant="title" accessibilityRole="header">
            {add.title}
          </Text>
          <Text variant="muted">{add.subtitle(groupName, view.confirmed)}</Text>
        </View>
        <Button label={add.close} variant="link" onPress={close} />
      </View>
      <TextField
        label={add.search}
        placeholder={add.search}
        value={model.search}
        onChangeText={model.setSearch}
        autoCapitalize="none"
      />
      <AddFeedback text={model.feedback} failed={model.failed} />
      <Text variant="bodyStrong" accessibilityRole="header">
        {add.notYet}
      </Text>
      <AddableList view={view} model={model} />
      {view.hint === null ? null : <Text variant="muted">{view.hint.text}</Text>}
    </Screen>
  );
}

export interface AddPlayerScreenProps {
  readonly groupId: string;
  readonly roundId: string;
}

/** Screen 21: the admin adds who confirmed on WhatsApp; the server decides spot or waitlist (D8). */
export function AddPlayerScreen({ groupId, roundId }: AddPlayerScreenProps) {
  const model = useAddPlayer(groupId, roundId);
  const groupData = model.group.data;
  const roundData = model.round.data;
  // A role that lost ManageRounds (read again after a 403) goes back to the round: only IDs in the route.
  if (groupData !== undefined && !managesRounds(groupData.role)) {
    return <Redirect href={roundHref(groupId, roundId)} />;
  }
  // Without the members, an empty list would read "Todo mundo do grupo já está na lista.": wait or say why.
  return groupData === undefined || roundData === undefined || model.members.data === undefined ? (
    <RoundLoading queries={[model.group, model.round, model.members]} />
  ) : (
    <AddPlayerContent
      groupId={groupId}
      groupName={groupData.name}
      round={roundData}
      members={model.members.data}
      model={model}
    />
  );
}
