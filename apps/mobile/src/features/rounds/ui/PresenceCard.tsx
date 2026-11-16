import { View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { CheckIcon } from "../../../ui/Icons";
import { Text } from "../../../ui/Text";
import type { PresenceCardView, PresenceCounts } from "../model/presence-card";

const { presence } = strings.rounds;

export interface PresenceCardProps {
  readonly view: PresenceCardView;
  readonly counts: PresenceCounts;
  /** The orange check of RodadaJogador.dc.html, for who holds a spot. */
  readonly going: boolean;
}

/** The dark "Sua presença" card of screen 26 (D7); the buttons live in the footer of the screen. */
export function PresenceCard({ view, counts, going }: PresenceCardProps) {
  const { colors, tokens } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={[
        presence.section,
        view.title,
        view.line,
        counts.confirmed,
        counts.waitlist,
      ]
        .filter((part) => part !== null)
        .join(". ")}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: tokens.spacing.m,
        padding: tokens.spacing.l,
        borderRadius: tokens.radii.card,
        backgroundColor: colors.panelSurface,
      }}
    >
      {going ? (
        <View
          style={{
            width: tokens.sizes.avatar,
            aspectRatio: 1,
            borderRadius: tokens.radii.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.primary,
          }}
        >
          <CheckIcon color={colors.onPrimary} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: tokens.spacing.xs }}>
        <Text variant="display" displaySize="displayMedium" style={{ color: colors.onPanel }}>
          {view.title}
        </Text>
        {view.line === null ? null : (
          <Text variant="caption" style={{ color: colors.onPanel }}>
            {view.line}
          </Text>
        )}
      </View>
      <View style={{ alignItems: "flex-end", gap: tokens.spacing.xs }}>
        <Text variant="display" displaySize="displayMedium" style={{ color: colors.onPanel }}>
          {counts.confirmed}
        </Text>
        {counts.waitlist === null ? null : (
          <Text variant="caption" style={{ color: colors.panelAccent }}>
            {counts.waitlist}
          </Text>
        )}
      </View>
    </View>
  );
}
