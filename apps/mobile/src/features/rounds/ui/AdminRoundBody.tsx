import { View } from "react-native";

import type { Round } from "../../../services/api/sacou-api";
import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { Button } from "../../../ui/Button";
import { ErrorStrip } from "../../../ui/ErrorStrip";
import { PlusIcon } from "../../../ui/Icons";
import { ShareIcon } from "../../../ui/MenuIcons";
import { Text } from "../../../ui/Text";
import { hasRoundLayer, roundChips, sourceReader } from "../model/round-chips";
import { isCanceled, statsCells, type RoundSettingsView } from "../model/round-detail";
import { RoundChips } from "./RoundChips";
import { RoundStatsPanel } from "./RoundStatsPanel";
import { RoundTeamsCard, type RoundTeamsCardProps } from "./RoundTeamsCard";

const { detail } = strings.rounds;

export interface RoundBodyProps {
  readonly round: Round;
  readonly settings: RoundSettingsView;
  readonly waitlist: string;
  readonly onOpenConfirmed: () => void;
  readonly onAdd: () => void;
  /** A round that is over keeps its list but offers no "Adicionar" (R99). */
  readonly canAdd: boolean;
  /** The published teams (R100), `null` with none. */
  readonly teams: RoundTeamsCardProps | null;
  /** "Mandar no WhatsApp": only with the link of an open round (R101 item 1). */
  readonly canShare: boolean;
  readonly onShare: () => void;
  /** "A lista dos avulsos abre …", until the window opens (R101 item 2). */
  readonly dropInPhrase: string | null;
  readonly onChangeDropInWindow: () => void;
}

/** Everything under the title of screen 06: pills, panel, waitlist, "Adicionar…" or the canceled strip. */
export function RoundBody({
  round,
  settings,
  waitlist,
  onOpenConfirmed,
  onAdd,
  canAdd,
  teams,
  canShare,
  onShare,
  dropInPhrase,
  onChangeDropInWindow,
}: RoundBodyProps) {
  const { tokens } = useTheme();
  const chips = roundChips(settings.values, sourceReader(settings.sources), {
    withRotation: true,
  });
  return (
    <>
      <RoundChips chips={chips} legend={hasRoundLayer(settings.sources)} />
      {isCanceled(round) ? (
        <ErrorStrip text={detail.canceled} />
      ) : (
        <>
          <RoundStatsPanel
            cells={statsCells(round, settings.values)}
            onOpenConfirmed={onOpenConfirmed}
          />
          {dropInPhrase === null ? null : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.s }}>
              <Text variant="muted" style={{ flex: 1 }}>
                {detail.dropInWindow(dropInPhrase)}
              </Text>
              <Button
                label={detail.changeDropInWindow}
                variant="link"
                onPress={onChangeDropInWindow}
              />
            </View>
          )}
          {canShare ? (
            <Button
              label={detail.shareOnWhatsApp}
              accessibilityLabel={detail.shareOnWhatsAppAccessibility}
              variant="outline"
              renderIcon={(color) => <ShareIcon color={color} />}
              onPress={onShare}
            />
          ) : null}
          {waitlist === "" ? null : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.s }}>
              <Text variant="bodyStrong">{detail.waitlistTitle}</Text>
              <Text variant="muted" style={{ flexShrink: 1 }}>
                {waitlist}
              </Text>
            </View>
          )}
          {teams === null ? null : <RoundTeamsCard {...teams} />}
          {canAdd ? (
            <Button
              label={detail.addFromWhatsApp}
              variant="outline"
              renderIcon={(color) => <PlusIcon color={color} />}
              onPress={onAdd}
            />
          ) : null}
        </>
      )}
    </>
  );
}
