import { Fragment } from "react";
import { View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { Text } from "../../../ui/Text";
import type { TeamIdentity } from "../../draw/model/team-identity";
import { teamSwatch } from "../../draw/ui/team-swatch";
import {
  placementText,
  teamLabel,
  type RoundTeamView,
  type RoundTeamsView,
} from "../model/round-teams";

const { teams: texts } = strings.rounds;
const { share } = strings.draw;

export interface RoundTeamsCardProps {
  readonly view: RoundTeamsView;
  /** Only on screen 06: "A lista mudou depois dos times..." (question 180). `null` hides the line. */
  readonly listChangedText: string | null;
}

interface TeamLetterProps {
  readonly identity: TeamIdentity;
}

/** The little square with the letter, in the color of the team (as on screen 07). Decorative. */
function TeamLetter({ identity }: TeamLetterProps) {
  const { colors, tokens } = useTheme();
  const swatch = teamSwatch(identity.color, colors);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: tokens.sizes.teamBadge,
        aspectRatio: 1,
        borderRadius: tokens.radii.playerChip,
        backgroundColor: swatch.fill,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text variant="bodyStrong" style={{ color: swatch.onFill }}>
        {identity.letter}
      </Text>
    </View>
  );
}

interface TeamRowProps {
  readonly team: RoundTeamView;
}

/** "▌A▐ Laranja  Ana, João e você": one text for the screen reader. */
function TeamRow({ team }: TeamRowProps) {
  const { tokens } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={teamLabel(team)}
      style={{ flexDirection: "row", alignItems: "flex-start", gap: tokens.spacing.s }}
    >
      <TeamLetter identity={team.identity} />
      <Text variant="display" style={{ fontSize: tokens.fontSizes.teamTitle }}>
        {team.identity.name}
      </Text>
      <Text variant="muted" style={{ flex: 1, flexShrink: 1 }}>
        {team.names.map((name, index) => (
          <Fragment key={`${name.text}-${String(index)}`}>
            {texts.separator(index, team.names.length)}
            {name.me ? <Text variant="bodyStrong">{name.text}</Text> : name.text}
          </Fragment>
        ))}
      </Text>
    </View>
  );
}

/**
 * The "Times" card of screens 26 and 06 (R100, ADR 0078): the photo of the draw with its time, where the reader is,
 * the teams and the queue. No button and no level.
 */
export function RoundTeamsCard({ view, listChangedText }: RoundTeamsCardProps) {
  const { colors, tokens } = useTheme();
  const placement = placementText(view.me);
  const mine = view.me.kind === "team" ? view.me.team : null;
  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={texts.title}
      style={{
        gap: tokens.spacing.s,
        padding: tokens.spacing.m,
        borderRadius: tokens.radii.card,
        borderWidth: tokens.borderWidths.thin,
        borderColor: colors.borderCard,
        backgroundColor: colors.surface,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.s }}>
        <Text variant="bodyStrong" accessibilityRole="header" style={{ flex: 1 }}>
          {texts.title}
        </Text>
        {view.confirmedAtText === "" ? null : (
          <Text variant="muted">{texts.confirmedAt(view.confirmedAtText)}</Text>
        )}
      </View>
      {placement === null ? null : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.s }}>
          {mine === null ? null : <TeamLetter identity={mine} />}
          <Text variant="bodyStrong" style={{ flex: 1, flexShrink: 1 }}>
            {placement}
          </Text>
        </View>
      )}
      {view.teams.map((team) => (
        <TeamRow key={team.identity.letter} team={team} />
      ))}
      {view.reserves.length === 0 ? null : (
        <Text variant="muted">{share.reserves(view.reserves)}</Text>
      )}
      {listChangedText === null ? null : <Text variant="muted">{listChangedText}</Text>}
    </View>
  );
}
