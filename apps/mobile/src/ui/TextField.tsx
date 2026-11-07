import { useId } from "react";
import { TextInput, View, type TextInputProps } from "react-native";

import { useTheme } from "../theme/theme-context";
import { fontFamilies } from "../theme/tokens.data";

import { Text } from "./Text";

export interface TextFieldProps extends Pick<
  TextInputProps,
  "value" | "onChangeText" | "placeholder" | "autoCapitalize"
> {
  readonly label: string;
  readonly help?: string;
}

export function TextField({ label, help, ...inputProps }: TextFieldProps) {
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
          borderColor: colors.borderField,
          backgroundColor: colors.surface,
          paddingHorizontal: tokens.spacing.m,
          color: colors.text,
          fontFamily: fontFamilies.body600,
          fontSize: tokens.fontSizes.field,
        }}
      />
      {help ? (
        <Text variant="caption" nativeID={helpId}>
          {help}
        </Text>
      ) : null}
    </View>
  );
}
