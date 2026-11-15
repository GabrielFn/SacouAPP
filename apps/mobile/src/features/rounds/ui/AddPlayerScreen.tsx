import { useRouter } from "expo-router";
import { View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { Button } from "../../../ui/Button";
import { ErrorStrip } from "../../../ui/ErrorStrip";
import { Screen } from "../../../ui/Screen";
import { Text } from "../../../ui/Text";
import { TextField } from "../../../ui/TextField";
import { useAddPlayer, type AddPlayerModel } from "../hooks/use-add-player";
import type { AddableRow } from "../model/addable-members";
import { roundSettingsOf } from "../model/round-detail";
import { addPlayerView, type AddPlayerView } from "../model/round-screen-view";
import { roundHref } from "../navigation";
import { RoundLoading } from "./RoundHeading";

const { add } = strings.rounds;

export interface AddableRowViewProps {
  readonly row: AddableRow;
  readonly adding: boolean;
  readonly disabled: boolean;
  readonly onAdd: () => void;
}

function AddableRowView({ row, adding, disabled, onAdd }: AddableRowViewProps) {
  const { colors, tokens } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: tokens.spacing.s10,
        minHeight: tokens.sizes.memberRowMin,
        paddingHorizontal: tokens.spacing.m,
        borderBottomWidth: tokens.borderWidths.thin,
        borderColor: colors.borderDivider,
      }}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: tokens.sizes.avatar,
          aspectRatio: 1,
          borderRadius: tokens.radii.pill,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.avatarSurface,
        }}
      >
        <Text variant="bodyStrong">{row.initial}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {row.name}
        </Text>
        <Text variant="muted">{row.detail}</Text>
      </View>
      <Button
        label={adding ? add.adding : add.action}
        variant="secondary"
        accessibilityLabel={add.actionLabel(row.name)}
        disabled={disabled}
        onPress={onAdd}
      />
    </View>
  );
}

export interface AddableListProps {
  readonly view: AddPlayerView;
  readonly model: AddPlayerModel;
}

/** "Ainda não confirmaram": the rows, or why there is none. */
function AddableList({ view, model }: AddableListProps) {
  const { colors, tokens } = useTheme();
  if (view.rows.length === 0) {
    return <Text variant="muted">{model.search.trim() === "" ? add.nobodyLeft : add.noMatch}</Text>;
  }
  return (
    <View
      style={{
        borderRadius: tokens.radii.card,
        borderWidth: tokens.borderWidths.thin,
        borderColor: colors.borderCard,
        backgroundColor: colors.surface,
        overflow: "hidden",
      }}
    >
      {view.rows.map((row) => (
        <AddableRowView
          key={row.memberId}
          row={row}
          adding={model.addingId === row.memberId}
          disabled={view.blocked || model.addingId !== null}
          onAdd={() => {
            model.add(row.memberId);
          }}
        />
      ))}
    </View>
  );
}

export interface AddFeedbackProps {
  readonly text: string | null;
  readonly failed: boolean;
}

/** "Davi entrou na espera (2º).", or the text of the refusal. */
function AddFeedback({ text, failed }: AddFeedbackProps) {
  if (text === null) return null;
  if (failed) return <ErrorStrip text={text} />;
  return (
    <Text variant="bodyStrong" accessibilityLiveRegion="polite">
      {text}
    </Text>
  );
}

export interface AddPlayerScreenProps {
  readonly groupId: string;
  readonly roundId: string;
}

/** Screen 21: the admin adds who confirmed on WhatsApp; the server decides spot or waitlist (D8). */
export function AddPlayerScreen({ groupId, roundId }: AddPlayerScreenProps) {
  const router = useRouter();
  const { tokens } = useTheme();
  const model = useAddPlayer(groupId, roundId);
  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace(roundHref(groupId, roundId));
  };
  const { group, round, members } = model;
  if (group.data === undefined || round.data === undefined) {
    return (
      <Screen>
        <RoundLoading
          failure={group.error ?? round.error}
          onRetry={() => {
            void group.refetch();
            void round.refetch();
          }}
        />
      </Screen>
    );
  }
  const settings = roundSettingsOf(round.data);
  const view = addPlayerView(round.data, settings, members.data ?? [], model.search);
  return (
    <Screen scroll>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: tokens.spacing.s }}>
        <View style={{ flex: 1, gap: tokens.spacing.xs }}>
          <Text variant="title" accessibilityRole="header">
            {add.title}
          </Text>
          <Text variant="muted">{add.subtitle(group.data.name, view.confirmed)}</Text>
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
