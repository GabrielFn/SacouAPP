import { useState } from "react";
import { Pressable, View } from "react-native";

import { errorTextOf } from "../../../services/api/api-error-text";
import { strings } from "../../../strings/pt-BR";
import { useTheme } from "../../../theme/theme-context";
import { fontFamilies } from "../../../theme/tokens.data";
import { BottomSheet } from "../../../ui/BottomSheet";
import { Button } from "../../../ui/Button";
import { EmptyState } from "../../../ui/EmptyState";
import { FieldFrame } from "../../../ui/FieldFrame";
import { LoadingState } from "../../../ui/LoadingState";
import { Screen } from "../../../ui/Screen";
import { Switch } from "../../../ui/Switch";
import { Text } from "../../../ui/Text";
import { TextField } from "../../../ui/TextField";
import type { CreateRoundModel } from "../hooks/use-create-round";

const { create } = strings.rounds;

export interface PickerFieldProps {
  readonly label: string;
  readonly value: string;
  readonly error: string | null;
  readonly onPress: () => void;
}

/** A field that opens a sheet instead of a keyboard (day and time). */
export function PickerField({ label, value, error, onPress }: PickerFieldProps) {
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

/**
 * The time in `HH:mm`, typed in a draft of the sheet's own: "Confirmar" sends a valid one, and closing by
 * the backdrop throws the draft away, so the form never keeps a time that does not parse. It is mounted
 * only while open, so each opening starts from the time of the form.
 */
export function TimeSheet({ model }: TimeSheetProps) {
  const { state, dispatch } = model;
  const [draft, setDraft] = useState(state.localTime);
  const error = model.timeErrorOf(draft);
  const close = () => {
    dispatch({ type: "sheet-closed" });
  };
  return (
    <BottomSheet visible title={create.pickTime} onClose={close}>
      <TextField
        label={create.time}
        value={draft}
        help={create.timeHint}
        error={error ?? undefined}
        keyboardType="numbers-and-punctuation"
        onChangeText={setDraft}
      />
      <Button
        label={create.confirm}
        disabled={error !== null}
        onPress={() => {
          if (error === null) dispatch({ type: "time-picked", localTime: draft });
        }}
      />
    </BottomSheet>
  );
}

export interface RepeatRowProps {
  readonly model: CreateRoundModel;
  /** Without a fixed day the group has no weekly rhythm to repeat. */
  readonly enabled: boolean;
}

export function RepeatRow({ model, enabled }: RepeatRowProps) {
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

export interface FormLoadingProps {
  readonly queries: readonly {
    readonly error: Error | null;
    readonly refetch: () => Promise<unknown>;
  }[];
}

/** The wait for what the form starts from, or why it could not be read, with "Tentar de novo". */
export function FormLoading({ queries }: FormLoadingProps) {
  const failed = queries.find((query) => query.error !== null)?.error ?? null;
  return (
    <Screen>
      {failed === null ? (
        <LoadingState accessibilityLabel={create.loading} />
      ) : (
        <EmptyState
          alert
          title={create.loadError}
          body={errorTextOf(failed)}
          actions={[
            {
              label: create.retry,
              variant: "secondary",
              onPress: () => {
                queries.forEach((query) => void query.refetch());
              },
            },
          ]}
        />
      )}
    </Screen>
  );
}
