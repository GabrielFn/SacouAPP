import type { MemberId, TeamSide } from "@sacou/match-engine";
import type { RotationSlot } from "@sacou/volley-rules";
import { useWindowDimensions, View } from "react-native";

import { lineupStrings as texts } from "../../../strings/lineup.pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { Button } from "../../../ui/Button";
import { BackIcon } from "../../../ui/Icons";
import { IconButton } from "../../../ui/IconButton";
import { Screen } from "../../../ui/Screen";
import { SegmentBar } from "../../../ui/SegmentBar";
import { Text } from "../../../ui/Text";
import type { LineupTeamView, LineupView } from "../model/lineup-selectors";
import { LiberoPicker } from "./LiberoPicker";
import { LineupCourt } from "./LineupCourt";
import { OfficialOrder } from "./OfficialOrder";
import { RoleWarningBanner } from "./RoleWarningBanner";
import { RotationSelector } from "./RotationSelector";
import { SectionHeading } from "./SectionHeading";

/** What screen 22 can do; the host decides where "Salvar" and "Voltar" go (D1). */
export interface LineupScreenHandlers {
  readonly onBack: () => void;
  readonly onTab: (side: TeamSide) => void;
  readonly onPlayer: (memberId: MemberId) => void;
  readonly onRotation: (zone: RotationSlot) => void;
  readonly onMakeSetter: () => void;
  readonly onFixRoles: () => void;
  readonly onLibero: (memberId: MemberId | null) => void;
  readonly onSave: () => void;
}

export interface LineupScreenProps {
  /** Everything derived (D2): names, places and texts, never a level. */
  readonly view: LineupView;
  readonly handlers: LineupScreenHandlers;
  /** Why the last "Salvar" did nothing, in words (match only, D7). */
  readonly refusal?: string | null;
  /** "Salvar" is on its way: it stays off until the host answers. */
  readonly busy?: boolean;
}

export interface LineupHeaderProps {
  readonly view: LineupView;
  readonly onBack: () => void;
}

/** "Escalação" with the match line and the system, without the "Pro" badge (ADR 0046, D9). */
function LineupHeader({ view, onBack }: LineupHeaderProps) {
  const { colors, tokens } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.xs }}>
      <IconButton accessibilityLabel={texts.back} onPress={onBack}>
        <BackIcon />
      </IconButton>
      <View style={{ flex: 1 }}>
        <Text variant="display" displaySize="displayMedium" accessibilityRole="header">
          {texts.title}
        </Text>
        <Text variant="muted">{view.subtitle}</Text>
      </View>
      {view.team === null ? null : (
        <View
          style={{
            paddingHorizontal: tokens.spacing.s10,
            minHeight: tokens.sizes.statusPill,
            justifyContent: "center",
            borderRadius: tokens.radii.statusPill,
            borderWidth: tokens.borderWidths.thin,
            borderColor: colors.borderCard,
            backgroundColor: colors.surface,
          }}
        >
          <Text variant="bodyStrong">{view.team.system}</Text>
        </View>
      )}
    </View>
  );
}

export interface TeamPartProps {
  readonly team: LineupTeamView;
  readonly handlers: LineupScreenHandlers;
}

function RotationBlock({ team, handlers }: TeamPartProps) {
  const { tokens } = useTheme();
  return (
    <View style={{ gap: tokens.spacing.s6 }}>
      <SectionHeading title={texts.rotation} detail={team.phaseLabel} />
      {team.rotation === null ? null : (
        <RotationSelector
          label={team.rotation.label}
          options={team.rotation.options}
          onSelect={handlers.onRotation}
        />
      )}
    </View>
  );
}

/** The hint, "Tornar levantador" for a selected member, and the warnings (D3, D4). */
function EditBlock({ team, handlers }: TeamPartProps) {
  const { tokens } = useTheme();
  return (
    <View style={{ gap: tokens.spacing.s }}>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          gap: tokens.spacing.s,
        }}
      >
        <Text variant="muted" style={{ flexShrink: 1 }}>
          {texts.hint}
        </Text>
        {team.canMakeSetter ? (
          <Button label={texts.makeSetter} variant="outline" onPress={handlers.onMakeSetter} />
        ) : null}
      </View>
      {team.stale ? <RoleWarningBanner text={texts.stale} onFix={null} /> : null}
      {team.warning === null ? null : (
        <RoleWarningBanner text={team.warning} onFix={handlers.onFixRoles} />
      )}
    </View>
  );
}

function DetailsBlock({ team, handlers }: TeamPartProps) {
  const { tokens } = useTheme();
  return (
    <View style={{ gap: tokens.spacing.m }}>
      <OfficialOrder cells={team.order} benchLine={team.benchLine} />
      <LiberoPicker row={team.libero} onSelect={handlers.onLibero} />
      {team.serverChange === null ? null : <Text variant="bodyStrong">{team.serverChange}</Text>}
    </View>
  );
}

export interface TeamBodyProps extends TeamPartProps {
  readonly landscape: boolean;
}

/** Portrait as the canvas; on its side, two columns: the court on the left, the rest on the right (D8). */
function TeamBody({ team, handlers, landscape }: TeamBodyProps) {
  const { tokens } = useTheme();
  const court = (
    <LineupCourt
      team={team.name}
      color={team.color}
      chips={team.chips}
      caption={team.courtCaption}
      onPress={handlers.onPlayer}
    />
  );
  if (!landscape) {
    return (
      <>
        <RotationBlock team={team} handlers={handlers} />
        <View style={{ marginHorizontal: -tokens.spacing.xl }}>{court}</View>
        <EditBlock team={team} handlers={handlers} />
        <DetailsBlock team={team} handlers={handlers} />
      </>
    );
  }
  return (
    <View style={{ flexDirection: "row", gap: tokens.spacing.l }}>
      <View style={{ flex: 1 }}>{court}</View>
      <View style={{ flex: 1, gap: tokens.spacing.m }}>
        <RotationBlock team={team} handlers={handlers} />
        <EditBlock team={team} handlers={handlers} />
        <DetailsBlock team={team} handlers={handlers} />
      </View>
    </View>
  );
}

export interface SaveFooterProps {
  readonly refusal: string | null;
  readonly disabled: boolean;
  readonly onSave: () => void;
}

function SaveFooter({ refusal, disabled, onSave }: SaveFooterProps) {
  const { colors, tokens } = useTheme();
  return (
    <View style={{ gap: tokens.spacing.s }}>
      {refusal === null ? null : (
        <Text accessibilityRole="alert" style={{ color: colors.refusal }}>
          {refusal}
        </Text>
      )}
      <Button label={texts.save} disabled={disabled} onPress={onSave} />
    </View>
  );
}

/** Screen 22, Escalação (Escalacao.dc.html): the same for the pre-game and the match (D1). */
export function LineupScreen({ view, handlers, refusal = null, busy = false }: LineupScreenProps) {
  const { width, height } = useWindowDimensions();
  return (
    <Screen
      footer={
        <SaveFooter refusal={refusal} disabled={busy || !view.canSave} onSave={handlers.onSave} />
      }
    >
      <LineupHeader view={view} onBack={handlers.onBack} />
      <SegmentBar<TeamSide>
        role="tabs"
        options={view.tabs.map((tab) => ({ value: tab.side, label: tab.label }))}
        selected={view.tab}
        accessibilityLabel={texts.teams}
        onSelect={handlers.onTab}
      />
      {view.team === null ? (
        <Text variant="muted">{view.noRotation}</Text>
      ) : (
        <TeamBody
          team={busy ? { ...view.team, stale: false } : view.team}
          handlers={handlers}
          landscape={width > height}
        />
      )}
    </Screen>
  );
}
