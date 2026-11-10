import { SETTINGS_MODALITIES, type SettingsTemplateKey } from "@sacou/match-engine";
import { useRouter } from "expo-router";
import { View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { Button } from "../../../ui/Button";
import { ErrorStrip } from "../../../ui/ErrorStrip";
import { Screen } from "../../../ui/Screen";
import { SegmentedControl } from "../../../ui/SegmentedControl";
import { StepHeader } from "../../../ui/StepHeader";
import { Text } from "../../../ui/Text";
import { TextField } from "../../../ui/TextField";
import { useCreateGroup } from "../hooks/use-create-group";
import { isScheduleChosen } from "../model/create-group.selectors";
import { scheduleText } from "../model/schedule-text";
import { afterCreateGroupHref, createGroupHref } from "../navigation";
import { CourtOption } from "./CourtOption";
import { QuestionSection } from "./QuestionSection";
import { ScheduleField } from "./ScheduleField";
import { ScheduleSheet } from "./ScheduleSheet";

const { step2, partial } = strings.createGroup;
const FINAL_STEP_PROGRESS = 1;
/** What the sheet opens with when nothing was chosen yet: Tuesday at 20:00, the catalog default. */
const SHEET_START = { weekday: 2, time: "20:00" } as const;
/** The three fields of "Quando e onde?" share the row as in the canvas (1.25 : 1.25 : 0.6). */
const SCHEDULE_FLEX = 1.25;
const CAPACITY_FLEX = 0.6;

export interface CreateGroupDetailsScreenProps {
  readonly templateKey: SettingsTemplateKey;
}

const YES_NO = [
  { value: true, label: step2.yes },
  { value: false, label: step2.no },
] as const;

/** Screen 05: the three questions. The reducer holds the answers; the hook makes the two calls. */
export function CreateGroupDetailsScreen({ templateKey }: CreateGroupDetailsScreenProps) {
  const router = useRouter();
  const { tokens } = useTheme();
  const model = useCreateGroup(templateKey, (groupId) => {
    router.replace(afterCreateGroupHref(groupId));
  });
  const { state, dispatch, errors } = model;
  const sheet = state.scheduleSheet;
  const created = state.submit.kind === "created-without-settings" ? state.submit : null;
  const scheduleLabel = isScheduleChosen(state)
    ? scheduleText(
        state.scheduleWeekday ?? SHEET_START.weekday,
        state.scheduleTime ?? SHEET_START.time,
      )
    : step2.schedulePlaceholder;
  return (
    <Screen
      footer={
        <>
          {model.errorText !== null ? <ErrorStrip text={model.errorText} /> : null}
          {created !== null ? (
            <>
              <ErrorStrip text={partial.title} />
              <Button label={partial.retry} onPress={model.retrySettings} />
              <Button
                label={partial.keep}
                variant="link"
                onPress={() => {
                  router.replace(afterCreateGroupHref(created.groupId));
                }}
              />
            </>
          ) : (
            <Button
              label={step2.submit}
              onPress={() => {
                if (model.canSubmit && !model.pending) model.submit();
              }}
            />
          )}
        </>
      }
    >
      <StepHeader
        title={strings.settings.templates[templateKey].name}
        progressLabel={step2.progress}
        progress={FINAL_STEP_PROGRESS}
        onBack={() => {
          if (router.canGoBack()) router.back();
          else router.replace(createGroupHref);
        }}
      />
      <Text variant="display" displaySize="displayMedium" accessibilityRole="header">
        {step2.title}
      </Text>
      <TextField
        label={step2.name}
        value={state.name}
        placeholder={step2.namePlaceholder}
        onChangeText={(name) => {
          dispatch({ type: "name-changed", name });
        }}
        error={errors.name}
      />
      <QuestionSection title={step2.whenAndWhere}>
        <View style={{ flexDirection: "row", gap: tokens.spacing.s }}>
          <View style={{ flex: SCHEDULE_FLEX }}>
            <ScheduleField
              label={step2.schedule}
              valueText={scheduleLabel}
              chosen={isScheduleChosen(state)}
              error={errors.schedule}
              onPress={() => {
                dispatch({
                  type: "schedule-opened",
                  draft: {
                    weekday: state.scheduleWeekday ?? SHEET_START.weekday,
                    time: state.scheduleTime ?? SHEET_START.time,
                  },
                });
              }}
            />
          </View>
          <View style={{ flex: SCHEDULE_FLEX }}>
            <TextField
              label={step2.venue}
              value={state.venue}
              onChangeText={(venue) => {
                dispatch({ type: "venue-changed", venue });
              }}
              error={errors.venue}
            />
          </View>
          <View style={{ flex: CAPACITY_FLEX }}>
            <TextField
              label={step2.capacity}
              value={state.capacityText}
              keyboardType="number-pad"
              onChangeText={(text) => {
                dispatch({ type: "capacity-changed", text });
              }}
              error={errors.capacity}
            />
          </View>
        </View>
      </QuestionSection>
      <QuestionSection number={1} title={step2.whereYouPlay}>
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={step2.whereYouPlay}
          style={{ flexDirection: "row", gap: tokens.spacing.s }}
        >
          {SETTINGS_MODALITIES.map((modality) => (
            <CourtOption
              key={modality}
              modality={modality}
              selected={modality === state.modality}
              onSelect={(value) => {
                dispatch({ type: "modality-selected", modality: value });
              }}
            />
          ))}
        </View>
      </QuestionSection>
      <QuestionSection number={2} title={step2.hasRegulars}>
        <SegmentedControl
          accessibilityLabel={step2.hasRegulars}
          options={YES_NO}
          selected={state.regulars}
          onSelect={(value) => {
            dispatch({ type: "regulars-selected", value });
          }}
        />
        <Text variant="caption">{step2.regularsHelp}</Text>
      </QuestionSection>
      <QuestionSection number={3} title={step2.charges}>
        <SegmentedControl
          accessibilityLabel={step2.charges}
          options={YES_NO}
          selected={state.charges}
          onSelect={(value) => {
            dispatch({ type: "charges-selected", value });
          }}
        />
        {state.charges ? (
          <View style={{ flexDirection: "row", gap: tokens.spacing.s }}>
            <View style={{ flex: 1 }}>
              <TextField
                label={step2.dropInFee}
                value={state.dropInFeeText}
                keyboardType="decimal-pad"
                onChangeText={(text) => {
                  dispatch({ type: "fee-changed", fee: "dropIn", text });
                }}
                error={errors.dropInFee}
              />
            </View>
            {state.regulars ? (
              <View style={{ flex: 1 }}>
                <TextField
                  label={step2.monthlyFee}
                  value={state.monthlyFeeText}
                  keyboardType="decimal-pad"
                  onChangeText={(text) => {
                    dispatch({ type: "fee-changed", fee: "monthly", text });
                  }}
                  error={errors.monthlyFee}
                />
              </View>
            ) : null}
          </View>
        ) : null}
      </QuestionSection>
      <ScheduleSheet
        visible={sheet !== null}
        weekday={sheet?.weekday ?? SHEET_START.weekday}
        time={sheet?.time ?? SHEET_START.time}
        onWeekdayChange={(weekday) => {
          dispatch({
            type: "schedule-draft-changed",
            draft: { weekday, time: sheet?.time ?? SHEET_START.time },
          });
        }}
        onTimeChange={(time) => {
          dispatch({
            type: "schedule-draft-changed",
            draft: { weekday: sheet?.weekday ?? SHEET_START.weekday, time },
          });
        }}
        onConfirm={() => {
          dispatch({ type: "schedule-confirmed" });
        }}
        onCancel={() => {
          dispatch({ type: "schedule-cancelled" });
        }}
      />
    </Screen>
  );
}
