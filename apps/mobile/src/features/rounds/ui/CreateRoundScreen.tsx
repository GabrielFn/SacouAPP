import type { GroupSettings } from "@sacou/match-engine";
import { Redirect, useRouter } from "expo-router";
import { View } from "react-native";

import type { Round } from "../../../services/api/sacou-api";
import { wallClockNow } from "../../../services/api/wall-clock";
import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { Button } from "../../../ui/Button";
import { ErrorStrip } from "../../../ui/ErrorStrip";
import { BackBar } from "../../../ui/BackBar";
import { Screen } from "../../../ui/Screen";
import { Text } from "../../../ui/Text";
import { TextField } from "../../../ui/TextField";
import { groupsHref } from "../../groups/navigation";
import { formatTime } from "../../groups/model/schedule-text";
import { useGroup, useGroupSettings } from "../../groups/queries/use-group-queries";
import { useCreateRound, type CreateRoundModel } from "../hooks/use-create-round";
import { useEditRound } from "../hooks/use-edit-round";
import { firstRoundDate } from "../model/create-round.selectors";
import { dateLabel } from "../model/round-dates";
import { roundChips, sourceReader } from "../model/round-chips";
import { managesRounds, roundSettingsOf, type RoundSettingsView } from "../model/round-detail";
import { hasUpcomingSeries, takenRoundDates } from "../model/round-series";
import { roundHref } from "../navigation";
import { useRound, useRounds } from "../queries/use-round-queries";
import { DatePickerSheet } from "./DatePickerSheet";
import { FormLoading, PickerField, RepeatRow, TimeSheet } from "./RoundFormParts";
import { PersonalizeSection } from "./PersonalizeSection";
import { RoundChips } from "./RoundChips";

const { create } = strings.rounds;

export interface RoundFormProps {
  readonly groupName: string;
  readonly settings: GroupSettings;
  readonly model: CreateRoundModel;
  /** "Editar rodada": its own title, "Salvar", and no "Repetir toda semana" (one round only). */
  readonly editing: boolean;
}

function buttonLabel(editing: boolean, pending: boolean): string {
  if (editing) return pending ? create.saving : create.save;
  return pending ? create.publishing : create.publish;
}

/** The form of screen 20, for a new round and an edited one; the hook that runs it decides the call. */
function RoundForm({ groupName, settings, model, editing }: RoundFormProps) {
  const { tokens } = useTheme();
  const { state, errors, dispatch } = model;
  const chips = roundChips(model.resolved.values, sourceReader(model.resolved.sources), {
    withRotation: true,
  });
  return (
    <Screen
      footer={
        <>
          {model.errorText !== null ? <ErrorStrip text={model.errorText} /> : null}
          <Button
            label={buttonLabel(editing, model.pending)}
            disabled={model.publishDisabled}
            onPress={model.publish}
          />
        </>
      }
    >
      <BackBar title={groupName} fallbackHref={groupsHref} />
      <View style={{ gap: tokens.spacing.xs }}>
        <Text variant="display" displaySize="displayMedium" accessibilityRole="header">
          {editing ? create.editTitle : create.title}
        </Text>
        <Text variant="muted">{editing ? create.editSubtitle : create.subtitle}</Text>
      </View>
      <View style={{ flexDirection: "row", gap: tokens.spacing.m }}>
        <PickerField
          label={create.day}
          value={dateLabel(state.localDate)}
          error={errors.date}
          onPress={() => {
            dispatch({ type: "sheet-opened", sheet: { kind: "date" } });
          }}
        />
        <PickerField
          label={create.time}
          value={formatTime(state.localTime)}
          error={errors.time}
          onPress={() => {
            dispatch({ type: "sheet-opened", sheet: { kind: "time" } });
          }}
        />
      </View>
      <TextField
        label={create.venue}
        value={state.venue}
        error={errors.venue ?? undefined}
        onChangeText={(venue) => {
          dispatch({ type: "venue-changed", venue });
        }}
      />
      {settings.attendance.enabled ? (
        <TextField
          label={create.capacity}
          value={state.capacityText}
          placeholder={create.capacityPlaceholder}
          keyboardType="number-pad"
          error={errors.capacity ?? undefined}
          onChangeText={(text) => {
            dispatch({ type: "capacity-changed", text });
          }}
        />
      ) : null}
      <View style={{ gap: tokens.spacing.s }}>
        <Text variant="bodyStrong">{create.howItGoes}</Text>
        <RoundChips chips={chips} />
      </View>
      <PersonalizeSection group={settings} model={model} />
      <RepeatRow model={model} enabled={!editing && settings.schedule.enabled} />
      <DatePickerSheet
        visible={state.sheet.kind === "date"}
        firstDate={firstRoundDate(settings, new Date(wallClockNow()))}
        selected={state.localDate}
        onPick={(localDate) => {
          dispatch({ type: "date-picked", localDate });
        }}
        onClose={() => {
          dispatch({ type: "sheet-closed" });
        }}
      />
      {state.sheet.kind === "time" ? <TimeSheet model={model} /> : null}
    </Screen>
  );
}

export interface NewRoundFormProps {
  readonly groupId: string;
  readonly groupName: string;
  readonly settings: GroupSettings;
  readonly hasSeries: boolean;
  readonly takenDates: readonly string[];
}

/** Screen 20 once the group's settings are known: the state starts from them, never copies them again. */
function NewRoundForm({ groupId, groupName, settings, hasSeries, takenDates }: NewRoundFormProps) {
  const router = useRouter();
  const model = useCreateRound(
    { groupId, groupName, settings, hasSeries, takenDates },
    (roundId) => {
      router.replace(roundHref(groupId, roundId));
    },
  );
  return <RoundForm groupName={groupName} settings={settings} model={model} editing={false} />;
}

export interface EditRoundFormProps {
  readonly groupId: string;
  readonly groupName: string;
  readonly settings: GroupSettings;
  readonly round: Round;
  readonly view: RoundSettingsView;
}

/** "Editar rodada": starts from the round in the cache; saving goes back to where it came from. */
function EditRoundForm({ groupId, groupName, settings, round, view }: EditRoundFormProps) {
  const router = useRouter();
  const model = useEditRound({ groupId, settings, round, view }, () => {
    if (router.canGoBack()) router.back();
    else router.replace(roundHref(groupId, round.roundId));
  });
  return <RoundForm groupName={groupName} settings={settings} model={model} editing />;
}

export interface CreateRoundScreenProps {
  readonly groupId: string;
}

/** Screen 20: the group's rules come from the cache, and the form starts only when they are all there. */
export function CreateRoundScreen({ groupId }: CreateRoundScreenProps) {
  const group = useGroup(groupId);
  const settings = useGroupSettings(groupId);
  const rounds = useRounds(groupId);
  if (group.data !== undefined && !managesRounds(group.data.role)) {
    return <Redirect href={groupsHref} />;
  }
  if (group.data === undefined || settings.data === undefined || rounds.data === undefined) {
    return <FormLoading queries={[group, settings, rounds]} />;
  }
  return (
    <NewRoundForm
      groupId={groupId}
      groupName={group.data.name}
      settings={settings.data.settings}
      hasSeries={hasUpcomingSeries(rounds.data, wallClockNow())}
      takenDates={takenRoundDates(rounds.data)}
    />
  );
}

export interface EditRoundScreenProps {
  readonly groupId: string;
  readonly roundId: string;
}

/** Screen 20 with `?roundId=`: only for who manages rounds; the others go back to the round. */
export function EditRoundScreen({ groupId, roundId }: EditRoundScreenProps) {
  const group = useGroup(groupId);
  const settings = useGroupSettings(groupId);
  const round = useRound(groupId, roundId);
  if (group.data !== undefined && !managesRounds(group.data.role)) {
    return <Redirect href={roundHref(groupId, roundId)} />;
  }
  if (group.data === undefined || settings.data === undefined || round.data === undefined) {
    return <FormLoading queries={[group, settings, round]} />;
  }
  const view = roundSettingsOf(round.data);
  if (view === null) return <Redirect href={roundHref(groupId, roundId)} />;
  return (
    <EditRoundForm
      groupId={groupId}
      groupName={group.data.name}
      settings={settings.data.settings}
      round={round.data}
      view={view}
    />
  );
}
