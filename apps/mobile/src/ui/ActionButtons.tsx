import { Button, type ButtonVariant } from "./Button";

export interface ScreenAction {
  readonly label: string;
  readonly variant?: ButtonVariant;
  readonly onPress: () => void;
}

export interface ActionButtonsProps {
  readonly actions: readonly ScreenAction[];
}

/** The buttons at the foot of a plain page, one per action. */
export function ActionButtons({ actions }: ActionButtonsProps) {
  return (
    <>
      {actions.map(({ label, variant, onPress }) => (
        <Button key={label} label={label} variant={variant} onPress={onPress} />
      ))}
    </>
  );
}
