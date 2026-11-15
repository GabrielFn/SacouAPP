import { useRouter } from "expo-router";
import { View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { Button } from "../../../ui/Button";
import { ErrorStrip } from "../../../ui/ErrorStrip";
import { Screen } from "../../../ui/Screen";
import { Text } from "../../../ui/Text";
import { TextField } from "../../../ui/TextField";
import { useAddPlayer } from "../hooks/use-add-player";
import { addableMembers, type AddableRow } from "../model/addable-members";
import { capacityHint } from "../model/capacity-hint";
import { roundSettingsOf, statsCells } from "../model/round-detail";
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

export interface AddPlayerScreenProps {
  readonly groupId: string;
  readonly roundId: string;
}

/** Screen 21: the admin adds who confirmed on WhatsApp; the server decides spot or waitlist (D8). */
export function AddPlayerScreen({ groupId, roundId }: AddPlayerScreenProps) {
  const router = useRouter();
  const { colors, tokens } = useTheme();
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
  const waitlistEnabled = settings?.values.attendance.waitlistEnabled ?? false;
  const hint = capacityHint(round.data, waitlistEnabled);
  const rows = addableMembers(members.data ?? [], round.data, model.search);
  const count = settings === null ? [] : statsCells(round.data, settings.values);
  const blocked = hint?.canAdd === false;
  return (
    <Screen scroll>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: tokens.spacing.s }}>
        <View style={{ flex: 1, gap: tokens.spacing.xs }}>
          <Text variant="title" accessibilityRole="header">
            {add.title}
          </Text>
          <Text variant="muted">{add.subtitle(group.data.name, count[0]?.value ?? "")}</Text>
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
      {model.feedback === null ? null : model.failed ? (
        <ErrorStrip text={model.feedback} />
      ) : (
        <Text variant="bodyStrong" accessibilityLiveRegion="polite">
          {model.feedback}
        </Text>
      )}
      <Text variant="bodyStrong" accessibilityRole="header">
        {add.notYet}
      </Text>
      {rows.length === 0 ? (
        <Text variant="muted">{model.search.trim() === "" ? add.nobodyLeft : add.noMatch}</Text>
      ) : (
        <View
          style={{
            borderRadius: tokens.radii.card,
            borderWidth: tokens.borderWidths.thin,
            borderColor: colors.borderCard,
            backgroundColor: colors.surface,
            overflow: "hidden",
          }}
        >
          {rows.map((row) => (
            <AddableRowView
              key={row.memberId}
              row={row}
              adding={model.addingId === row.memberId}
              disabled={blocked || model.addingId !== null}
              onAdd={() => {
                model.add(row.memberId);
              }}
            />
          ))}
        </View>
      )}
      {hint === null ? null : <Text variant="muted">{hint.text}</Text>}
    </Screen>
  );
}
