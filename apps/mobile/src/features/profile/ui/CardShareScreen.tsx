import { useRef, useState, type ComponentRef, type ReactNode } from "react";
import { Pressable, View } from "react-native";

import { apiErrorText } from "../../../services/api/api-error-text";
import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { BackBar } from "../../../ui/BackBar";
import { Button } from "../../../ui/Button";
import { EmptyState } from "../../../ui/EmptyState";
import { ErrorStrip } from "../../../ui/ErrorStrip";
import { LoadingState } from "../../../ui/LoadingState";
import { DownloadIcon, ShareIcon } from "../../../ui/MenuIcons";
import { OfflineBanner } from "../../../ui/OfflineBanner";
import { Screen } from "../../../ui/Screen";
import { Switch } from "../../../ui/Switch";
import { Text } from "../../../ui/Text";
import { offlineTexts } from "../../../strings/api-errors.pt-BR";
import { useCardShare } from "../hooks/use-card-share";
import { useProfileView } from "../hooks/use-profile-view";
import { isBusy } from "../model/card-share.reducer";
import { noticeOf, offersSettings } from "../model/card-share.selectors";
import { playerCardOf } from "../model/player-card";
import { meRoutes } from "../navigation";
import { PlayerCardView } from "./PlayerCardView";

const { cardShare } = strings.profile;
/** The card of the drawing is 270 of 390 wide. */
const CARD_WIDTH = "70%";
const DISABLED_OPACITY = 0.6;

/** Screen 15: the whole card, the switch for the numbers, and the two ways out of it (E4.13, part 2). */
export function CardShareScreen() {
  const { view, retry } = useProfileView();
  return (
    <Screen scroll>
      <BackBar title={cardShare.title} fallbackHref={meRoutes.card} look="heading" />
      {view.kind === "loading" ? (
        <LoadingState accessibilityLabel={strings.profile.me.loading} />
      ) : null}
      {view.kind === "offline-empty" ? (
        <EmptyState
          title={strings.profile.me.offlineTitle}
          body={strings.profile.me.offlineBody}
          actions={[{ label: strings.profile.me.retry, variant: "secondary", onPress: retry }]}
        />
      ) : null}
      {view.kind === "error" ? (
        <EmptyState
          alert
          title={strings.profile.me.loadFailed}
          body={apiErrorText(view.error)}
          actions={[{ label: strings.profile.me.retry, variant: "secondary", onPress: retry }]}
        />
      ) : null}
      {view.kind === "ready" || view.kind === "empty" ? (
        <CardShareBody stale={view.stale} card={playerCardOf(view.profile, view.stats)} />
      ) : null}
    </Screen>
  );
}

export interface CardShareBodyProps {
  readonly stale: boolean;
  readonly card: ReturnType<typeof playerCardOf>;
}

function CardShareBody({ stale, card }: CardShareBodyProps) {
  const { colors, tokens } = useTheme();
  const target = useRef<ComponentRef<typeof View>>(null);
  // A single isolated field: not kept between visits (frontend.md, rule 4).
  const [showStats, setShowStats] = useState(true);
  const model = useCardShare(target);
  const busy = isBusy(model.state);
  const notice = noticeOf(model.state);
  return (
    <View style={{ gap: tokens.spacing.l }}>
      {stale ? <OfflineBanner text={offlineTexts.bannerNow} /> : null}
      <View ref={target} collapsable={false} style={{ width: CARD_WIDTH, alignSelf: "center" }}>
        <PlayerCardView card={card} size="full" showStats={showStats} />
      </View>
      <View style={{ gap: tokens.spacing.s }}>
        <Text variant="bodyStrong" accessibilityRole="header">
          {cardShare.optionsTitle}
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingLeft: tokens.spacing.m,
            borderRadius: tokens.radii.button,
            backgroundColor: colors.surface,
            borderWidth: tokens.borderWidths.thin,
            borderColor: colors.borderCard,
          }}
        >
          <Text variant="bodyStrong">{cardShare.showStats}</Text>
          <Switch
            checked={showStats}
            onChange={setShowStats}
            accessibilityLabel={cardShare.showStats}
            disabled={busy}
          />
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: tokens.spacing.s }}>
        <ShareTile
          label={cardShare.whatsapp}
          disabled={busy}
          onPress={model.share}
          icon={<ShareIcon color={colors.text} />}
        />
        <ShareTile
          label={cardShare.save}
          disabled={busy}
          onPress={model.save}
          icon={<DownloadIcon color={colors.text} />}
        />
      </View>
      {model.state.status === "capturing" ? (
        <Text variant="caption">{cardShare.working}</Text>
      ) : null}
      {notice === null ? null : model.state.status === "failed" ? (
        <View style={{ gap: tokens.spacing.s }}>
          <ErrorStrip text={notice} />
          {offersSettings(model.state) ? (
            <Button label={cardShare.openSettings} variant="outline" onPress={model.openSettings} />
          ) : null}
        </View>
      ) : (
        <Text variant="bodyStrong" accessibilityRole="alert">
          {notice}
        </Text>
      )}
      <Text variant="caption" style={{ textAlign: "center" }}>
        {cardShare.note}
      </Text>
    </View>
  );
}

export interface ShareTileProps {
  readonly label: string;
  readonly icon: ReactNode;
  readonly disabled: boolean;
  readonly onPress: () => void;
}

/** `.sh`: the icon over the label, in a white tile. */
function ShareTile({ label, icon, disabled, onPress }: ShareTileProps) {
  const { colors, tokens } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: tokens.sizes.systemButton,
        alignItems: "center",
        justifyContent: "center",
        gap: tokens.spacing.xs,
        borderRadius: tokens.radii.button,
        backgroundColor: colors.surface,
        borderWidth: tokens.borderWidths.thin,
        borderColor: colors.borderCard,
        opacity: disabled ? DISABLED_OPACITY : 1,
      }}
    >
      {icon}
      <Text variant="bodyStrong">{label}</Text>
    </Pressable>
  );
}
