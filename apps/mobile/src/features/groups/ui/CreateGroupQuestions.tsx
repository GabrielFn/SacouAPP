import { View } from "react-native";

import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { TextField } from "../../../ui/TextField";
import type { CreateGroupModel } from "../hooks/use-create-group";
import { isScheduleChosen } from "../model/create-group.selectors";
import { scheduleText } from "../model/schedule-text";
import { QuestionSection } from "./QuestionSection";
import { ScheduleField } from "./ScheduleField";

const { step2 } = strings.createGroup;

/** What the sheet of day and time opens with when nothing was chosen: Tuesday at 20:00, the catalog default. */
export const SHEET_START = { weekday: 2, time: "20:00" } as const;
/** The three fields of "Quando e onde?" share the row as in the canvas (1.25 : 1.25 : 0.6). */
const SCHEDULE_FLEX = 1.25;
const CAPACITY_FLEX = 0.6;

export const YES_NO = [
  { value: true, label: step2.yes },
  { value: false, label: step2.no },
] as const;

export interface CreateGroupQuestionProps {
  readonly model: CreateGroupModel;
}

export function WhenAndWhereQuestion({ model }: CreateGroupQuestionProps) {
  const { tokens } = useTheme();
  const { state, dispatch, errors } = model;
  const chosen = isScheduleChosen(state);
  return (
    <QuestionSection title={step2.whenAndWhere}>
      <View style={{ flexDirection: "row", gap: tokens.spacing.s }}>
        <View style={{ flex: SCHEDULE_FLEX }}>
          <ScheduleField
            label={step2.schedule}
            valueText={
              chosen
                ? scheduleText(
                    state.scheduleWeekday ?? SHEET_START.weekday,
                    state.scheduleTime ?? SHEET_START.time,
                  )
                : step2.schedulePlaceholder
            }
            chosen={chosen}
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
  );
}
