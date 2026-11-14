import type { GroupSettings } from "@sacou/match-engine";
import { Redirect, useRouter } from "expo-router";
import { Pressable, View } from "react-native";

import { errorTextOf } from "../../../services/api/api-error-text";
import { wallClockNow } from "../../../services/api/wall-clock";
import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { fontFamilies } from "../../../theme/tokens.data";
import { BottomSheet } from "../../../ui/BottomSheet";
import { Button } from "../../../ui/Button";
import { EmptyState } from "../../../ui/EmptyState";
import { ErrorStrip } from "../../../ui/ErrorStrip";
import { FieldFrame } from "../../../ui/FieldFrame";
import { BackBar } from "../../../ui/BackBar";
import { LoadingState } from "../../../ui/LoadingState";
import { Screen } from "../../../ui/Screen";
import { Switch } from "../../../ui/Switch";
import { Text } from "../../../ui/Text";
import { TextField } from "../../../ui/TextField";
import { groupsHref } from "../../groups/navigation";
import { formatTime } from "../../groups/model/schedule-text";
import { useGroup, useGroupSettings } from "../../groups/queries/use-group-queries";
import { useCreateRound, type CreateRoundModel } from "../hooks/use-create-round";
import { firstRoundDate } from "../model/create-round.selectors";
import { dateLabel } from "../model/round-dates";
import { roundChips, sourceReader } from "../model/round-chips";
import { managesRounds } from "../model/round-detail";
import { hasUpcomingSeries } from "../model/round-series";
import { roundHref } from "../navigation";
import { useRounds } from "../queries/use-round-queries";
import { DatePickerSheet } from "./DatePickerSheet";
import { PersonalizeSection } from "./PersonalizeSection";
import { RoundChips } from "./RoundChips";

const { create } = strings.rounds;

export interface PickerFieldProps {
  readonly label: string;
  readonly value: string;
  readonly error: string | null;
  readonly onPress: () => void;
}

/** A field that opens a sheet instead of a keyboard (day and time). */
function PickerField({ label, value, error, onPress }: PickerFieldProps) {
  const { colors, tokens } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <FieldFrame label={label}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${value}`}
          onPress={onPress}
          style={{
            minHeight: tokens.sizes.field,
            justifyContent: "center",
            borderRadius: tokens.radii.field,
            borderWidth: tokens.borderWidths.thin,
            borderColor: error === null ? colors.borderField : colors.primary,
            backgroundColor: colors.surface,
            paddingHorizontal: tokens.spacing.m,
          }}
        >
          <Text style={{ fontFamily: fontFamilies.body600, fontSize: tokens.fontSizes.field }}>
            {value}
          </Text>
        </Pressable>
        {error === null ? null : (
          <Text variant="caption" accessibilityRole="alert" style={{ color: colors.text }}>
            {error}
          </Text>
        )}
      </FieldFrame>
    </View>
  );
}

export interface TimeSheetProps {
  readonly model: CreateRoundModel;
}

/** The time in `HH:mm`, edited in place; confirming only closes the sheet. */
function TimeSheet({ model }: TimeSheetProps) {
  const { state, errors, dispatch } = model;
  const close = () => {
    dispatch({ type: "sheet-closed" });
  };
  return (
    <BottomSheet visible={state.sheet.kind === "time"} title={create.pickTime} onClose={close}>
      <TextField
        label={create.time}
        value={state.localTime}
        help={create.timeHint}
        error={errors.time ?? undefined}
        keyboardType="numbers-and-punctuation"
        onChangeText={(localTime) => {
          dispatch({ type: "time-picked", localTime });
        }}
      />
      <Button
        label={create.confirm}
        onPress={() => {
          if (errors.time === null) close();
        }}
      />
    </BottomSheet>
  );
}

export interface CreateRoundFormProps {
  readonly groupId: string;
  readonly groupName: string;
  readonly settings: GroupSettings;
  readonly hasSeries: boolean;
}

/** Screen 20 once the group's settings are known: the state starts from them, never copies them again. */
function CreateRoundForm({ groupId, groupName, settings, hasSeries }: CreateRoundFormProps) {
  const router = useRouter();
  const { tokens } = useTheme();
  const model = useCreateRound({ groupId, groupName, settings, hasSeries }, (roundId) => {
    router.replace(roundHref(groupId, roundId));
  });
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
            label={model.pending ? create.publishing : create.publish}
            onPress={model.publish}
          />
        </>
      }
    >
      <BackBar title={groupName} fallbackHref={groupsHref} />
      <View style={{ gap: tokens.spacing.xs }}>
        <Text variant="display" displaySize="displayMedium" accessibilityRole="header">
          {create.title}
        </Text>
        <Text variant="muted">{create.subtitle}</Text>
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
      <RepeatRow model={model} enabled={settings.schedule.enabled} />
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
      <TimeSheet model={model} />
    </Screen>
  );
}

export interface RepeatRowProps {
  readonly model: CreateRoundModel;
  /** Without a fixed day the group has no weekly rhythm to repeat. */
  readonly enabled: boolean;
}

function RepeatRow({ model, enabled }: RepeatRowProps) {
  const { tokens } = useTheme();
  if (!enabled) return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.m }}>
      <View style={{ flex: 1, gap: tokens.spacing.xs }}>
        <Text variant="bodyStrong">{create.repeat}</Text>
        <Text variant="caption">{model.repeatText}</Text>
      </View>
      <Switch
        checked={model.state.repeatWeekly}
        accessibilityLabel={create.repeat}
        onChange={() => {
          model.dispatch({ type: "repeat-toggled" });
        }}
      />
    </View>
  );
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
    const failed = group.error ?? settings.error ?? rounds.error;
    if (failed === null) {
      return (
        <Screen>
          <LoadingState accessibilityLabel={create.loading} />
        </Screen>
      );
    }
    return (
      <Screen>
        <EmptyState
          alert
          title={create.loadError}
          body={errorTextOf(failed)}
          actions={[
            {
              label: create.retry,
              variant: "secondary",
              onPress: () => {
                void group.refetch();
                void settings.refetch();
                void rounds.refetch();
              },
            },
          ]}
        />
      </Screen>
    );
  }
  return (
    <CreateRoundForm
      groupId={groupId}
      groupName={group.data.name}
      settings={settings.data.settings}
      hasSeries={hasUpcomingSeries(rounds.data, wallClockNow())}
    />
  );
}
