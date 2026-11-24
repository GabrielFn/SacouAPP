import type { Group, Member, Round } from "../../../services/api/sacou-api";
import { strings } from "../../../strings/pt-BR";
import { BackBar } from "../../../ui/BackBar";
import { ConfirmSheet } from "../../../ui/ConfirmSheet";
import { ErrorStrip } from "../../../ui/ErrorStrip";
import { Screen } from "../../../ui/Screen";
import { groupsHref } from "../../groups/navigation";
import type { RoundScreenModel } from "../hooks/use-round-screen";
import { holdsSpot, presenceCounts, type PresenceCardView } from "../model/presence-card";
import { roundChips, sourceReader } from "../model/round-chips";
import { isEnded, roleHeader, type RoundSettingsView } from "../model/round-detail";
import { playerPresence, rosterView, type RosterView } from "../model/round-screen-view";
import { roundTeamsView, type RoundTeamsView } from "../model/round-teams";
import { ConfirmedBlock } from "./ConfirmedBlock";
import { ConfirmedSheet } from "./ConfirmedSheet";
import { EndedBadge, EndedFooter } from "./EndedRound";
import { PresenceCard } from "./PresenceCard";
import { PresenceFooter } from "./PresenceFooter";
import { RoundTeamsCard } from "./RoundTeamsCard";
import { RoundChips } from "./RoundChips";
import { RoundHeading } from "./RoundHeading";
import { SummaryLink } from "./SummaryLink";

const { presence, detail } = strings.rounds;

export interface PlayerBodyProps {
  readonly round: Round;
  readonly settings: RoundSettingsView | null;
  readonly card: PresenceCardView | null;
  readonly roster: RosterView;
  /** The published teams (R100), `null` with none. */
  readonly teams: RoundTeamsView | null;
  readonly onSeeAll: () => void;
}

/** The pills, the "Sua presença" card and the confirmed of screen 26. */
function PlayerBody({ round, settings, card, roster, teams, onSeeAll }: PlayerBodyProps) {
  if (settings === null) return <ErrorStrip text={detail.loadError} />;
  const chips = roundChips(settings.values, sourceReader(settings.sources), {
    withRotation: true,
  });
  return (
    <>
      <RoundChips chips={chips} legend={false} />
      {card === null ? null : (
        <>
          <PresenceCard
            view={card}
            counts={presenceCounts(round, settings.values)}
            going={holdsSpot(round)}
          />
          {teams === null ? null : <RoundTeamsCard view={teams} listChangedText={null} />}
          <ConfirmedBlock
            going={roster.going}
            meId={round.me.memberId}
            waitlist={roster.waitlist}
            onSeeAll={onSeeAll}
          />
        </>
      )}
    </>
  );
}

export interface PlayerRoundScreenProps {
  readonly group: Group;
  readonly round: Round;
  readonly settings: RoundSettingsView | null;
  readonly members: readonly Member[];
  readonly model: RoundScreenModel;
}

/** Screen 26, for the player and the scorekeeper: the own answer and who is going (D7). */
export function PlayerRoundScreen({
  group,
  round,
  settings,
  members,
  model,
}: PlayerRoundScreenProps) {
  const { state, dispatch } = model;
  const roster = rosterView(round, settings, members);
  const card = playerPresence(round, settings, members, model.now);
  const ended = isEnded(round, model.now);
  const close = () => {
    dispatch({ type: "sheet-closed" });
  };
  return (
    <Screen
      footer={
        ended ? (
          <EndedFooter groupId={group.groupId} roundId={round.roundId} />
        ) : card === null ? undefined : (
          <PresenceFooter
            actions={card.actions}
            pending={model.responding}
            onRespond={model.respond}
            onAskLeave={() => {
              dispatch({ type: "leave-asked" });
            }}
          />
        )
      }
    >
      <BackBar title={roleHeader(group.role)} fallbackHref={groupsHref} />
      <RoundHeading groupName={group.name} round={round} />
      {ended ? <EndedBadge /> : null}
      <SummaryLink groupId={group.groupId} round={round} now={model.now} />
      <PlayerBody
        round={round}
        settings={settings}
        card={card}
        roster={roster}
        teams={roundTeamsView(round, members)}
        onSeeAll={() => {
          dispatch({ type: "confirmed-opened" });
        }}
      />
      {model.errorText === null ? null : <ErrorStrip text={model.errorText} />}
      <ConfirmedSheet
        visible={state.sheet.kind === "confirmed"}
        going={roster.going}
        waitlistLine={roster.waitlist}
        meId={round.me.memberId}
        onRemove={null}
        removing={false}
        onClose={close}
      />
      <ConfirmSheet
        visible={state.sheet.kind === "leave"}
        title={presence.leaveTitle}
        body={presence.leaveBody}
        confirmLabel={presence.leaveConfirm}
        cancelLabel={presence.keep}
        onConfirm={() => {
          model.respond("notGoing");
        }}
        onCancel={close}
      />
    </Screen>
  );
}
