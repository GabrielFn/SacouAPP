import { View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { Button } from "../../../ui/Button";
import { Text } from "../../../ui/Text";
import { confirmedSummary, summaryText } from "../model/confirmed-summary";
import type { RosterEntry } from "../model/roster";

const { confirmed } = strings.rounds;

export interface ConfirmedBlockProps {
  readonly going: readonly RosterEntry[];
  readonly meId: string;
  readonly waitlist: string;
  readonly onSeeAll: () => void;
}

/** The white card "Confirmados" with the avatars, the line of names and the waitlist. */
export function ConfirmedBlock({ going, meId, waitlist, onSeeAll }: ConfirmedBlockProps) {
  const { colors, tokens } = useTheme();
  const summary = confirmedSummary(going, meId);
  return (
    <View
      style={{
        gap: tokens.spacing.s,
        padding: tokens.spacing.m,
        borderRadius: tokens.radii.card,
        borderWidth: tokens.borderWidths.thin,
        borderColor: colors.borderCard,
        backgroundColor: colors.surface,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text variant="bodyStrong" accessibilityRole="header" style={{ flex: 1 }}>
          {confirmed.title}
        </Text>
        {going.length === 0 ? null : (
          <Button label={confirmed.seeAll(going.length)} variant="link" onPress={onSeeAll} />
        )}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.m }}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ flexDirection: "row", gap: tokens.spacing.xs }}
        >
          {summary.initials.map((initial, index) => (
            <View
              key={`${initial}-${String(index)}`}
              style={{
                width: tokens.sizes.avatar,
                aspectRatio: 1,
                borderRadius: tokens.radii.pill,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.avatarSurface,
              }}
            >
              <Text variant="bodyStrong">{initial}</Text>
            </View>
          ))}
        </View>
        <Text variant="muted" accessibilityLabel={summaryText(summary)} style={{ flex: 1 }}>
          {summary.parts.map((part, index) =>
            part.strong ? (
              <Text key={String(index)} variant="bodyStrong">
                {part.text}
              </Text>
            ) : (
              part.text
            ),
          )}
        </Text>
      </View>
      {waitlist === "" ? null : <Text variant="muted">{confirmed.waitlist(waitlist)}</Text>}
    </View>
  );
}
