import { Pressable, View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { LockIcon, WarningIcon } from "../../../ui/Icons";
import { LevelSheet } from "../../../ui/LevelSheet";
import { Text } from "../../../ui/Text";
import type { MembersScreenModel } from "../hooks/use-members-screen";
import { memberRowModel } from "../model/members.selectors";

// The level of screen 19, for admins and co-admins only (ADR 0047): the screen never draws these for
// Placar and Jogador.

const ratingTexts = strings.ratings;

export interface PendingLevelsStripProps {
  readonly count: number;
  readonly onReview: () => void;
}

/** "3 notas para confirmar. O sorteio usa a sugestão até lá." with "Revisar" (opens 19b). */
function PendingLevelsStrip({ count, onReview }: PendingLevelsStripProps) {
  const { colors, tokens } = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={ratingTexts.pendingLabel(count)}
      onPress={onReview}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: tokens.spacing.s10,
        minHeight: tokens.sizes.levelBadgeHeight,
        paddingHorizontal: tokens.spacing.m,
        borderRadius: tokens.radii.button,
        backgroundColor: colors.noticeFill,
        borderWidth: tokens.borderWidths.thin,
        borderColor: colors.waitingBorder,
      }}
    >
      <WarningIcon />
      <Text style={{ flex: 1 }}>
        <Text variant="bodyStrong">{ratingTexts.pending.count(count)}</Text>
        {` ${ratingTexts.pending.body}`}
      </Text>
      <Text variant="bodyStrong" style={{ color: colors.infoText }}>
        {ratingTexts.pending.review}
      </Text>
    </Pressable>
  );
}

/** "A nota é usada no sorteio. Só admins veem." */
function LevelPrivacyLine() {
  const { tokens } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.s6 }}>
      <LockIcon />
      <Text variant="muted" style={{ flex: 1 }}>
        {`${ratingTexts.privacyRow} `}
        <Text variant="bodyStrong">{ratingTexts.privacyRowStrong}</Text>
      </Text>
    </View>
  );
}

export interface MemberLevelDialogProps {
  readonly model: MembersScreenModel;
}

/** The sheet 19a over screen 19: the draft is in the reducer of the screen, the level in the cache. */
export function MemberLevelDialog({ model }: MemberLevelDialogProps) {
  const sheet = model.levelSheet;
  if (sheet === null) return null;
  const row = memberRowModel(sheet.target);
  const { level } = sheet;
  return (
    <LevelSheet
      visible
      name={row.title}
      detail={row.detail}
      initials={row.initials}
      dashedAvatar={row.dashedAvatar}
      suggestion={level.kind === "suggested" ? level.tenths : null}
      value={sheet.shown}
      pending={model.pending}
      errorText={model.errorText}
      onChange={(tenths) => {
        model.dispatch({ type: "level-drafted", tenths });
      }}
      onSave={(tenths) => {
        model.saveLevel(sheet.target.memberId, tenths);
      }}
      onClose={() => {
        model.dispatch({ type: "level-closed" });
      }}
    />
  );
}

export interface LevelNoticesProps {
  readonly pendingCount: number;
  readonly onReview: () => void;
}

/** The pending strip, when something waits, and the privacy line under the tabs. */
export function LevelNotices({ pendingCount, onReview }: LevelNoticesProps) {
  return (
    <>
      {pendingCount === 0 ? null : <PendingLevelsStrip count={pendingCount} onReview={onReview} />}
      <LevelPrivacyLine />
    </>
  );
}
