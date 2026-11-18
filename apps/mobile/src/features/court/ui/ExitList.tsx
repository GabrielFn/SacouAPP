import type { MemberId } from "@sacou/match-engine";
import { Pressable, View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { Text } from "../../../ui/Text";
import type { ExitRow, ManualPick } from "../next-match/match-end-selectors";

export interface ExitListProps {
  readonly title: string;
  readonly rows: readonly ExitRow[];
}

function Row({ name, detail }: Pick<ExitRow, "name" | "detail">) {
  const { colors, tokens } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={strings.court.matchEnd.rowLabel(name, detail)}
      style={{
        minHeight: tokens.sizes.minTouchTarget,
        flexDirection: "row",
        alignItems: "center",
        gap: tokens.spacing.s,
        paddingHorizontal: tokens.spacing.m,
        borderRadius: tokens.radii.field,
        borderWidth: tokens.borderWidths.thin,
        borderColor: colors.borderCard,
        backgroundColor: colors.surface,
      }}
    >
      <Text variant="bodyStrong" style={{ flex: 1 }}>
        {name}
      </Text>
      {detail === null ? null : <Text variant="muted">{detail}</Text>}
    </View>
  );
}

/** "Saem" or "Entram" of screen 11: one line per player, with the streak or the position. */
export function ExitList({ title, rows }: ExitListProps) {
  const { tokens } = useTheme();
  return (
    <View style={{ flex: 1, gap: tokens.spacing.xs }}>
      <Text variant="muted">{title}</Text>
      {rows.map((row) => (
        <Row key={row.memberId} name={row.name} detail={row.detail} />
      ))}
    </View>
  );
}

export interface PickListProps {
  readonly pick: ManualPick;
  readonly chosen: readonly MemberId[];
  readonly onToggle: (memberId: MemberId) => void;
}

/** The criterion `manual`: tap exactly as many players of the team as leave (D7). */
export function PickList({ pick, chosen, onToggle }: PickListProps) {
  const { matchEnd } = strings.court;
  const { colors, tokens } = useTheme();
  return (
    <View style={{ gap: tokens.spacing.xs }}>
      <Text variant="muted">{matchEnd.chooseHint(pick.required, pick.label)}</Text>
      {pick.candidates.map(({ memberId, name }) => {
        const isChosen = chosen.includes(memberId);
        return (
          <Pressable
            key={memberId}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isChosen }}
            accessibilityLabel={matchEnd.chosenLabel(name, isChosen)}
            onPress={() => {
              onToggle(memberId);
            }}
            style={{
              minHeight: tokens.sizes.minTouchTarget,
              justifyContent: "center",
              paddingHorizontal: tokens.spacing.m,
              borderRadius: tokens.radii.field,
              borderWidth: isChosen ? tokens.court.borderWidths.outline : tokens.borderWidths.thin,
              borderColor: isChosen ? colors.text : colors.borderCard,
              backgroundColor: colors.surface,
            }}
          >
            <Text variant="bodyStrong">{name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
