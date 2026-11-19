import type { CourtSessionTimeline } from "@sacou/match-engine";
import { useMemo } from "react";
import { View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { Button } from "../../../ui/Button";
import { Text } from "../../../ui/Text";
import { setEndAttribution } from "../attribution/set-end-attribution";
import { useAttributionSheet } from "../hooks/use-attribution-sheet";
import { useIndividualPoints } from "../hooks/use-individual-points";
import type { PlayCommand } from "../session/command-drafts";
import type { CommandResult } from "../session/court-session-controller";
import { AttributionSheet } from "./AttributionSheet";

export interface SetEndAttributionProps {
  readonly timeline: CourtSessionTimeline;
  readonly dispatch: (command: PlayCommand) => Promise<CommandResult>;
}

/**
 * The points of the decided set nobody answered, on screen 25, and screen 31 to fill them in, oldest
 * first. Filling in is optional: "Confirmar" never waits for it (D10). Draw it last in a column under
 * the screen: the line takes its place at the bottom, and the sheet comes over the rest.
 */
export function SetEndAttribution({ timeline, dispatch }: SetEndAttributionProps) {
  const { colors, tokens } = useTheme();
  const individualPoints = useIndividualPoints();
  const sheet = useAttributionSheet(timeline, dispatch);
  const model = useMemo(
    () => setEndAttribution(timeline, individualPoints),
    [timeline, individualPoints],
  );
  return (
    <>
      {model === null ? null : (
        <View
          style={{
            paddingHorizontal: tokens.spacing.xl,
            paddingVertical: tokens.spacing.s,
            gap: tokens.spacing.xs,
            backgroundColor: colors.background,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.s }}>
            <Text variant="bodyStrong" style={{ flex: 1 }}>
              {model.text}
            </Text>
            <Button
              label={strings.courtPlayers.attribution.fill}
              variant="outline"
              onPress={() => {
                sheet.open(model.pointEventIds);
              }}
            />
          </View>
          {model.lastChance === null ? null : <Text variant="muted">{model.lastChance}</Text>}
        </View>
      )}
      {sheet.model === null ? null : (
        <AttributionSheet
          model={sheet.model}
          onChooseKind={sheet.onChooseKind}
          onAuthor={sheet.onAuthor}
          onOpponentError={sheet.onOpponentError}
          onSkip={sheet.onSkip}
          onClose={sheet.onClose}
        />
      )}
    </>
  );
}
