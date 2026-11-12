import { SETTINGS_MODALITIES } from "@sacou/match-engine";
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
import { useCreateGroup, type CreateGroupModel } from "../hooks/use-create-group";
import { isFromScratch, type GroupOrigin } from "../model/custom-blocks";
import { afterCreateGroupHref, createGroupCustomHref, createGroupHref } from "../navigation";
import { CourtOption } from "./CourtOption";
import { SHEET_START, WhenAndWhereQuestion, YES_NO } from "./CreateGroupQuestions";
import { QuestionSection } from "./QuestionSection";
import { ScheduleSheet } from "./ScheduleSheet";

const { step2, partial } = strings.createGroup;
const FINAL_STEP_PROGRESS = 1;

export interface CreateGroupDetailsScreenProps {
  readonly origin: GroupOrigin;
}

export interface CreateGroupFooterProps {
  readonly model: CreateGroupModel;
  readonly onKeep: (groupId: string) => void;
}

/** The main button, or the choice offered when the group exists but its settings were not saved. */
function CreateGroupFooter({ model, onKeep }: CreateGroupFooterProps) {
  const { submit } = model.state;
  return (
    <>
      {model.errorText !== null ? <ErrorStrip text={model.errorText} /> : null}
      {submit.kind === "created-without-settings" ? (
        <>
          <ErrorStrip text={partial.title} />
          <Button label={partial.retry} onPress={model.retrySettings} />
          <Button
            label={partial.keep}
            variant="link"
            onPress={() => {
              onKeep(submit.groupId);
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
  );
}

/** Screen 05: the two questions. The reducer holds the answers; the hook makes the two calls. */
export function CreateGroupDetailsScreen({ origin }: CreateGroupDetailsScreenProps) {
  const router = useRouter();
  const { tokens } = useTheme();
  const model = useCreateGroup(origin, (groupId) => {
    router.replace(afterCreateGroupHref(groupId));
  });
  const { state, dispatch, errors } = model;
  const sheet = state.scheduleSheet;
  return (
    <Screen
      footer={
        <CreateGroupFooter
          model={model}
          onKeep={(groupId) => {
            router.replace(afterCreateGroupHref(groupId));
          }}
        />
      }
    >
      <StepHeader
        title={strings.settings.templates[origin.templateKey].name}
        progressLabel={step2.progress}
        progress={FINAL_STEP_PROGRESS}
        onBack={() => {
          if (router.canGoBack()) router.back();
          else router.replace(isFromScratch(origin) ? createGroupCustomHref : createGroupHref);
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
      <WhenAndWhereQuestion model={model} />
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
