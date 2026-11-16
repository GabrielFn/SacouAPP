import { Pressable, View } from "react-native";

import type { Theme } from "../../../theme/themes";
import { useTheme } from "../../../theme/theme-context";
import { fontFamilies } from "../../../theme/tokens.data";
import { HeadedBlock } from "../../../ui/HeadedBlock";
import { Avatar } from "../../../ui/Avatar";
import { MoreIcon } from "../../../ui/Icons";
import { Text } from "../../../ui/Text";
import type { LevelBadgeModel } from "../model/member-levels";
import type { BadgeLook, MemberRowModel } from "../model/members.selectors";

import { ListRowFrame } from "./ListRowFrame";

interface BadgeColors {
  readonly background: string;
  readonly foreground: string;
  readonly border: string | null;
}

/** The role badges of Membros.dc.html: dark Admin, outlined Co-admin, blue Placar, yellow "Sem conta". */
function badgeColors(look: BadgeLook, colors: Theme): BadgeColors {
  switch (look) {
    case "admin":
      return { background: colors.text, foreground: colors.background, border: null };
    case "coAdmin":
      return { background: colors.surface, foreground: colors.text, border: colors.text };
    case "scorekeeper":
      return { background: colors.infoFill, foreground: colors.infoText, border: null };
    case "player":
      return { background: colors.badgeSurface, foreground: colors.textMuted, border: null };
    case "noAccount":
      return {
        background: colors.waitingFill,
        foreground: colors.text,
        border: colors.waitingBorder,
      };
  }
}

export interface MemberBadgeProps {
  readonly label: string;
  readonly look: BadgeLook;
}

/** Not interactive: exempt from the touch target floor. */
export function MemberBadge({ label, look }: MemberBadgeProps) {
  const { colors, tokens } = useTheme();
  const badge = badgeColors(look, colors);
  return (
    <View
      style={{
        paddingHorizontal: tokens.spacing.s,
        borderRadius: tokens.radii.field,
        backgroundColor: badge.background,
        borderWidth: badge.border === null ? undefined : tokens.borderWidths.thin,
        borderColor: badge.border ?? badge.background,
      }}
    >
      <Text
        style={{
          color: badge.foreground,
          fontFamily: fontFamilies.body700,
          fontSize: tokens.fontSizes.caption,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

interface LevelLook {
  readonly background: string;
  readonly foreground: string;
  readonly border: string | null;
}

function levelLook(look: LevelBadgeModel["look"], colors: Theme): LevelLook {
  switch (look) {
    case "confirmed":
      return { background: colors.surface, foreground: colors.text, border: null };
    case "suggested":
      return {
        background: colors.noticeFill,
        foreground: colors.suggestText,
        border: colors.suggestBorder,
      };
    case "none":
      return {
        background: colors.surface,
        foreground: colors.textMuted,
        border: colors.borderDashed,
      };
  }
}

export interface LevelBadgeProps {
  readonly model: LevelBadgeModel;
  readonly onPress: () => void;
}

/** The level card at the right of a row (`.nota`, `.sug`, `.sem`): opens the sheet 19a. Admins only. */
export function LevelBadge({ model, onPress }: LevelBadgeProps) {
  const { colors, tokens } = useTheme();
  const look = levelLook(model.look, colors);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={model.accessibilityLabel}
      onPress={onPress}
      style={{
        minWidth: tokens.sizes.levelBadgeWidth,
        minHeight: tokens.sizes.levelBadgeHeight,
        paddingHorizontal: tokens.spacing.xs,
        borderRadius: tokens.radii.field,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: look.background,
        borderWidth: look.border === null ? undefined : tokens.borderWidths.thin,
        borderStyle: look.border === null ? undefined : "dashed",
        borderColor: look.border ?? look.background,
      }}
    >
      <Text
        tabular
        style={{
          color: look.foreground,
          fontFamily: model.look === "none" ? fontFamilies.body600 : fontFamilies.display800,
          fontSize:
            model.look === "none"
              ? tokens.fontSizes.levelCaption
              : tokens.fontSizes.displayLevelBadge,
        }}
      >
        {model.value}
      </Text>
      {model.caption === null ? null : (
        <Text
          style={{
            color: look.foreground,
            fontFamily: fontFamilies.body600,
            fontSize: tokens.fontSizes.levelCaption,
          }}
        >
          {model.caption}
        </Text>
      )}
    </Pressable>
  );
}

export interface MemberRowProps {
  readonly model: MemberRowModel;
  /** Your own row has the dark avatar. */
  readonly own: boolean;
  /** `null` for Placar and Jogador: they never see a level (ADR 0047). */
  readonly level: LevelBadgeModel | null;
  readonly onLevel: () => void;
  /** `null` when this row has no options for who looks. */
  readonly onOptions: (() => void) | null;
}

/** One row of screen 19: the initials, the nickname and role, the positions and, for admins, the level. */
export function MemberRow({ model, own, level, onLevel, onOptions }: MemberRowProps) {
  const { tokens } = useTheme();
  return (
    <ListRowFrame>
      <Avatar initials={model.initials} dashed={model.dashedAvatar} own={own} />
      <HeadedBlock
        heading={
          <>
            <Text variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
              {model.title}
            </Text>
            <MemberBadge label={model.badgeLabel} look={model.badgeLook} />
          </>
        }
      >
        <Text variant="muted" numberOfLines={1}>
          {model.detail}
        </Text>
      </HeadedBlock>
      {level === null ? null : <LevelBadge model={level} onPress={onLevel} />}
      {onOptions === null ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={model.optionsLabel}
          onPress={onOptions}
          style={{
            minWidth: tokens.sizes.moreButtonWidth,
            minHeight: tokens.sizes.moreButtonHeight,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MoreIcon />
        </Pressable>
      )}
    </ListRowFrame>
  );
}
