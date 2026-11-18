import { View } from "react-native";

import { lineupStrings as texts } from "../../../strings/lineup.pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { TEAM_PALETTES, type TeamColorName } from "../../../theme/team-colors";
import { Text } from "../../../ui/Text";
import { ATTACK_LINE_RATIO, FLUSH, PERCENT } from "../../court/court.data";
import { NetMesh } from "../../court/ui/NetMesh";
import type { LineupChip } from "../model/lineup-court";
import { LineupChipButton } from "./LineupChipButton";

const HALF = 2;
/** The square takes 280 of the 390 of the canvas, and the room above it holds the server (48 of 390). */
const SQUARE_WIDTH = "72%";
const SERVER_ROOM = "12%";
/** The box a chip is centered in, in percent of the square: wide enough for "Marcos 5". */
const CHIP_BOX = 31;
const DASHED = "dashed";
/** Two decimals of a percent. */
const ROUNDING = 100;

export interface LineupCourtProps {
  readonly team: string;
  readonly color: TeamColorName;
  readonly chips: readonly LineupChip[];
  readonly onPress: (memberId: string) => void;
}

function percent(value: number): `${number}%` {
  return `${String(Math.round(value * ROUNDING) / ROUNDING)}%` as `${number}%`;
}

export interface ChipSpotProps {
  readonly chip: LineupChip;
  readonly onPress: (memberId: string) => void;
}

/** The chip centered on the point of the formation: never worked out again here (D2). */
function ChipSpot({ chip, onPress }: ChipSpotProps) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        position: "absolute",
        left: percent(chip.place.x - CHIP_BOX / HALF),
        top: percent(chip.place.y),
        width: percent(CHIP_BOX),
        alignItems: "center",
        transform: [{ translateY: -tokens.sizes.chip / HALF }],
      }}
    >
      <LineupChipButton chip={chip} onPress={onPress} />
    </View>
  );
}

/** The half court at the moment of the serve, the net below, as the admin looks from it (Escalacao.dc.html). */
export function LineupCourt({ team, color, chips, onPress }: LineupCourtProps) {
  const { colors, tokens } = useTheme();
  const frame = tokens.court.borderWidths.frame;
  const teamColor = TEAM_PALETTES[color].fill;
  return (
    <View
      accessibilityLabel={texts.courtLabel(team)}
      style={{
        paddingTop: SERVER_ROOM,
        paddingBottom: tokens.spacing.s,
        backgroundColor: colors.surface,
        borderTopWidth: frame,
        borderBottomWidth: frame,
        borderColor: colors.text,
        gap: tokens.spacing.xs,
      }}
    >
      <Text
        variant="caption"
        style={{ position: "absolute", top: tokens.spacing.s14, right: tokens.spacing.l }}
      >
        {texts.atServe}
      </Text>
      <View
        style={{
          width: SQUARE_WIDTH,
          aspectRatio: 1,
          alignSelf: "center",
          borderColor: teamColor,
          borderLeftWidth: frame,
          borderRightWidth: frame,
          borderTopWidth: frame,
        }}
      >
        <View
          style={{
            position: "absolute",
            left: FLUSH,
            right: FLUSH,
            bottom: percent(ATTACK_LINE_RATIO * PERCENT),
            borderTopWidth: tokens.borderWidths.thick,
            borderStyle: DASHED,
            borderColor: teamColor,
          }}
        />
        <Text
          variant="caption"
          style={{
            position: "absolute",
            right: tokens.spacing.s6,
            bottom: percent(ATTACK_LINE_RATIO * PERCENT),
          }}
        >
          {texts.attackLine}
        </Text>
        {chips.map((chip) => (
          <ChipSpot key={chip.memberId} chip={chip} onPress={onPress} />
        ))}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.s }}>
        <Text variant="bodyStrong" style={{ paddingLeft: tokens.spacing.l }}>
          {texts.net}
        </Text>
        <View style={{ flex: 1, paddingRight: tokens.spacing.l }}>
          <NetMesh />
        </View>
      </View>
    </View>
  );
}
