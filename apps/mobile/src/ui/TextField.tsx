import { useId } from "react";
import { TextInput, View, type TextInputProps } from "react-native";

import { useTheme } from "../theme/theme-context";
import { fontFamilies } from "../theme/tokens.data";

import { Text } from "./Text";

export interface TextFieldProps extends Pick<
  TextInputProps,
  "value" | "onChangeText" | "placeholder" | "autoCapitalize" | "keyboardType" | "maxLength"
> {
  readonly label: string;
  readonly help?: string;
  /** The text of a refusal: shown under the field and announced as an alert. */
  readonly error?: string;
}

export function TextField({ label, help, error, ...inputProps }: TextFieldProps) {
  const { colors, tokens } = useTheme();
  const helpId = useId();
  return (
    <View style={{ gap: tokens.spacing.xs }}>
      <Text variant="bodyStrong" style={{ fontSize: tokens.fontSizes.small }}>
        {label}
      </Text>
      <TextInput
        {...inputProps}
        accessibilityLabel={label}
        aria-describedby={help ? helpId : undefined}
        placeholderTextColor={colors.textMuted}
        style={{
          minHeight: tokens.sizes.field,
          borderRadius: tokens.radii.field,
          borderWidth: tokens.borderWidths.thin,
          borderColor: error ? colors.primary : colors.borderField,
          backgroundColor: colors.surface,
          paddingHorizontal: tokens.spacing.m,
          color: colors.text,
          fontFamily: fontFamilies.body600,
          fontSize: tokens.fontSizes.field,
        }}
      />
      {error ? (
        <Text variant="caption" accessibilityRole="alert" style={{ color: colors.text }}>
          {error}
        </Text>
      ) : null}
      {help ? (
        <Text variant="caption" nativeID={helpId}>
          {help}
        </Text>
      ) : null}
    </View>
  );
}
