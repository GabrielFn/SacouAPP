import { View } from "react-native";
import Svg, { G, Path, Rect } from "react-native-svg";

import { strings } from "../../../strings/pt-BR";
import {
  CARD_ASPECT_RATIO,
  NAME_MIN_FONT_SCALE,
  cardMeasures,
} from "../../../theme/card-tokens.data";
import type { ScaledCardTokens } from "../../../theme/scale";
import { useTheme } from "../../../theme/theme-context";
import { fontFamilies } from "../../../theme/tokens.data";
import { PersonIcon } from "../../../ui/Icons";
import { Text } from "../../../ui/Text";
import { cardAccessibilityLabel, type CardStat, type PlayerCardModel } from "../model/player-card";
import {
  cardLayout,
  FLUSH,
  GLYPH_COLUMNS,
  GLYPH_RADIUS,
  GLYPH_ROWS,
  GLYPH_SQUARE,
  GLYPH_VIEW_BOX,
  MESH_VIEW_BOX,
} from "./player-card.layout.data";
import { meshPath } from "./player-card.mesh";

export type PlayerCardSize = "compact" | "full";

export interface PlayerCardViewProps {
  readonly card: PlayerCardModel;
  readonly size: PlayerCardSize;
  /** Off: the six numbers go away; avatar, name, position, brand and season stay. */
  readonly showStats: boolean;
}

const MESH_PATH = meshPath(cardMeasures.meshStep);

/** The player card (`.kc`): a night card with a yellow frame, in the shape 270 x 378 at any size. */
export function PlayerCardView({ card, size, showStats }: PlayerCardViewProps) {
  const { colors, tokens } = useTheme();
  const m = tokens.card[size];
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={cardAccessibilityLabel(card, showStats)}
      style={{
        width: "100%",
        aspectRatio: CARD_ASPECT_RATIO,
        overflow: "hidden",
        borderRadius: m.frameRadius,
        borderWidth: m.frameBorder,
        borderColor: colors.accent,
        backgroundColor: colors.panelSurface,
      }}
    >
      <View
        style={{
          position: "absolute",
          left: FLUSH,
          right: FLUSH,
          top: FLUSH,
          height: cardLayout.mesh.height,
        }}
      >
        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${String(MESH_VIEW_BOX.width)} ${String(MESH_VIEW_BOX.height)}`}
          preserveAspectRatio="none"
        >
          <Path d={MESH_PATH} stroke={colors.cardMesh} strokeWidth={cardMeasures.meshStroke} />
        </Svg>
      </View>

      {card.positionLabel === null ? null : (
        <View
          style={{
            position: "absolute",
            left: cardLayout.position.left,
            top: cardLayout.position.top,
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              color: colors.panelAccent,
              fontFamily: fontFamilies.body700,
              fontSize: m.positionFont,
            }}
          >
            {card.positionLabel}
          </Text>
          {card.showGlyph ? (
            <View style={{ marginTop: m.glyphGap }}>
              <PositionGlyph width={m.glyphWidth} height={m.glyphHeight} />
            </View>
          ) : null}
        </View>
      )}

      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          position: "absolute",
          top: cardLayout.avatar.top,
          right: cardLayout.avatar.right,
          width: cardLayout.avatar.width,
          aspectRatio: 1,
          borderRadius: m.avatarRadius,
          borderWidth: m.avatarBorder,
          borderColor: colors.surface,
          backgroundColor: colors.cardAvatarSurface,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {card.initials === null ? (
          <PersonIcon color={colors.onPanel} />
        ) : (
          <Text
            numberOfLines={1}
            style={{
              color: colors.onPanel,
              fontFamily: fontFamilies.display800,
              fontSize: m.initialsFont,
            }}
          >
            {card.initials}
          </Text>
        )}
      </View>

      <View
        style={{
          position: "absolute",
          left: FLUSH,
          right: FLUSH,
          top: cardLayout.nameBand.top,
          height: cardLayout.nameBand.height,
          backgroundColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: m.seasonPadding,
        }}
      >
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={NAME_MIN_FONT_SCALE}
          style={{
            color: colors.onPrimary,
            fontFamily: fontFamilies.display800,
            fontSize: m.nameFont,
          }}
        >
          {card.nickname}
        </Text>
      </View>

      {showStats ? <StatsGrid stats={card.stats} measures={m} /> : null}

      <View
        style={{
          position: "absolute",
          left: cardLayout.footer.side,
          right: cardLayout.footer.side,
          bottom: cardLayout.footer.bottom,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text
          style={{
            color: colors.primary,
            fontFamily: fontFamilies.display800,
            fontSize: m.brandFont,
          }}
        >
          {strings.profile.card.brand}
        </Text>
        <View
          style={{
            height: m.seasonHeight,
            paddingHorizontal: m.seasonPadding,
            borderRadius: m.seasonRadius,
            backgroundColor: colors.accent,
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              color: colors.onPrimary,
              fontFamily: fontFamilies.body700,
              fontSize: m.seasonFont,
            }}
          >
            {card.seasonLabel}
          </Text>
        </View>
      </View>
    </View>
  );
}

export interface StatsGridProps {
  readonly stats: readonly CardStat[];
  readonly measures: ScaledCardTokens["full"];
}

function StatsGrid({ stats, measures: m }: StatsGridProps) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        position: "absolute",
        left: cardLayout.stats.side,
        right: cardLayout.stats.side,
        top: cardLayout.stats.top,
        flexDirection: "row",
        flexWrap: "wrap",
        rowGap: m.statRowGap,
      }}
    >
      {stats.map((stat) => (
        <View key={stat.key} style={{ width: cardLayout.statColumn, alignItems: "center" }}>
          <Text
            tabular
            numberOfLines={1}
            style={{
              color: colors.onPanel,
              fontFamily: fontFamilies.display800,
              fontSize: m.statValueFont,
            }}
          >
            {stat.value}
          </Text>
          <Text numberOfLines={1} style={{ color: colors.cardLabel, fontSize: m.statLabelFont }}>
            {stat.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

export interface PositionGlyphProps {
  readonly width: number;
  readonly height: number;
}

/** Six squares, the last one lit: decoration of a position, the same for all (question 162). */
function PositionGlyph({ width, height }: PositionGlyphProps) {
  const { colors } = useTheme();
  const cells = GLYPH_ROWS.flatMap((y) => GLYPH_COLUMNS.map((x) => ({ x, y })));
  const lit = cells.length - 1;
  return (
    <Svg width={width} height={height} viewBox={GLYPH_VIEW_BOX}>
      {cells.map((cell, index) => (
        <G
          key={`${String(cell.x)}-${String(cell.y)}`}
          transform={`translate(${String(cell.x)} ${String(cell.y)})`}
        >
          <Rect
            width={GLYPH_SQUARE}
            height={GLYPH_SQUARE}
            rx={GLYPH_RADIUS}
            fill={index === lit ? colors.accent : colors.onPanel}
          />
        </G>
      ))}
    </Svg>
  );
}
