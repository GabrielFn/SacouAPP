import { View } from "react-native";

import type { PlayingPosition, PrimaryPosition } from "../../../services/api/sacou-api";
import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { Chip } from "../../../ui/Chip";
import { PRIMARY_POSITIONS } from "../model/positions";
import { ProfileSection } from "./ProfileSection";

export interface PositionChipsProps {
  readonly primary: PrimaryPosition | null;
  readonly others: readonly PlayingPosition[];
  /** The four concrete positions that are not the primary; empty hides "Também jogo de". */
  readonly visibleOthers: readonly PlayingPosition[];
  readonly onPickPrimary: (position: PrimaryPosition) => void;
  readonly onToggleOther: (position: PlayingPosition) => void;
}

/** "Posição principal" (a radio group of six) and "Também jogo de" (toggles), Onboarding.dc.html. */
export function PositionChips({
  primary,
  others,
  visibleOthers,
  onPickPrimary,
  onToggleOther,
}: PositionChipsProps) {
  const { tokens } = useTheme();
  const { profile, ratings } = strings;
  const row = { flexDirection: "row", flexWrap: "wrap", gap: tokens.spacing.s6 } as const;
  return (
    <>
      <ProfileSection title={profile.primaryTitle}>
        <View accessibilityRole="radiogroup" accessibilityLabel={profile.primaryTitle} style={row}>
          {PRIMARY_POSITIONS.map((position) => (
            <Chip
              key={position}
              label={ratings.positions[position]}
              selected={primary === position}
              onPress={() => {
                onPickPrimary(position);
              }}
            />
          ))}
        </View>
      </ProfileSection>
      {visibleOthers.length === 0 ? null : (
        <ProfileSection title={profile.othersTitle} note={profile.othersNote}>
          <View style={row}>
            {visibleOthers.map((position) => (
              <Chip
                key={position}
                kind="toggle"
                label={ratings.positions[position]}
                selected={others.includes(position)}
                onPress={() => {
                  onToggleOther(position);
                }}
              />
            ))}
          </View>
        </ProfileSection>
      )}
    </>
  );
}
