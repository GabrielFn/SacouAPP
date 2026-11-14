import { Button, type ButtonVariant } from "./Button";

export interface ScreenAction {
  readonly label: string;
  readonly variant?: ButtonVariant;
  readonly accessibilityLabel?: string;
  readonly onPress: () => void;
}

export interface ActionButtonsProps {
  readonly actions: readonly ScreenAction[];
}

/** The buttons at the foot of a plain page, one per action. */
export function ActionButtons({ actions }: ActionButtonsProps) {
  return (
    <>
      {actions.map(({ label, variant, accessibilityLabel, onPress }) => (
        <Button
          key={label}
          label={label}
          variant={variant}
          accessibilityLabel={accessibilityLabel}
          onPress={onPress}
        />
      ))}
    </>
  );
}
