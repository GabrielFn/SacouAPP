import { useState } from "react";
import { StyleSheet, useWindowDimensions, View, type LayoutChangeEvent } from "react-native";
import Svg, { Path } from "react-native-svg";

import { strings } from "../../../strings/pt-BR";
import {
  CARD_ASPECT_RATIO,
  NAME_MIN_FONT_SCALE,
  POSITION_MIN_FONT_SCALE,
  cardMeasures,
} from "../../../theme/card-tokens.data";
import { cardMeasuresFor, type ScaledCardMeasures } from "../../../theme/scale";
import { useTheme } from "../../../theme/theme-context";
import { fontFamilies } from "../../../theme/tokens.data";
import { PersonIcon } from "../../../ui/Icons";
import { Text } from "../../../ui/Text";
import { cardAccessibilityLabel, type PlayerCardModel } from "../model/player-card";
import { cardLayout, FLUSH, MESH_VIEW_BOX } from "./player-card.layout.data";
import { cardTextLines } from "./player-card-budget";
import { meshPath } from "./player-card.mesh";
import { PositionGlyph, StatsGrid } from "./player-card-parts";

export type PlayerCardSize = "compact" | "full";

export interface PlayerCardViewProps {
  readonly card: PlayerCardModel;
  readonly size: PlayerCardSize;
  /** Off: the six numbers go away; avatar, name, position, brand and season stay. */
  readonly showStats: boolean;
}

const MESH_PATH = meshPath(cardMeasures.meshStep);

/**
 * The player card (`.kc`): a night card with a yellow frame, in the shape 270 x 378 at any size. Its
 * measures follow its REAL width (`onLayout`): the window only gives the first frame, so screen 14,
 * screen 15 and the saved picture keep the proportions of the drawing.
 */
export function PlayerCardView({ card, size, showStats }: PlayerCardViewProps) {
  const { tokens } = useTheme();
  const { fontScale } = useWindowDimensions();
  // A single isolated field, the measured width (frontend.md, rule 4).
  const [width, setWidth] = useState<number | null>(null);
  const measures = width === null ? tokens.card[size] : cardMeasuresFor(width, fontScale);
  return (
    <PlayerCardFace
      card={card}
      showStats={showStats}
      measures={measures}
      onLayout={(event: LayoutChangeEvent) => {
        setWidth(event.nativeEvent.layout.width);
      }}
    />
  );
}

export interface PlayerCardFaceProps {
  readonly card: PlayerCardModel;
  readonly showStats: boolean;
  readonly measures: ScaledCardMeasures;
  readonly onLayout?: (event: LayoutChangeEvent) => void;
}

/** The drawing of the card for given measures. */
export function PlayerCardFace({ card, showStats, measures: m, onLayout }: PlayerCardFaceProps) {
  const { colors } = useTheme();
  const lines = cardTextLines(m);
  return (
    <View
      onLayout={onLayout}
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
            maxWidth: cardLayout.position.maxWidth,
          }}
        >
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={POSITION_MIN_FONT_SCALE}
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

      <View style={cardStyles.lowerSection}>
        <View style={cardStyles.statsArea}>
          {showStats ? <StatsGrid stats={card.stats} measures={m} /> : null}
        </View>
        <View style={cardStyles.footer}>
          <Text
            style={{
              color: colors.primary,
              fontFamily: fontFamilies.display800,
              fontSize: m.brandFont,
              lineHeight: lines.brand,
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
    </View>
  );
}

/**
 * Below the name band: the grid of numbers takes what is left and the footer (brand and season) is its own
 * strip under it, in the flow, so nothing can overlap (no `position: absolute` over the grid).
 */
export const cardStyles = StyleSheet.create({
  lowerSection: {
    position: "absolute",
    left: FLUSH,
    right: FLUSH,
    top: cardLayout.lower.top,
    bottom: FLUSH,
  },
  statsArea: {
    flex: 1,
    marginHorizontal: cardLayout.stats.side,
    justifyContent: "center",
    overflow: "hidden",
  },
  footer: {
    marginHorizontal: cardLayout.footer.side,
    marginBottom: cardLayout.footer.bottom,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
