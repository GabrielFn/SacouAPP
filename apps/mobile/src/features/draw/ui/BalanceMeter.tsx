import { View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { CheckIcon, WarningIcon } from "../../../ui/Icons";
import { Text } from "../../../ui/Text";
import type { MeterView } from "../model/draw-meter";
import { teamSwatch } from "./team-swatch";

const HALF = 2;

function percent(value: number): `${number}%` {
  return `${value}%`;
}

export interface BalanceMeterProps {
  readonly meter: MeterView;
}

/** "Diferença 0,1 · ótimo" over the bar of the averages (Sorteio.dc.html); one image for the screen reader. */
export function BalanceMeter({ meter }: BalanceMeterProps) {
  const { colors, tokens } = useTheme();
  const marker = tokens.sizes.meterMarker;
  const track = tokens.sizes.meterTrack;
  const trackTop = (tokens.sizes.meterArea - track) / HALF;
  return (
    <View
      style={{
        padding: tokens.spacing.m,
        gap: tokens.spacing.s6,
        backgroundColor: colors.surface,
        borderRadius: tokens.radii.tile,
        borderWidth: tokens.borderWidths.thin,
        borderColor: colors.borderCard,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.s }}>
        {meter.label === "unbalanced" ? (
          <WarningIcon color={colors.danger} />
        ) : (
          <CheckIcon color={colors.goingText} />
        )}
        <Text variant="title" style={{ flex: 1 }}>
          {meter.title}
        </Text>
        <Text variant="caption">{strings.draw.meter.caption}</Text>
      </View>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={meter.accessibilityLabel}
        style={{ height: tokens.sizes.meterArea }}
      >
        <View
          style={{
            position: "absolute",
            left: "0%",
            right: "0%",
            top: trackTop,
            height: track,
            borderRadius: track / HALF,
            backgroundColor: colors.borderCard,
          }}
        />
        <View
          style={{
            position: "absolute",
            left: percent(meter.band.start),
            width: percent(meter.band.end - meter.band.start),
            top: trackTop,
            height: track,
            borderRadius: track / HALF,
            backgroundColor: colors.meterBand,
          }}
        />
        {meter.markers.map(({ team, percent: at }) => {
          const swatch = teamSwatch(team.color, colors);
          return (
            <View
              key={team.letter}
              style={{
                position: "absolute",
                left: percent(at),
                marginLeft: -marker / HALF,
                top: (tokens.sizes.meterArea - marker) / HALF,
                width: marker,
                aspectRatio: 1,
                borderRadius: marker / HALF,
                borderWidth: tokens.borderWidths.thick,
                borderColor: colors.surface,
                backgroundColor: swatch.fill,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text variant="caption" style={{ color: swatch.onFill }}>
                {team.letter}
              </Text>
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text variant="caption" tabular>
          {meter.axisStart}
        </Text>
        <Text variant="caption" tabular>
          {meter.averages}
        </Text>
        <Text variant="caption" tabular>
          {meter.axisEnd}
        </Text>
      </View>
    </View>
  );
}
