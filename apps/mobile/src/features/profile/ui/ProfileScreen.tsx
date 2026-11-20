import { Pressable, View } from "react-native";

import { apiErrorText } from "../../../services/api/api-error-text";
import { offlineTexts } from "../../../strings/api-errors.pt-BR";
import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { Button } from "../../../ui/Button";
import { EmptyState } from "../../../ui/EmptyState";
import { LockIcon } from "../../../ui/Icons";
import { LoadingState } from "../../../ui/LoadingState";
import { GearIcon, ShareIcon } from "../../../ui/MenuIcons";
import { OfflineBanner } from "../../../ui/OfflineBanner";
import { Screen } from "../../../ui/Screen";
import { Text } from "../../../ui/Text";
import { useProfileView } from "../hooks/use-profile-view";
import { groupRowsOf } from "../model/group-stats";
import { playerCardOf, positionLineOf, statTilesOf } from "../model/player-card";
import type { ProfileView } from "../model/profile-view";
import { GroupStatsRow } from "./GroupStatsRow";
import { PlayerCardView } from "./PlayerCardView";
import { StatTile } from "./StatTile";

type LoadedView = Extract<ProfileView, { readonly kind: "ready" | "empty" }>;

const { me } = strings.profile;
/** The compact card takes this share of the row; the rest is the name and the buttons (190 of 358). */
const COMPACT_CARD_BASIS = "53%";

export interface ProfileScreenProps {
  /** The name of the Google account, only for the line at the top; the card never has it (question 163). */
  readonly accountName: string | null;
  readonly onOpenAccount: () => void;
  readonly onShare: () => void;
  readonly onEditProfile: () => void;
}

/** The "Eu" tab (screen 14): the card, the six numbers of the season and the numbers per group. */
export function ProfileScreen({
  accountName,
  onOpenAccount,
  onShare,
  onEditProfile,
}: ProfileScreenProps) {
  const { view, retry } = useProfileView();
  return (
    <Screen aboveTabBar scroll>
      <Header onOpenAccount={onOpenAccount} />
      <ProfileBody
        view={view}
        accountName={accountName}
        onRetry={retry}
        onShare={onShare}
        onEditProfile={onEditProfile}
      />
    </Screen>
  );
}

interface HeaderProps {
  readonly onOpenAccount: () => void;
}

function Header({ onOpenAccount }: HeaderProps) {
  const { colors, tokens } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Text variant="display" displaySize="displayTitle" accessibilityRole="header">
        {me.title}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={me.settings}
        onPress={onOpenAccount}
        style={{
          width: tokens.sizes.iconButton,
          height: tokens.sizes.iconButton,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <GearIcon color={colors.text} />
      </Pressable>
    </View>
  );
}

interface ProfileBodyProps extends Omit<ProfileScreenProps, "onOpenAccount"> {
  readonly view: ProfileView;
  readonly onRetry: () => void;
}

function retryAction(onPress: () => void) {
  return { label: me.retry, variant: "secondary" as const, onPress };
}

function ProfileBody({ view, onRetry, ...rest }: ProfileBodyProps) {
  switch (view.kind) {
    case "loading":
      return <LoadingState accessibilityLabel={me.loading} />;
    case "offline-empty":
      return (
        <EmptyState
          title={me.offlineTitle}
          body={me.offlineBody}
          actions={[retryAction(onRetry)]}
        />
      );
    case "error":
      return (
        <EmptyState
          alert
          title={me.loadFailed}
          body={apiErrorText(view.error)}
          actions={[retryAction(onRetry)]}
        />
      );
    case "empty":
    case "ready":
      return <LoadedBody view={view} {...rest} />;
  }
}

interface LoadedBodyProps extends Omit<ProfileScreenProps, "onOpenAccount"> {
  readonly view: LoadedView;
}

function LoadedBody({ view, accountName, onShare, onEditProfile }: LoadedBodyProps) {
  const { tokens } = useTheme();
  const card = playerCardOf(view.profile, view.stats);
  const positionLine = positionLineOf(view.profile);
  return (
    <View style={{ gap: tokens.spacing.xl }}>
      {view.stale ? <OfflineBanner text={offlineTexts.bannerNow} /> : null}
      <View style={{ flexDirection: "row", gap: tokens.spacing.s14, alignItems: "stretch" }}>
        <View style={{ flexBasis: COMPACT_CARD_BASIS }}>
          <PlayerCardView card={card} size="compact" showStats />
        </View>
        <View style={{ flex: 1, gap: tokens.spacing.s10 }}>
          <View>
            <Text variant="title" numberOfLines={2}>
              {accountName ?? card.nickname}
            </Text>
            {positionLine === null ? null : <Text variant="muted">{positionLine}</Text>}
          </View>
          <View style={{ flexDirection: "row", gap: tokens.spacing.xs, alignItems: "flex-start" }}>
            <LockIcon />
            <Text variant="caption" style={{ flex: 1 }}>
              {me.numbersFromScore}
            </Text>
          </View>
          <View style={{ flex: 1 }} />
          <Button
            label={me.share}
            onPress={onShare}
            renderIcon={(color) => <ShareIcon color={color} />}
          />
          <Button label={me.editProfile} onPress={onEditProfile} variant="outline" />
        </View>
      </View>
      {view.kind === "empty" ? (
        <Text variant="muted">{me.emptyStats}</Text>
      ) : (
        <Numbers view={view} />
      )}
    </View>
  );
}

interface NumbersProps {
  readonly view: LoadedView;
}

/** "Estatísticas" of all groups, then "Por grupo". */
function Numbers({ view }: NumbersProps) {
  const { colors, tokens } = useTheme();
  const rows = groupRowsOf(view.stats);
  return (
    <View style={{ gap: tokens.spacing.xl }}>
      <View style={{ gap: tokens.spacing.s }}>
        <View
          style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}
        >
          <Text variant="title" accessibilityRole="header">
            {me.statsTitle}
          </Text>
          <Text variant="caption">{me.allGroups(view.stats.year)}</Text>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.spacing.s }}>
          {statTilesOf(view.stats.total).map((tile) => (
            <StatTile key={tile.key} tile={tile} />
          ))}
        </View>
      </View>
      {rows.length === 0 ? null : (
        <View style={{ gap: tokens.spacing.s }}>
          <Text variant="title" accessibilityRole="header">
            {me.byGroupTitle}
          </Text>
          <View
            style={{
              backgroundColor: colors.surface,
              borderWidth: tokens.borderWidths.thin,
              borderColor: colors.borderCard,
              borderRadius: tokens.radii.button,
              overflow: "hidden",
            }}
          >
            {rows.map((row, index) => (
              <GroupStatsRow key={row.groupId} row={row} last={index === rows.length - 1} />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
